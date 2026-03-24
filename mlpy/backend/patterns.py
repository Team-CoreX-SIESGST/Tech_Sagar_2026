from __future__ import annotations

import logging
from typing import Iterable

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

BASIC_PATTERN_FLAG_COLUMNS: tuple[str, ...] = (
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
)


def _ensure_columns(df: pd.DataFrame, columns: Iterable[str]) -> None:
    """Validate that the required columns are present before pattern detection."""
    missing = [column for column in columns if column not in df.columns]
    if missing:
        raise ValueError(
            "Missing required columns for pattern detection: " + ", ".join(missing)
        )


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Safely divide two series and return 0.0 when the denominator is invalid."""
    denominator = denominator.astype(float).where(denominator.astype(float) > 0)
    ratio = numerator.astype(float).div(denominator)
    return ratio.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def detect_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """Detect a compact, column-aware set of fraud patterns from the cleaned dataframe."""
    required_columns = [
        "transaction_id",
        "user_id",
        "transaction_amount",
        "transaction_timestamp",
        "user_location",
        "merchant_location",
        "merchant_category",
        "device_id",
        "device_type",
        "payment_method",
        "transaction_status",
        "account_balance",
        "ip_address",
        "is_valid_ip",
        "is_device_id_invalid",
    ]
    _ensure_columns(df, required_columns)

    logger.info("Detecting basic fraud patterns for %s transactions", len(df))

    working = df.copy()
    working["transaction_timestamp"] = pd.to_datetime(
        working["transaction_timestamp"],
        errors="coerce",
    )
    working = working.loc[working["transaction_timestamp"].notna()].copy()
    working = working.sort_values(
        ["user_id", "transaction_timestamp", "transaction_id"],
        kind="mergesort",
    )
    working["_txn_marker"] = 1.0

    amount_series = working["transaction_amount"].astype(float)
    user_amount_mean = (
        working.groupby("user_id")["transaction_amount"].transform("mean").fillna(0.0)
    )
    user_amount_std = (
        working.groupby("user_id")["transaction_amount"].transform("std").replace(0, np.nan)
    )
    working["amount_user_zscore"] = (
        amount_series.sub(user_amount_mean).div(user_amount_std)
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    cumulative_amount = amount_series.fillna(0.0).groupby(working["user_id"]).cumsum()
    prior_amount_total = cumulative_amount.sub(amount_series.fillna(0.0))
    prior_txn_count = working.groupby("user_id").cumcount()
    historical_user_avg_amount = (
        prior_amount_total.div(prior_txn_count.replace(0, np.nan))
    ).replace([np.inf, -np.inf], np.nan)
    working["historical_user_avg_amount"] = historical_user_avg_amount.fillna(user_amount_mean)
    working["amount_to_user_average_ratio"] = _safe_ratio(
        amount_series,
        working["historical_user_avg_amount"],
    )
    working["sudden_large_transaction_flag"] = (
        working["amount_user_zscore"].gt(2.5)
        | (
            working["amount_to_user_average_ratio"].gt(2.5)
            & working["historical_user_avg_amount"].gt(0)
        )
    )

    indexed = working.set_index("transaction_timestamp")
    working["rolling_txn_count_1h"] = (
        indexed.groupby("user_id")["_txn_marker"]
        .rolling("1h")
        .sum()
        .reset_index(level=0, drop=True)
        .to_numpy()
    )
    gap_seconds = working.groupby("user_id")["transaction_timestamp"].diff().dt.total_seconds()
    working["inter_transaction_gap_seconds"] = gap_seconds.fillna(np.inf)
    working["rapid_repeat_5s_flag"] = working["inter_transaction_gap_seconds"].lt(5.0)

    working["transaction_hour"] = working["transaction_timestamp"].dt.hour.fillna(0).astype(int)
    working["odd_hour_transaction_flag"] = working["transaction_hour"].between(2, 5)
    working["odd_hour_high_amount_flag"] = (
        working["odd_hour_transaction_flag"]
        & (
            working["amount_user_zscore"].gt(2.0)
            | working["amount_to_user_average_ratio"].gt(2.0)
        )
    )

    payment_method = working["payment_method"].astype("string").fillna("unknown")
    working["micro_transaction_payment_flag"] = (
        amount_series.fillna(np.inf).gt(0.0)
        & amount_series.fillna(np.inf).le(50.0)
        & payment_method.isin(["card", "upi", "wallet"])
    )
    working["zero_or_missing_amount_flag"] = (
        amount_series.isna() | amount_series.fillna(0.0).eq(0.0)
    )

    merchant_category = working["merchant_category"].astype("string").fillna("unknown")
    category_median = (
        working.groupby("merchant_category")["transaction_amount"].transform("median").fillna(0.0)
    )
    working["category_amount_mismatch_flag"] = (
        merchant_category.isin(["grocery", "fuel"])
        & amount_series.fillna(0.0).gt(category_median * 3.0)
        & category_median.gt(0.0)
    )

    working["location_mismatch_flag"] = (
        working["user_location"].astype("string").fillna("unknown")
        != working["merchant_location"].astype("string").fillna("unknown")
    )
    working["new_merchant_city_flag"] = ~working.duplicated(
        subset=["user_id", "merchant_location"],
        keep="first",
    )

    user_home_location = (
        working.groupby(["user_id", "user_location"], observed=True)
        .size()
        .rename("location_count")
        .reset_index()
        .sort_values(
            ["user_id", "location_count", "user_location"],
            ascending=[True, False, True],
        )
        .drop_duplicates(subset=["user_id"], keep="first")
        .set_index("user_id")["user_location"]
    )
    working["user_home_location"] = working["user_id"].map(user_home_location).fillna("unknown")
    working["user_location_pattern_deviation_flag"] = (
        working["user_location"].astype("string").fillna("unknown").ne(working["user_home_location"])
        & working["user_home_location"].ne("unknown")
    )

    working["users_per_device"] = (
        working.groupby("device_id")["user_id"].transform("nunique").fillna(0.0)
    )
    working["shared_device_flag"] = working["users_per_device"].gt(1)
    working["new_device_for_user_flag"] = (
        ~working.duplicated(subset=["user_id", "device_id"], keep="first")
        & working["device_id"].notna()
    )

    working["users_per_ip"] = (
        working.groupby("ip_address")["user_id"].transform("nunique").fillna(0.0)
    )
    working["shared_ip_flag"] = working["users_per_ip"].gt(1)

    working["malformed_ip_flag"] = ~working["is_valid_ip"].fillna(False)
    working["invalid_device_flag"] = working["is_device_id_invalid"].fillna(False)

    previous_status = working.groupby("user_id")["transaction_status"].shift().fillna("unknown")
    previous_amount = working.groupby("user_id")["transaction_amount"].shift().fillna(0.0)
    relative_amount_delta = _safe_ratio(
        amount_series.sub(previous_amount).abs(),
        previous_amount.abs().clip(lower=1.0),
    )
    working["failed_to_success_retry_flag"] = (
        previous_status.eq("failed")
        & working["transaction_status"].eq("success")
        & working["inter_transaction_gap_seconds"].le(1800.0)
        & relative_amount_delta.le(0.1)
    )

    working["amount_balance_ratio"] = _safe_ratio(
        amount_series,
        working["account_balance"],
    )
    working["amount_exceeds_balance_flag"] = (
        amount_series.fillna(0.0) > working["account_balance"].fillna(-np.inf)
    )
    working["high_balance_utilization_flag"] = working["amount_balance_ratio"].gt(0.8)
    working["successful_overdraft_flag"] = (
        working["transaction_status"].eq("success")
        & working["amount_exceeds_balance_flag"]
    )

    unusual_context_columns = [
        "sudden_large_transaction_flag",
        "odd_hour_high_amount_flag",
        "location_mismatch_flag",
        "new_merchant_city_flag",
        "user_location_pattern_deviation_flag",
        "shared_device_flag",
        "shared_ip_flag",
        "new_device_for_user_flag",
        "rapid_repeat_5s_flag",
        "malformed_ip_flag",
        "invalid_device_flag",
        "category_amount_mismatch_flag",
        "failed_to_success_retry_flag",
        "high_balance_utilization_flag",
        "successful_overdraft_flag",
    ]
    unusual_context_count = working[unusual_context_columns].fillna(False).astype(int).sum(axis=1)
    working["success_unusual_context_flag"] = (
        working["transaction_status"].eq("success")
        & unusual_context_count.ge(2)
    )

    working["patterns_fired"] = (
        working[list(BASIC_PATTERN_FLAG_COLUMNS)].fillna(False).astype(int).sum(axis=1)
    )

    patterned = working.drop(columns=["_txn_marker"]).sort_index()
    bool_columns = patterned.select_dtypes(include=["bool"]).columns
    patterned[bool_columns] = patterned[bool_columns].fillna(False)

    logger.info(
        "Basic pattern detection completed with %s rule-based flags",
        len(BASIC_PATTERN_FLAG_COLUMNS),
    )
    return patterned
