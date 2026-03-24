from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

_MPLCONFIGDIR = Path(__file__).resolve().parents[1] / "output" / ".mplconfig"
_MPLCONFIGDIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_MPLCONFIGDIR))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _save_figure(fig: plt.Figure, output_path: Path) -> str:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return str(output_path)


def _plot_series_bar(series: pd.Series, title: str, xlabel: str, output_path: Path) -> str:
    fig, ax = plt.subplots(figsize=(10, 5))
    series.plot(kind="bar", ax=ax, color="#1f77b4")
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=45)
    return _save_figure(fig, output_path)


def _plot_hist(series: pd.Series, title: str, xlabel: str, output_path: Path, bins: int = 40) -> str:
    fig, ax = plt.subplots(figsize=(10, 5))
    cleaned = pd.to_numeric(series, errors="coerce").dropna()
    ax.hist(cleaned, bins=bins, color="#2ca02c", alpha=0.85)
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Frequency")
    return _save_figure(fig, output_path)


def generate_eda_artifacts(
    raw_df: pd.DataFrame,
    cleaned_df: pd.DataFrame,
    scored_df: pd.DataFrame,
    output_dir: Path,
) -> dict[str, Any]:
    """Generate and save compact EDA charts and summary stats for the dataset."""
    logger.info("Generating EDA artifacts in %s", output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    chart_paths: dict[str, str] = {}

    missing_counts = raw_df.isna().sum().sort_values(ascending=False)
    chart_paths["missing_values"] = _plot_series_bar(
        missing_counts.head(12),
        "Missing Values by Column",
        "Column",
        output_dir / "missing_values.png",
    )

    if "transaction_amount" in cleaned_df.columns:
        chart_paths["transaction_amount_hist"] = _plot_hist(
            cleaned_df["transaction_amount"],
            "Transaction Amount Distribution",
            "Transaction Amount",
            output_dir / "transaction_amount_hist.png",
        )
        chart_paths["transaction_amount_log_hist"] = _plot_hist(
            np.log1p(pd.to_numeric(cleaned_df["transaction_amount"], errors="coerce").clip(lower=0)),
            "Log Transaction Amount Distribution",
            "log(1 + transaction amount)",
            output_dir / "transaction_amount_log_hist.png",
        )

    if "account_balance" in cleaned_df.columns:
        chart_paths["account_balance_hist"] = _plot_hist(
            cleaned_df["account_balance"],
            "Account Balance Distribution",
            "Account Balance",
            output_dir / "account_balance_hist.png",
        )

    if "fraud_probability" in scored_df.columns:
        chart_paths["fraud_probability_hist"] = _plot_hist(
            scored_df["fraud_probability"],
            "Fraud Probability Distribution",
            "Fraud Probability",
            output_dir / "fraud_probability_hist.png",
        )

    if "patterns_fired" in scored_df.columns:
        chart_paths["patterns_fired_hist"] = _plot_hist(
            scored_df["patterns_fired"],
            "Patterns Fired Distribution",
            "Patterns Fired",
            output_dir / "patterns_fired_hist.png",
            bins=15,
        )

    for column in ["transaction_status", "payment_method", "merchant_category"]:
        if column in cleaned_df.columns:
            counts = cleaned_df[column].astype("string").fillna("unknown").value_counts().head(10)
            chart_paths[f"{column}_counts"] = _plot_series_bar(
                counts,
                f"{column.replace('_', ' ').title()} Counts",
                column.replace("_", " ").title(),
                output_dir / f"{column}_counts.png",
            )

    if "transaction_timestamp" in cleaned_df.columns:
        hours = pd.to_datetime(cleaned_df["transaction_timestamp"], errors="coerce").dt.hour.fillna(0).astype(int)
        chart_paths["hour_of_day"] = _plot_series_bar(
            hours.value_counts().sort_index(),
            "Transactions by Hour of Day",
            "Hour",
            output_dir / "hour_of_day.png",
        )

    if {"user_location", "merchant_location"}.issubset(cleaned_df.columns):
        mismatch = (
            cleaned_df.assign(location_mismatch=cleaned_df["user_location"] != cleaned_df["merchant_location"])["location_mismatch"]
            .value_counts()
            .rename(index={True: "Mismatch", False: "Match"})
        )
        chart_paths["location_mismatch"] = _plot_series_bar(
            mismatch,
            "User vs Merchant Location Match",
            "Location Relationship",
            output_dir / "location_mismatch.png",
        )

    numeric_cols = [
        col
        for col in [
            "transaction_amount",
            "account_balance",
            "amount_user_zscore",
            "amount_balance_ratio",
            "patterns_fired",
            "fraud_probability",
        ]
        if col in scored_df.columns
    ]
    if len(numeric_cols) >= 2:
        corr = scored_df[numeric_cols].apply(pd.to_numeric, errors="coerce").corr()
        fig, ax = plt.subplots(figsize=(8, 6))
        cax = ax.imshow(corr, cmap="Blues", interpolation="nearest")
        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.index)))
        ax.set_xticklabels(corr.columns, rotation=45, ha="right")
        ax.set_yticklabels(corr.index)
        ax.set_title("Numeric Feature Correlation Heatmap")
        fig.colorbar(cax, ax=ax, fraction=0.046, pad=0.04)
        chart_paths["correlation_heatmap"] = _save_figure(fig, output_dir / "correlation_heatmap.png")

    summary = {
        "raw_rows": int(len(raw_df)),
        "cleaned_rows": int(len(cleaned_df)),
        "scored_rows": int(len(scored_df)),
        "rows_dropped_during_cleaning": int(len(raw_df) - len(cleaned_df)),
        "missing_values_total": int(raw_df.isna().sum().sum()),
        "amount_missing_after_cleaning": int(cleaned_df.get("is_amount_missing", pd.Series(dtype=int)).sum()) if "is_amount_missing" in cleaned_df.columns else 0,
        "invalid_ip_after_cleaning": int((~cleaned_df.get("is_valid_ip", pd.Series(True, index=cleaned_df.index))).sum()) if "is_valid_ip" in cleaned_df.columns else 0,
        "invalid_device_after_cleaning": int(cleaned_df.get("is_device_id_invalid", pd.Series(0, index=cleaned_df.index)).sum()) if "is_device_id_invalid" in cleaned_df.columns else 0,
        "chart_paths": chart_paths,
    }
    return summary
