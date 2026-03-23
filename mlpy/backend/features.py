#backend/features.py

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

PATTERN_FLAG_COLUMNS = [
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
    "duplicate_transaction_id_flag",
    "failed_to_success_retry_flag",
    "high_failed_ratio_flag",
    "high_balance_utilization_flag",
    "successful_overdraft_flag",
    "dormant_reactivation_flag",
    "geographic_impossibility_flag",
    "benford_flag",
    "triple_combo_flag",
    "zero_balance_success_flag",
    "private_ip_flag",
    "category_amount_mismatch_flag",
]

CLEANING_FLAG_COLUMNS = [
    "is_amount_missing",
    "is_amount_outlier",
    "is_valid_ip",
    "is_device_id_invalid",
]

LOW_CARDINALITY_CATEGORICALS = [
    "merchant_category",
    "device_type",
    "payment_method",
    "transaction_status",
    "user_location",
    "merchant_location",
]


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    valid_denominator = denominator.astype(float).where(denominator.astype(float) > 0)
    ratio = numerator.astype(float).div(valid_denominator)
    return ratio.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def _series_or_default(df: pd.DataFrame, column: str, default: int | float | bool = 0) -> pd.Series:
    if column in df.columns:
        return df[column]
    return pd.Series(default, index=df.index)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build model-ready fraud features from raw and detected pattern columns."""
    logger.info("Building fraud features for %s transactions", len(df))

    features = df.copy()
    features["transaction_timestamp"] = pd.to_datetime(
        features["transaction_timestamp"], errors="coerce"
    )

    working = features.sort_values(
        ["user_id", "transaction_timestamp", "transaction_id"],
        kind="mergesort",
    ).copy()

    working["rolling_txn_count_1h"] = working.get("rolling_txn_count_1h", 0).fillna(0.0)
    working["rolling_txn_count_24h"] = working.get("rolling_txn_count_24h", 0).fillna(0.0)
    working["amount_user_zscore"] = working.get("amount_user_zscore", 0.0).fillna(0.0)
    working["amount_balance_ratio"] = working.get("amount_balance_ratio", 0.0).fillna(0.0)
    working["users_per_device"] = working.get("users_per_device", 0.0).fillna(0.0)
    working["users_per_ip"] = working.get("users_per_ip", 0.0).fillna(0.0)
    working["patterns_fired"] = working.get("patterns_fired", 0).fillna(0).astype(int)
    working["benford_deviation_score"] = working.get("benford_deviation_score", 0.0).fillna(0.0)

    time_gap_seconds = (
        working.groupby("user_id")["transaction_timestamp"].diff().dt.total_seconds()
    )
    working["time_since_last_transaction"] = time_gap_seconds.fillna(999999.0)

    working["transaction_hour"] = working["transaction_timestamp"].dt.hour.fillna(0).astype(int)
    working["transaction_day_of_week"] = (
        working["transaction_timestamp"].dt.dayofweek.fillna(0).astype(int)
    )
    working["weekend_transaction_flag"] = working["transaction_day_of_week"].isin([5, 6])

    reference_timestamp = working["transaction_timestamp"].max()
    working["rfm_recency"] = (
        (reference_timestamp - working["transaction_timestamp"]).dt.total_seconds().div(3600.0)
    ).fillna(0.0)
    working["rfm_frequency"] = (
        working.groupby("user_id")["transaction_id"].transform("count").astype(float)
    )
    working["rfm_monetary"] = (
        working.groupby("user_id")["transaction_amount"].transform("sum").fillna(0.0)
    )

    working["user_avg_amount"] = (
        working.groupby("user_id")["transaction_amount"].transform("mean").fillna(0.0)
    )
    working["user_amount_std"] = (
        working.groupby("user_id")["transaction_amount"].transform("std").fillna(0.0)
    )
    working["merchant_avg_amount"] = (
        working.groupby("merchant_category")["transaction_amount"].transform("mean").fillna(0.0)
    )

    working["amount_log1p"] = np.log1p(working["transaction_amount"].clip(lower=0).fillna(0.0))
    working["balance_log1p"] = np.log1p(working["account_balance"].clip(lower=0).fillna(0.0))
    working["estimated_post_transaction_balance"] = (
        working["account_balance"].fillna(0.0) - working["transaction_amount"].fillna(0.0)
    )
    working["amount_to_user_average_ratio"] = _safe_ratio(
        working["transaction_amount"], working["user_avg_amount"]
    )
    working["amount_to_merchant_average_ratio"] = _safe_ratio(
        working["transaction_amount"], working["merchant_avg_amount"]
    )

    for column in LOW_CARDINALITY_CATEGORICALS:
        encoded = (
            working[column]
            .astype("string")
            .fillna("unknown")
            .pipe(lambda series: pd.factorize(series, sort=True)[0] + 1)
            .astype(np.int32)
        )
        working[f"{column}_code"] = encoded

    cleaning_flags = pd.DataFrame(index=working.index)
    cleaning_flags["is_amount_missing"] = _series_or_default(working, "is_amount_missing", False).fillna(False).astype(int)
    cleaning_flags["is_amount_outlier"] = _series_or_default(working, "is_amount_outlier", False).fillna(False).astype(int)
    cleaning_flags["invalid_ip_cleaning_flag"] = (~_series_or_default(working, "is_valid_ip", True).fillna(True)).astype(int)
    cleaning_flags["invalid_device_cleaning_flag"] = _series_or_default(working, "is_device_id_invalid", False).fillna(False).astype(int)
    working["cleaning_flag_score"] = cleaning_flags.sum(axis=1)

    pattern_flags = working[PATTERN_FLAG_COLUMNS].fillna(False).astype(int)
    working["pattern_score"] = pattern_flags.sum(axis=1)

    working["network_risk_score"] = working["users_per_device"].fillna(0.0) + working["users_per_ip"].fillna(0.0)
    working["velocity_risk_score"] = (
        working["rolling_txn_count_1h"].fillna(0.0)
        + working["rolling_txn_count_24h"].fillna(0.0).div(24.0)
        + working["rapid_repeat_5s_flag"].fillna(False).astype(int) * 5.0
    )
    working["status_risk_score"] = (
        working["high_failed_ratio_flag"].fillna(False).astype(int)
        + working["failed_to_success_retry_flag"].fillna(False).astype(int) * 2.0
        + working["transaction_status"].eq("failed").astype(float)
    )

    built = working.sort_index()
    bool_columns = built.select_dtypes(include=["bool"]).columns
    built[bool_columns] = built[bool_columns].astype(int)

    logger.info("Feature building completed with %s columns", len(built.columns))
    return built
