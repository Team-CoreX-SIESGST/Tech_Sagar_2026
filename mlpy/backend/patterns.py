#backend/patterns.py

from __future__ import annotations

import logging
from math import log10
from typing import Iterable

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ROUND_NUMBER_DENOMINATIONS: tuple[int, ...] = (5000, 10000, 50000)
STRUCTURING_TARGETS: tuple[int, ...] = (9999, 49999)
BENFORD_EXPECTED = np.array([log10(1 + 1 / digit) for digit in range(1, 10)], dtype=float)


def _ensure_columns(df: pd.DataFrame, columns: Iterable[str]) -> None:
    missing = [column for column in columns if column not in df.columns]
    if missing:
        missing_list = ", ".join(missing)
        raise ValueError(f"Missing required columns for pattern detection: {missing_list}")


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.astype(float)
    valid_denominator = denominator.where(denominator > 0)
    ratio = numerator.astype(float).div(valid_denominator)
    return ratio.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def _is_near_multiple(amounts: pd.Series, base: int, tolerance: float = 1.0) -> pd.Series:
    rounded = amounts.fillna(0.0).round(2)
    remainder = np.mod(rounded, base)
    return (rounded >= base) & ((remainder <= tolerance) | ((base - remainder) <= tolerance))


def _is_near_value(amounts: pd.Series, target: int, tolerance: float = 1.0) -> pd.Series:
    return amounts.fillna(0.0).sub(target).abs().le(tolerance)


def _leading_digit_series(amounts: pd.Series) -> pd.Series:
    """Extract the first significant digit for positive transaction amounts."""
    positive_amounts = amounts.abs().where(amounts.abs() > 0)
    return positive_amounts.astype("string").str.extract(r"([1-9])")[0]


def detect_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """Add vectorized fraud-pattern signals to a cleaned transaction dataframe."""
    required_columns = [
        "transaction_id",
        "user_id",
        "transaction_amount",
        "transaction_timestamp",
        "user_location",
        "merchant_location",
        "merchant_category",
        "device_id",
        "transaction_status",
        "account_balance",
        "ip_address",
        "is_valid_ip",
        "is_device_id_invalid",
    ]
    _ensure_columns(df, required_columns)

    logger.info("Detecting fraud patterns for %s transactions", len(df))

    patterned = df.copy()
    patterned["transaction_timestamp"] = pd.to_datetime(
        patterned["transaction_timestamp"], errors="coerce"
    )
    patterned = patterned.loc[patterned["transaction_timestamp"].notna()].copy()

    working = patterned.sort_values(
        ["user_id", "transaction_timestamp", "transaction_id"],
        kind="mergesort",
    ).copy()
    working["_txn_marker"] = 1.0

    user_amount_mean = working.groupby("user_id")["transaction_amount"].transform("mean")
    user_amount_std = working.groupby("user_id")["transaction_amount"].transform("std").replace(0, np.nan)
    working["amount_user_zscore"] = (
        working["transaction_amount"].sub(user_amount_mean).div(user_amount_std)
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    working["amount_balance_ratio"] = _safe_ratio(
        working["transaction_amount"], working["account_balance"]
    )
    working["amount_exceeds_balance_flag"] = (
        working["transaction_amount"].fillna(0.0) > working["account_balance"].fillna(-np.inf)
    )

    round_flags = pd.concat(
        [_is_near_multiple(working["transaction_amount"], denom) for denom in ROUND_NUMBER_DENOMINATIONS],
        axis=1,
    )
    working["round_number_flag"] = round_flags.any(axis=1)

    structuring_flags = pd.concat(
        [_is_near_value(working["transaction_amount"], target) for target in STRUCTURING_TARGETS],
        axis=1,
    )
    working["structuring_amount_flag"] = structuring_flags.any(axis=1)

    indexed = working.set_index("transaction_timestamp")
    working["rolling_txn_count_1h"] = (
        indexed.groupby("user_id")["_txn_marker"]
        .rolling("1h")
        .sum()
        .reset_index(level=0, drop=True)
        .to_numpy()
    )
    working["rolling_txn_count_24h"] = (
        indexed.groupby("user_id")["_txn_marker"]
        .rolling("24h")
        .sum()
        .reset_index(level=0, drop=True)
        .to_numpy()
    )

    gap_seconds = (
        working.groupby("user_id")["transaction_timestamp"].diff().dt.total_seconds()
    )
    working["inter_transaction_gap_seconds"] = gap_seconds.fillna(np.inf)
    working["rapid_repeat_5s_flag"] = working["inter_transaction_gap_seconds"].lt(5.0)
    working["odd_hour_transaction_flag"] = working["transaction_timestamp"].dt.hour.between(2, 5)

    working["location_mismatch_flag"] = (
        working["user_location"].astype("string").fillna("unknown")
        != working["merchant_location"].astype("string").fillna("unknown")
    )
    working["new_merchant_city_flag"] = ~working.duplicated(
        subset=["user_id", "merchant_location"],
        keep="first",
    )

    previous_city = working.groupby("user_id")["merchant_location"].shift().fillna("unknown")
    gap_minutes = working["inter_transaction_gap_seconds"].div(60.0)
    working["geographic_impossibility_flag"] = (
        previous_city.ne("unknown")
        & previous_city.ne(working["merchant_location"].astype("string").fillna("unknown"))
        & gap_minutes.lt(120.0)
    )

    users_per_device = (
        working.dropna(subset=["device_id"])
        .groupby("device_id")["user_id"]
        .transform("nunique")
    )
    working["users_per_device"] = users_per_device.reindex(working.index).fillna(0.0)
    working["shared_device_flag"] = working["users_per_device"].gt(1)

    users_per_ip = (
        working.dropna(subset=["ip_address"])
        .groupby("ip_address")["user_id"]
        .transform("nunique")
    )
    working["users_per_ip"] = users_per_ip.reindex(working.index).fillna(0.0)
    working["shared_ip_flag"] = working["users_per_ip"].gt(1)

    working["malformed_ip_flag"] = ~working["is_valid_ip"].fillna(False)
    working["invalid_device_flag"] = working["is_device_id_invalid"].fillna(False)
    ip_series = working["ip_address"].astype("string").fillna("")
    private_172_mask = ip_series.str.extract(r"^172\.(\d{1,2})\.")[0].astype("float").between(16, 31)
    working["private_ip_flag"] = (
        ip_series.str.startswith("10.")
        | ip_series.str.startswith("192.168.")
        | private_172_mask.fillna(False)
    )

    working["duplicate_transaction_id_flag"] = working.duplicated(
        subset=["transaction_id"], keep=False
    )

    previous_status = working.groupby("user_id")["transaction_status"].shift().fillna("unknown")
    previous_amount = working.groupby("user_id")["transaction_amount"].shift().fillna(0.0)
    relative_amount_delta = _safe_ratio(
        working["transaction_amount"].sub(previous_amount).abs(),
        previous_amount.abs().clip(lower=1.0),
    )
    working["failed_to_success_retry_flag"] = (
        previous_status.eq("failed")
        & working["transaction_status"].eq("success")
        & working["inter_transaction_gap_seconds"].le(1800.0)
        & relative_amount_delta.le(0.1)
    )

    failed_indicator = working["transaction_status"].eq("failed").astype(float)
    working["user_failed_ratio"] = failed_indicator.groupby(working["user_id"]).transform("mean")
    working["high_failed_ratio_flag"] = working["user_failed_ratio"].ge(0.3)

    working["high_balance_utilization_flag"] = working["amount_balance_ratio"].gt(0.8)
    working["successful_overdraft_flag"] = (
        working["transaction_status"].eq("success")
        & working["amount_exceeds_balance_flag"]
    )
    working["zero_balance_success_flag"] = (
        working["account_balance"].fillna(-1).eq(0)
        & working["transaction_status"].eq("success")
    )

    historical_mean = working.groupby("user_id")["transaction_amount"].transform("mean").fillna(0.0)
    dormant_days = working["inter_transaction_gap_seconds"].div(86400.0)
    working["dormant_reactivation_flag"] = (
        dormant_days.gt(30.0)
        & working["transaction_amount"].fillna(0.0).gt(historical_mean * 2.0)
        & historical_mean.gt(0.0)
    )

    leading_digits = _leading_digit_series(working["transaction_amount"])
    benford_counts = pd.crosstab(working["user_id"], leading_digits).reindex(
        columns=[str(digit) for digit in range(1, 10)],
        fill_value=0,
    )
    benford_totals = benford_counts.sum(axis=1).to_numpy(dtype=float)
    benford_expected = benford_totals[:, None] * BENFORD_EXPECTED[None, :]
    observed = benford_counts.to_numpy(dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        chi_square = np.divide(
            (observed - benford_expected) ** 2,
            benford_expected,
            out=np.zeros_like(observed, dtype=float),
            where=benford_expected > 0,
        ).sum(axis=1)
    benford_map = pd.Series(chi_square, index=benford_counts.index)
    working["benford_deviation_score"] = working["user_id"].map(benford_map).fillna(0.0)
    working["benford_flag"] = working["benford_deviation_score"].gt(15.0)

    working["triple_combo_flag"] = (
        working["amount_user_zscore"].gt(3.0)
        & working["odd_hour_transaction_flag"]
        & working["location_mismatch_flag"]
    )

    category_median = (
        working.groupby("merchant_category")["transaction_amount"].transform("median").fillna(0.0)
    )
    category_series = working["merchant_category"].astype("string").fillna("unknown")
    working["category_amount_mismatch_flag"] = (
        category_series.isin(["grocery", "fuel"])
        & working["transaction_amount"].fillna(0.0).gt(category_median * 3.0)
        & category_median.gt(0.0)
    )

    working = working.drop(columns=["_txn_marker"])
    flag_columns = [column for column in working.columns if column.endswith("_flag")]
    working["patterns_fired"] = working[flag_columns].fillna(False).astype(int).sum(axis=1)
    patterned = working.sort_index()

    bool_columns = patterned.select_dtypes(include=["bool"]).columns
    patterned[bool_columns] = patterned[bool_columns].fillna(False)

    logger.info(
        "Pattern detection completed with %s pattern columns",
        len([column for column in patterned.columns if column.endswith("_flag")]),
    )
    return patterned
