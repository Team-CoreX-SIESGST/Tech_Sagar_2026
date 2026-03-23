from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest

try:
    from lightgbm import LGBMClassifier

    HAS_LIGHTGBM = True
except (ImportError, OSError):  # pragma: no cover - covers missing package or libomp runtime.
    LGBMClassifier = None
    HAS_LIGHTGBM = False

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"
MODEL_PATH = OUTPUT_DIR / "fraud_hybrid_model.joblib"
SCORED_PATH = OUTPUT_DIR / "scored_transactions.csv"

BASE_EXCLUDE_COLUMNS = {
    "transaction_id",
    "user_id",
    "transaction_timestamp",
    "device_id",
    "ip_address",
    "amt",
}
LABEL_EXCLUDE_COLUMNS = {
    "is_fraud",
    "fraud",
    "fraud_label",
    "label",
    "target",
    "actual_fraud",
    "ground_truth",
}

TOP_SIGNAL_CANDIDATES = [
    "pattern_score",
    "patterns_fired",
    "benford_deviation_score",
    "amount_user_zscore",
    "amount_balance_ratio",
    "rolling_txn_count_1h",
    "rolling_txn_count_24h",
    "time_since_last_transaction",
    "users_per_device",
    "users_per_ip",
    "rfm_recency",
    "rfm_frequency",
    "rfm_monetary",
    "cleaning_flag_score",
    "network_risk_score",
    "velocity_risk_score",
    "status_risk_score",
    "amount_exceeds_balance_flag",
    "round_number_flag",
    "structuring_amount_flag",
    "rapid_repeat_5s_flag",
    "odd_hour_transaction_flag",
    "location_mismatch_flag",
    "new_merchant_city_flag",
    "shared_device_flag",
    "shared_ip_flag",
    "malformed_ip_flag",
    "invalid_device_flag",
    "failed_to_success_retry_flag",
    "high_failed_ratio_flag",
    "high_balance_utilization_flag",
    "successful_overdraft_flag",
    "is_amount_missing",
    "is_amount_outlier",
    "invalid_ip_cleaning_flag",
    "invalid_device_cleaning_flag",
]


@dataclass
class FraudModelArtifacts:
    isolation_forest: IsolationForest
    classifier: Any | None
    feature_columns: list[str]
    fill_values: dict[str, float]
    anomaly_scale_min: float
    anomaly_scale_max: float
    feature_importance_map: dict[str, float]
    model_type: str
    threshold: float


_MODEL_CACHE: FraudModelArtifacts | None = None


def derive_flagging_threshold(
    scored_df: pd.DataFrame,
) -> float:
    """Return a dynamic fraud threshold based on the scored distribution."""
    if scored_df.empty:
        return 0.55

    threshold = float(
        max(
            0.55,
            scored_df["fraud_probability"].quantile(0.89),
        )
    )
    return threshold


def _get_feature_columns(df: pd.DataFrame) -> list[str]:
    numeric_columns = []
    for column in df.columns:
        if column in BASE_EXCLUDE_COLUMNS or column.lower() in LABEL_EXCLUDE_COLUMNS:
            continue
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            continue
        if pd.api.types.is_numeric_dtype(df[column]) or pd.api.types.is_bool_dtype(df[column]):
            numeric_columns.append(column)
    return numeric_columns


def _compute_fill_values(df: pd.DataFrame, feature_columns: list[str]) -> dict[str, float]:
    medians = df[feature_columns].replace([np.inf, -np.inf], np.nan).median(numeric_only=True)
    return medians.fillna(0.0).to_dict()


def _prepare_matrix(
    df: pd.DataFrame,
    feature_columns: list[str],
    fill_values: dict[str, float],
) -> pd.DataFrame:
    matrix = df.reindex(columns=feature_columns, fill_value=np.nan).copy()
    matrix = matrix.apply(pd.to_numeric, errors="coerce")
    matrix = matrix.replace([np.inf, -np.inf], np.nan)
    matrix = matrix.fillna(fill_values)
    return matrix


def _normalize_scores(values: np.ndarray) -> np.ndarray:
    minimum = float(np.min(values))
    maximum = float(np.max(values))
    if np.isclose(maximum, minimum):
        return np.zeros_like(values, dtype=float)
    return (values - minimum) / (maximum - minimum)


def _derive_weak_labels(df: pd.DataFrame, anomaly_score: np.ndarray) -> np.ndarray:
    critical_flags = pd.DataFrame(
        {
            "amount_exceeds_balance_flag": df.get("amount_exceeds_balance_flag", 0),
            "successful_overdraft_flag": df.get("successful_overdraft_flag", 0),
            "failed_to_success_retry_flag": df.get("failed_to_success_retry_flag", 0),
            "shared_device_flag": df.get("shared_device_flag", 0),
            "shared_ip_flag": df.get("shared_ip_flag", 0),
            "invalid_device_flag": df.get("invalid_device_flag", 0),
            "malformed_ip_flag": df.get("malformed_ip_flag", 0),
            "high_balance_utilization_flag": df.get("high_balance_utilization_flag", 0),
            "is_amount_outlier": df.get("is_amount_outlier", 0),
        }
    ).fillna(0).astype(int)

    pattern_score = df.get("pattern_score", pd.Series(0, index=df.index)).fillna(0)
    critical_positive = critical_flags.any(axis=1)
    high_pattern = pattern_score.ge(max(3, float(pattern_score.quantile(0.85))))
    high_anomaly = anomaly_score >= float(np.quantile(anomaly_score, 0.9))
    weak_labels = (critical_positive | high_pattern | high_anomaly).astype(int).to_numpy()

    unique_labels = np.unique(weak_labels)
    if unique_labels.size < 2:
        fallback_cutoff = 0.8 if len(df) < 5000 else 0.9
        weak_labels = (anomaly_score >= float(np.quantile(anomaly_score, fallback_cutoff))).astype(int)

    if weak_labels.sum() == 0:
        weak_labels[np.argmax(anomaly_score)] = 1
    if weak_labels.sum() == len(weak_labels):
        weak_labels[np.argmin(anomaly_score)] = 0

    return weak_labels


def _compute_feature_importances(
    classifier: Any | None,
    feature_columns: list[str],
    matrix: pd.DataFrame,
    weak_labels: np.ndarray,
) -> dict[str, float]:
    if classifier is not None and hasattr(classifier, "feature_importances_"):
        raw_importances = np.asarray(classifier.feature_importances_, dtype=float)
    elif classifier is not None and hasattr(classifier, "coef_"):
        raw_importances = np.abs(np.asarray(classifier.coef_, dtype=float)).reshape(-1)
    else:
        y_centered = weak_labels - weak_labels.mean()
        raw_importances = []
        for column in feature_columns:
            feature = matrix[column].to_numpy(dtype=float)
            feature_centered = feature - feature.mean()
            denominator = np.linalg.norm(feature_centered) * np.linalg.norm(y_centered)
            correlation = 0.0 if denominator == 0 else abs(np.dot(feature_centered, y_centered) / denominator)
            raw_importances.append(correlation)
        raw_importances = np.asarray(raw_importances, dtype=float)

    if raw_importances.size == 0:
        return {}

    normalized = raw_importances / raw_importances.sum() if raw_importances.sum() > 0 else raw_importances
    return {column: float(value) for column, value in zip(feature_columns, normalized)}


def _train_classifier(matrix: pd.DataFrame, weak_labels: np.ndarray) -> tuple[Any | None, str]:
    if np.unique(weak_labels).size < 2:
        return None, "heuristic"

    positive_weight = max(1.0, (len(weak_labels) - weak_labels.sum()) / max(weak_labels.sum(), 1))
    sample_weight = np.where(weak_labels == 1, positive_weight, 1.0)

    if HAS_LIGHTGBM and LGBMClassifier is not None:
        classifier = LGBMClassifier(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=5,
            num_leaves=31,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            objective="binary",
            verbose=-1,
        )
        classifier.fit(matrix, weak_labels, sample_weight=sample_weight)
        return classifier, "lightgbm"

    logger.warning("LightGBM is not installed; falling back to HistGradientBoostingClassifier")
    classifier = HistGradientBoostingClassifier(
        max_depth=5,
        learning_rate=0.05,
        max_iter=250,
        random_state=42,
    )
    classifier.fit(matrix, weak_labels, sample_weight=sample_weight)
    return classifier, "hist_gradient_boosting"


def _predict_classifier_probability(classifier: Any | None, matrix: pd.DataFrame) -> np.ndarray:
    if classifier is None:
        return np.zeros(len(matrix), dtype=float)
    probabilities = classifier.predict_proba(matrix)
    return probabilities[:, 1]


def _build_top_signals(
    scored: pd.DataFrame,
    feature_importance_map: dict[str, float],
    top_k: int = 3,
) -> list[list[str]]:
    candidates = [column for column in TOP_SIGNAL_CANDIDATES if column in scored.columns]
    if not candidates:
        return [["anomaly_score"] for _ in range(len(scored))]

    weights = np.array([feature_importance_map.get(column, 0.0) for column in candidates], dtype=float)
    if np.isclose(weights.sum(), 0.0):
        weights = np.ones_like(weights, dtype=float)

    values = scored[candidates].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    scale = values.abs().max(axis=0).replace(0, 1.0)
    contribution_matrix = values.abs().div(scale, axis=1).to_numpy(dtype=float) * weights

    if contribution_matrix.shape[1] <= top_k:
        top_indices = np.argsort(-contribution_matrix, axis=1)
    else:
        top_indices = np.argpartition(-contribution_matrix, kth=top_k - 1, axis=1)[:, :top_k]
        row_selector = np.arange(contribution_matrix.shape[0])[:, None]
        row_scores = contribution_matrix[row_selector, top_indices]
        row_order = np.argsort(-row_scores, axis=1)
        top_indices = top_indices[row_selector, row_order]

    top_signals: list[list[str]] = []
    for row_index, indices in enumerate(top_indices):
        row_scores = contribution_matrix[row_index, indices]
        active_signals = [candidates[idx] for idx, score in zip(indices, row_scores) if score > 0]
        if not active_signals:
            active_signals = ["anomaly_score"]
        top_signals.append(active_signals[:top_k])
    return top_signals


def _score_with_artifacts(df: pd.DataFrame, artifacts: FraudModelArtifacts) -> pd.DataFrame:
    matrix = _prepare_matrix(df, artifacts.feature_columns, artifacts.fill_values)
    raw_anomaly = -artifacts.isolation_forest.score_samples(matrix)
    anomaly_score = _normalize_scores(raw_anomaly)

    classifier_matrix = matrix.assign(anomaly_score=anomaly_score)
    classifier_probability = _predict_classifier_probability(artifacts.classifier, classifier_matrix)

    pattern_score = df.get("pattern_score", pd.Series(0, index=df.index)).fillna(0.0).to_numpy(dtype=float)
    max_pattern_score = float(pattern_score.max()) if pattern_score.size else 0.0
    normalized_pattern_score = (
        _normalize_scores(pattern_score)
        if max_pattern_score > 0
        else np.zeros_like(pattern_score)
    )
    fraud_probability = 0.55 * classifier_probability + 0.30 * anomaly_score + 0.15 * normalized_pattern_score
    fraud_probability = np.clip(fraud_probability, 0.0, 1.0)

    scored = df.copy()
    scored["anomaly_score"] = anomaly_score
    scored["fraud_probability"] = fraud_probability
    scored["pseudo_truth_label"] = _derive_weak_labels(scored, anomaly_score)
    scored["top_signals"] = _build_top_signals(scored, artifacts.feature_importance_map)
    return scored


def train_model(df: pd.DataFrame) -> FraudModelArtifacts:
    """Train the anomaly detector and fraud scoring classifier on engineered features."""
    global _MODEL_CACHE

    if df.empty:
        raise ValueError("Cannot train fraud model on an empty dataframe.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    feature_columns = _get_feature_columns(df)
    fill_values = _compute_fill_values(df, feature_columns)
    matrix = _prepare_matrix(df, feature_columns, fill_values)

    isolation_forest = IsolationForest(
        n_estimators=250,
        contamination=0.11,
        random_state=42,
        n_jobs=1,
    )
    isolation_forest.fit(matrix)

    raw_anomaly = -isolation_forest.score_samples(matrix)
    anomaly_score = _normalize_scores(raw_anomaly)
    weak_labels = _derive_weak_labels(df, anomaly_score)

    classifier, model_type = _train_classifier(
        matrix.assign(anomaly_score=anomaly_score),
        weak_labels,
    )

    feature_importance_map = _compute_feature_importances(
        classifier=classifier,
        feature_columns=feature_columns + ["anomaly_score"],
        matrix=matrix.assign(anomaly_score=anomaly_score),
        weak_labels=weak_labels,
    )

    artifacts = FraudModelArtifacts(
        isolation_forest=isolation_forest,
        classifier=classifier,
        feature_columns=feature_columns,
        fill_values=fill_values,
        anomaly_scale_min=float(raw_anomaly.min()),
        anomaly_scale_max=float(raw_anomaly.max()),
        feature_importance_map=feature_importance_map,
        model_type=model_type,
        threshold=0.55,
    )
    joblib.dump(artifacts, MODEL_PATH)
    _MODEL_CACHE = artifacts

    logger.info(
        "Fraud model trained using %s over %s features",
        model_type,
        len(feature_columns),
    )
    return artifacts


def predict_fraud(df: pd.DataFrame) -> pd.DataFrame:
    """Score transactions and return probabilities with top explanatory signals."""
    global _MODEL_CACHE

    if df.empty:
        return pd.DataFrame(columns=["transaction_id", "fraud_probability", "top_signals"])

    artifacts = _MODEL_CACHE or train_model(df)
    scored = _score_with_artifacts(df, artifacts)

    SCORED_PATH.parent.mkdir(parents=True, exist_ok=True)
    scored.sort_values("fraud_probability", ascending=False).to_csv(SCORED_PATH, index=False)

    logger.info("Generated fraud scores for %s transactions", len(scored))
    return scored[["transaction_id", "fraud_probability", "top_signals"]].sort_values(
        "fraud_probability",
        ascending=False,
    )


def score_fraud(df: pd.DataFrame) -> pd.DataFrame:
    """Return the full scored dataframe including pseudo-truth weak labels."""
    global _MODEL_CACHE

    if df.empty:
        return pd.DataFrame(
            columns=[
                "transaction_id",
                "anomaly_score",
                "fraud_probability",
                "pseudo_truth_label",
                "top_signals",
            ]
        )

    artifacts = _MODEL_CACHE or train_model(df)
    scored = _score_with_artifacts(df, artifacts).sort_values(
        "fraud_probability",
        ascending=False,
    )
    SCORED_PATH.parent.mkdir(parents=True, exist_ok=True)
    scored.to_csv(SCORED_PATH, index=False)
    logger.info("Generated full fraud scoring output for %s transactions", len(scored))
    return scored


def compute_pseudo_truth_metrics(scored_df: pd.DataFrame, threshold: float) -> dict[str, float | int]:
    """Measure agreement between predicted frauds and weak pseudo-truth labels."""
    pseudo_truth = scored_df["pseudo_truth_label"].astype(int)
    predictions = scored_df["fraud_probability"].ge(threshold).astype(int)

    true_positive = int(((predictions == 1) & (pseudo_truth == 1)).sum())
    true_negative = int(((predictions == 0) & (pseudo_truth == 0)).sum())
    false_positive = int(((predictions == 1) & (pseudo_truth == 0)).sum())
    false_negative = int(((predictions == 0) & (pseudo_truth == 1)).sum())

    total = len(scored_df)
    pseudo_accuracy = (true_positive + true_negative) / total if total else 0.0
    pseudo_recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else 0.0
    pseudo_precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else 0.0
    pseudo_f1 = (
        2 * pseudo_precision * pseudo_recall / (pseudo_precision + pseudo_recall)
        if (pseudo_precision + pseudo_recall)
        else 0.0
    )

    return {
        "pseudo_accuracy": round(float(pseudo_accuracy), 4),
        "pseudo_recall": round(float(pseudo_recall), 4),
        "pseudo_precision": round(float(pseudo_precision), 4),
        "pseudo_f1": round(float(pseudo_f1), 4),
        "pseudo_fraud_count": int(pseudo_truth.sum()),
    }
