from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

PATTERN_FLAG_COLUMNS = [
    "sudden_large_transaction_flag",
    "micro_transaction_payment_flag",
    "zero_or_missing_amount_flag",
    "category_amount_mismatch_flag",
    "location_mismatch_flag",
    "new_merchant_city_flag",
    "shared_device_flag",
    "shared_ip_flag",
    "new_device_for_user_flag",
    "user_location_pattern_deviation_flag",
    "odd_hour_high_amount_flag",
    "rapid_repeat_5s_flag",
    "failed_to_success_retry_flag",
    "amount_exceeds_balance_flag",
    "high_balance_utilization_flag",
    "successful_overdraft_flag",
    "success_unusual_context_flag",
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
]


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Safely divide two series and return 0.0 when the denominator is invalid."""
    denominator = denominator.astype(float).where(denominator.astype(float) > 0)
    ratio = numerator.astype(float).div(denominator)
    return ratio.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def _series_or_default(
    df: pd.DataFrame,
    column: str,
    default: int | float | bool = 0,
) -> pd.Series:
    """Return an existing series or a default-valued series with the dataframe index."""
    if column in df.columns:
        return df[column]
    return pd.Series(default, index=df.index)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build a compact feature set focused on generalizable fraud signals."""
    logger.info("Building basic fraud features for %s transactions", len(df))

    working = df.copy()
    working["transaction_timestamp"] = pd.to_datetime(
        working["transaction_timestamp"],
        errors="coerce",
    )
    working = working.sort_values(
        ["user_id", "transaction_timestamp", "transaction_id"],
        kind="mergesort",
    ).copy()

    working["amount_user_zscore"] = working.get("amount_user_zscore", 0.0).fillna(0.0)
    working["historical_user_avg_amount"] = (
        working.get("historical_user_avg_amount", 0.0).fillna(0.0)
    )
    working["amount_to_user_average_ratio"] = (
        working.get("amount_to_user_average_ratio", 0.0).fillna(0.0)
    )
    working["rolling_txn_count_1h"] = working.get("rolling_txn_count_1h", 0.0).fillna(0.0)
    working["users_per_device"] = working.get("users_per_device", 0.0).fillna(0.0)
    working["users_per_ip"] = working.get("users_per_ip", 0.0).fillna(0.0)
    working["patterns_fired"] = working.get("patterns_fired", 0).fillna(0).astype(int)
    working["amount_balance_ratio"] = working.get("amount_balance_ratio", 0.0).fillna(0.0)
    working["transaction_hour"] = working.get("transaction_hour", 0).fillna(0).astype(int)

    time_gap_seconds = (
        working.groupby("user_id")["transaction_timestamp"].diff().dt.total_seconds()
    )
    working["time_since_last_transaction"] = (
        working.get("inter_transaction_gap_seconds", time_gap_seconds)
        .replace([np.inf, -np.inf], np.nan)
        .fillna(999999.0)
    )

    working["user_avg_amount"] = (
        working.groupby("user_id")["transaction_amount"].transform("mean").fillna(0.0)
    )
    working["amount_log1p"] = np.log1p(working["transaction_amount"].clip(lower=0).fillna(0.0))
    working["balance_log1p"] = np.log1p(working["account_balance"].clip(lower=0).fillna(0.0))
    working["estimated_post_transaction_balance"] = (
        working["account_balance"].fillna(0.0) - working["transaction_amount"].fillna(0.0)
    )
    working["amount_to_balance_ratio"] = _safe_ratio(
        working["transaction_amount"],
        working["account_balance"],
    )

    for column in LOW_CARDINALITY_CATEGORICALS:
        working[f"{column}_code"] = (
            working[column]
            .astype("string")
            .fillna("unknown")
            .pipe(lambda series: pd.factorize(series, sort=True)[0] + 1)
            .astype(np.int32)
        )

    cleaning_flags = pd.DataFrame(index=working.index)
    cleaning_flags["is_amount_missing"] = (
        _series_or_default(working, "is_amount_missing", False).fillna(False).astype(int)
    )
    cleaning_flags["is_amount_outlier"] = (
        _series_or_default(working, "is_amount_outlier", False).fillna(False).astype(int)
    )
    cleaning_flags["invalid_ip_cleaning_flag"] = (
        ~_series_or_default(working, "is_valid_ip", True).fillna(True)
    ).astype(int)
    cleaning_flags["invalid_device_cleaning_flag"] = (
        _series_or_default(working, "is_device_id_invalid", False).fillna(False).astype(int)
    )
    working["cleaning_flag_score"] = cleaning_flags.sum(axis=1)

    pattern_flags = working[PATTERN_FLAG_COLUMNS].fillna(False).astype(int)
    working["pattern_score"] = pattern_flags.sum(axis=1)

    built = working.sort_index()
    bool_columns = built.select_dtypes(include=["bool"]).columns
    built[bool_columns] = built[bool_columns].astype(int)

    logger.info("Basic feature building completed with %s columns", len(built.columns))
    return built
