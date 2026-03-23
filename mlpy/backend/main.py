from pathlib import Path

import io
import logging
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException

try:
    from .cleaning import run_cleaning_pipeline
    from .features import build_features
    from .model import compute_pseudo_truth_metrics, derive_flagging_threshold, score_fraud
    from .patterns import detect_patterns
except ImportError:  # Allows running as a script without package context.
    from cleaning import run_cleaning_pipeline
    from features import build_features
    from model import compute_pseudo_truth_metrics, derive_flagging_threshold, score_fraud
    from patterns import detect_patterns

app = FastAPI()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

LABEL_COLUMN_CANDIDATES = (
    "is_fraud",
    "fraud",
    "fraud_label",
    "label",
    "target",
    "actual_fraud",
    "ground_truth",
)


def _find_label_column(df: pd.DataFrame) -> str | None:
    lowered_map = {column.lower(): column for column in df.columns}
    for candidate in LABEL_COLUMN_CANDIDATES:
        if candidate in lowered_map:
            return lowered_map[candidate]
    return None


def _normalize_label_series(series: pd.Series) -> pd.Series:
    label_map = {
        "1": 1,
        "true": 1,
        "yes": 1,
        "y": 1,
        "fraud": 1,
        "fraudulent": 1,
        "0": 0,
        "false": 0,
        "no": 0,
        "n": 0,
        "legit": 0,
        "legitimate": 0,
        "normal": 0,
        "non-fraud": 0,
        "non_fraud": 0,
    }
    normalized = series.astype("string").str.strip().str.lower().map(label_map)
    numeric = pd.to_numeric(series, errors="coerce")
    normalized = normalized.fillna(numeric)
    normalized = normalized.where(normalized.isin([0, 1]))
    return normalized


def _compute_classification_metrics(
    scored_df: pd.DataFrame,
    label_column: str | None,
    threshold: float,
) -> dict[str, float | int | None]:
    if not label_column or label_column not in scored_df.columns:
        return {
            "accuracy": None,
            "recall": None,
            "precision": None,
            "actual_fraud_count": None,
        }

    labels = _normalize_label_series(scored_df[label_column])
    valid_mask = labels.notna()
    if not valid_mask.any():
        return {
            "accuracy": None,
            "recall": None,
            "precision": None,
            "actual_fraud_count": None,
        }

    truth = labels.loc[valid_mask].astype(int)
    predictions = scored_df.loc[valid_mask, "fraud_probability"].ge(threshold).astype(int)

    true_positive = int(((predictions == 1) & (truth == 1)).sum())
    true_negative = int(((predictions == 0) & (truth == 0)).sum())
    false_positive = int(((predictions == 1) & (truth == 0)).sum())
    false_negative = int(((predictions == 0) & (truth == 1)).sum())

    total = len(truth)
    accuracy = (true_positive + true_negative) / total if total else None
    recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else None
    precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else None

    return {
        "accuracy": round(float(accuracy), 4) if accuracy is not None else None,
        "recall": round(float(recall), 4) if recall is not None else None,
        "precision": round(float(precision), 4) if precision is not None else None,
        "actual_fraud_count": int(truth.sum()),
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload endpoint that accepts a CSV and returns fraud scoring results
    after cleaning, pattern detection, feature engineering, and ML scoring.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        logger.error("Failed to read uploaded CSV: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid CSV file.")

    label_column = _find_label_column(df)

    try:
        output_path = Path(__file__).resolve().parents[1] / "clean_transactions.csv"
        cleaned_df, _, _, _ = run_cleaning_pipeline(df, output_path)
        patterned_df = detect_patterns(cleaned_df)
        feature_df = build_features(patterned_df)
        scored_df = score_fraud(feature_df)
    except ValueError as exc:
        logger.error("Fraud pipeline validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive API boundary.
        logger.exception("Fraud scoring pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail="Fraud scoring pipeline failed.")

    threshold = derive_flagging_threshold(scored_df)
    flagged_df = scored_df.loc[scored_df["fraud_probability"] >= threshold].copy()
    if flagged_df.empty:
        flagged_df = scored_df.head(min(10, len(scored_df))).copy()

    flagged_df["fraud_probability"] = flagged_df["fraud_probability"].round(4)
    metrics = _compute_classification_metrics(scored_df, label_column, threshold)
    pseudo_metrics = compute_pseudo_truth_metrics(scored_df, threshold)
    top_transactions = (
        scored_df[["transaction_id", "fraud_probability"]]
        .head(10)
        .assign(fraud_probability=lambda frame: frame["fraud_probability"].round(4))
        .to_dict(orient="records")
    )

    return {
        "fraud_transaction_count": int(len(flagged_df)),
        "threshold_used": round(float(threshold), 6),
        "accuracy": metrics["accuracy"],
        "recall": metrics["recall"],
        "precision": metrics["precision"],
        "actual_fraud_count": metrics["actual_fraud_count"],
        "pseudo_accuracy": pseudo_metrics["pseudo_accuracy"],
        "pseudo_recall": pseudo_metrics["pseudo_recall"],
        "pseudo_precision": pseudo_metrics["pseudo_precision"],
        "pseudo_fraud_count": pseudo_metrics["pseudo_fraud_count"],
        "top_transactions": top_transactions,
    }
