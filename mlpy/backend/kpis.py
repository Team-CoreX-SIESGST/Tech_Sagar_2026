from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


TRUE_TOKENS = {"1", "true", "yes", "y"}


def _numeric_series(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(dtype="float64")
    return pd.to_numeric(df[column], errors="coerce")


def _text_series(df: pd.DataFrame, column: str, fallback: str = "unknown") -> pd.Series:
    if column not in df.columns:
        return pd.Series(dtype="string")

    return (
        df[column]
        .astype("string")
        .str.strip()
        .replace({"": pd.NA, "<NA>": pd.NA})
        .fillna(fallback)
    )


def _round_float(value: Any, digits: int = 2) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), digits)


def _boolean_true_count(df: pd.DataFrame, column: str) -> int:
    if column not in df.columns:
        return 0
    normalized = (
        df[column]
        .astype("string")
        .str.strip()
        .str.lower()
        .isin(TRUE_TOKENS)
    )
    return int(normalized.sum())


def _top_bucket(df: pd.DataFrame, column: str, fallback: str = "unknown") -> dict[str, Any]:
    counts = _text_series(df, column, fallback).value_counts()
    if counts.empty:
        return {"label": fallback, "count": 0}

    return {"label": str(counts.index[0]), "count": int(counts.iloc[0])}


def _top_items(df: pd.DataFrame, column: str, limit: int = 5) -> list[dict[str, Any]]:
    counts = _text_series(df, column).value_counts().head(limit)
    return [
        {"label": str(label), "count": int(count)}
        for label, count in counts.items()
    ]


def _histogram(series: pd.Series, bins: int = 12) -> list[dict[str, Any]]:
    valid = series.dropna()
    if valid.empty:
        return []

    if float(valid.min()) == float(valid.max()):
        value = float(valid.iloc[0])
        return [
            {
                "label": f"{value:,.0f}",
                "start": value,
                "end": value,
                "count": int(valid.shape[0]),
            }
        ]

    bucket_count = max(4, min(int(bins), 24))
    cut = pd.cut(valid, bins=bucket_count, include_lowest=True, duplicates="drop")
    counts = cut.value_counts(sort=False)

    histogram = []
    for interval, count in counts.items():
        start = float(interval.left)
        end = float(interval.right)
        histogram.append(
            {
                "label": f"{start:,.0f} - {end:,.0f}",
                "start": start,
                "end": end,
                "count": int(count),
            }
        )
    return histogram


def _distribution_stats(series: pd.Series) -> dict[str, Any]:
    valid = series.dropna()
    if valid.empty:
        return {
            "min": None,
            "q1": None,
            "median": None,
            "mean": None,
            "p90": None,
            "max": None,
            "std": None,
        }

    return {
        "min": _round_float(valid.min()),
        "q1": _round_float(valid.quantile(0.25)),
        "median": _round_float(valid.median()),
        "mean": _round_float(valid.mean()),
        "p90": _round_float(valid.quantile(0.90)),
        "max": _round_float(valid.max()),
        "std": _round_float(valid.std()),
    }


def _category_metrics(
    df: pd.DataFrame,
    category_column: str,
    value_column: str = "transaction_amount",
    limit: int = 12,
) -> list[dict[str, Any]]:
    if category_column not in df.columns:
        return []

    labels = _text_series(df, category_column)
    amounts = _numeric_series(df, value_column)
    status = _text_series(df, "transaction_status")
    success = status.eq("success")

    grouped = (
        pd.DataFrame(
            {
                "label": labels,
                "amount": amounts,
                "success": success,
            }
        )
        .groupby("label", dropna=False)
        .agg(
            count=("label", "size"),
            total_amount=("amount", "sum"),
            average_amount=("amount", "mean"),
            success_count=("success", "sum"),
        )
        .sort_values(["count", "total_amount"], ascending=[False, False])
        .head(limit)
        .reset_index()
    )

    results = []
    for row in grouped.itertuples(index=False):
        count = int(row.count)
        success_count = int(row.success_count)
        results.append(
            {
                "label": str(row.label),
                "count": count,
                "total_amount": _round_float(row.total_amount) or 0.0,
                "average_amount": _round_float(row.average_amount) or 0.0,
                "success_rate": round(success_count / count, 4) if count else None,
            }
        )
    return results


def _hourly_activity(
    timestamp: pd.Series,
    amount: pd.Series,
    status: pd.Series,
) -> list[dict[str, Any]]:
    if timestamp.empty:
        return []

    valid = pd.DataFrame(
        {
            "timestamp": timestamp,
            "amount": amount,
            "status": status,
        }
    ).dropna(subset=["timestamp"])

    if valid.empty:
        return []

    valid["hour"] = valid["timestamp"].dt.hour
    valid["success"] = valid["status"].eq("success")

    grouped = (
        valid.groupby("hour")
        .agg(
            count=("hour", "size"),
            total_amount=("amount", "sum"),
            average_amount=("amount", "mean"),
            success_count=("success", "sum"),
        )
        .reindex(range(24), fill_value=0)
        .reset_index()
    )

    activity = []
    for row in grouped.itertuples(index=False):
        count = int(row.count)
        success_count = int(row.success_count)
        activity.append(
            {
                "hour": int(row.hour),
                "label": f"{int(row.hour):02d}:00",
                "count": count,
                "total_amount": _round_float(row.total_amount) or 0.0,
                "average_amount": _round_float(row.average_amount) or 0.0,
                "success_rate": round(success_count / count, 4) if count else None,
            }
        )
    return activity


def _quality_metrics(df: pd.DataFrame) -> list[dict[str, Any]]:
    total_rows = max(len(df), 1)
    items = [
        ("Invalid IP", int((~df["is_valid_ip"].fillna(False).astype(bool)).sum()) if "is_valid_ip" in df.columns else 0),
        ("Invalid Device", _boolean_true_count(df, "is_device_id_invalid")),
        ("Amount Outlier", _boolean_true_count(df, "is_amount_outlier")),
        ("Duplicate ID", int(df["transaction_id"].duplicated().sum()) if "transaction_id" in df.columns else 0),
    ]
    return [
        {
            "label": label,
            "count": count,
            "percent": round(count / total_rows, 4),
        }
        for label, count in items
    ]


def build_cleaned_data_kpis(cleaned_path: Path) -> dict[str, Any]:
    """Compute dashboard KPIs directly from the cleaned transactions CSV."""
    if not cleaned_path.exists():
        raise FileNotFoundError(f"Cleaned dataset not found at {cleaned_path}")

    df = pd.read_csv(cleaned_path)
    if df.empty:
        raise ValueError("Cleaned dataset is empty.")

    transaction_amount = _numeric_series(df, "transaction_amount")
    account_balance = _numeric_series(df, "account_balance")
    timestamp = (
        pd.to_datetime(df["transaction_timestamp"], errors="coerce")
        if "transaction_timestamp" in df.columns
        else pd.Series(dtype="datetime64[ns]")
    )
    transaction_status = (
        _text_series(df, "transaction_status").str.lower()
        if "transaction_status" in df.columns
        else pd.Series(dtype="string")
    )

    success_count = int(transaction_status.eq("success").sum()) if not transaction_status.empty else 0
    failed_count = int(transaction_status.eq("failed").sum()) if not transaction_status.empty else 0
    status_total = success_count + failed_count
    success_rate = round(success_count / status_total, 4) if status_total else None

    valid_device_series = (
        df["device_id"]
        .astype("string")
        .str.strip()
        .replace({"": pd.NA, "<NA>": pd.NA, "unknown": pd.NA})
        if "device_id" in df.columns
        else pd.Series(dtype="string")
    )

    hour_counts = (
        timestamp.dropna().dt.hour.value_counts().sort_values(ascending=False)
        if not timestamp.empty
        else pd.Series(dtype="int64")
    )
    peak_hour = None
    if not hour_counts.empty:
        hour_value = int(hour_counts.index[0])
        peak_hour = {
            "label": f"{hour_value:02d}:00 - {hour_value:02d}:59",
            "hour": hour_value,
            "count": int(hour_counts.iloc[0]),
        }

    user_city_counts = _top_items(df, "user_location")
    merchant_category_counts = _top_items(df, "merchant_category")
    payment_method_counts = _top_items(df, "payment_method")
    transaction_status_counts = _top_items(df, "transaction_status")

    unique_users = int(df["user_id"].nunique(dropna=True)) if "user_id" in df.columns else 0
    unique_devices = int(valid_device_series.nunique(dropna=True)) if not valid_device_series.empty else 0
    unique_locations = int(df["user_location"].nunique(dropna=True)) if "user_location" in df.columns else 0

    summary = {
        "cleaned_transactions": int(len(df)),
        "unique_users": unique_users,
        "unique_devices": unique_devices,
        "unique_payment_methods": int(df["payment_method"].nunique(dropna=True)) if "payment_method" in df.columns else 0,
        "unique_locations": unique_locations,
        "total_transaction_value": round(float(transaction_amount.sum()), 2) if not transaction_amount.empty else 0.0,
        "average_transaction_amount": round(float(transaction_amount.mean()), 2) if transaction_amount.notna().any() else 0.0,
        "median_transaction_amount": round(float(transaction_amount.median()), 2) if transaction_amount.notna().any() else 0.0,
        "max_transaction_amount": round(float(transaction_amount.max()), 2) if transaction_amount.notna().any() else 0.0,
        "average_account_balance": round(float(account_balance.mean()), 2) if account_balance.notna().any() else 0.0,
        "success_rate": success_rate,
        "success_count": success_count,
        "failed_count": failed_count,
        "invalid_ip_rows": int((~df["is_valid_ip"].fillna(False).astype(bool)).sum()) if "is_valid_ip" in df.columns else 0,
        "invalid_device_rows": _boolean_true_count(df, "is_device_id_invalid"),
        "amount_outlier_rows": _boolean_true_count(df, "is_amount_outlier"),
        "duplicate_transaction_ids_remaining": int(df["transaction_id"].duplicated().sum()) if "transaction_id" in df.columns else 0,
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_path": str(cleaned_path),
        "source_last_modified": datetime.fromtimestamp(cleaned_path.stat().st_mtime, tz=timezone.utc).isoformat(),
        "source": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "column_names": [str(column) for column in df.columns],
        },
        "summary": summary,
        "leaders": {
            "top_payment_method": _top_bucket(df, "payment_method"),
            "top_user_location": _top_bucket(df, "user_location"),
            "top_merchant_category": _top_bucket(df, "merchant_category"),
            "peak_transaction_hour": peak_hour,
        },
        "breakdowns": {
            "payment_methods": payment_method_counts,
            "merchant_categories": merchant_category_counts,
            "user_locations": user_city_counts,
            "transaction_statuses": transaction_status_counts,
        },
        "analytics": {
            "transaction_amount": _distribution_stats(transaction_amount),
            "account_balance": _distribution_stats(account_balance),
            "transactions_per_user": round(len(df) / unique_users, 2) if unique_users else None,
            "transactions_per_device": round(len(df) / unique_devices, 2) if unique_devices else None,
            "users_per_location": round(unique_users / unique_locations, 2) if unique_locations else None,
        },
        "charts": {
            "amount_histogram": _histogram(transaction_amount, bins=12),
            "balance_histogram": _histogram(account_balance, bins=12),
            "hourly_activity": _hourly_activity(timestamp, transaction_amount, transaction_status),
            "quality_flags": _quality_metrics(df),
            "category_metrics": {
                "payment_method": _category_metrics(df, "payment_method"),
                "merchant_category": _category_metrics(df, "merchant_category"),
                "user_location": _category_metrics(df, "user_location"),
                "transaction_status": _category_metrics(df, "transaction_status"),
            },
        },
    }
