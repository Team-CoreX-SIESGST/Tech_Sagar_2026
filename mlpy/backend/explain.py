from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .model import derive_flagging_threshold

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"
DEFAULT_REPORT_PATH = OUTPUT_DIR / "fraud_report.json"

SIGNAL_LABELS: dict[str, str] = {
    "patterns_fired": "Pattern count",
    "pattern_score": "Pattern score",
    "cleaning_flag_score": "Cleaning quality risk",
    "sudden_large_transaction_flag": "Amount spike",
    "micro_transaction_payment_flag": "Micro-transaction",
    "zero_or_missing_amount_flag": "Zero or missing amount",
    "category_amount_mismatch_flag": "Category amount mismatch",
    "location_mismatch_flag": "Location mismatch",
    "new_merchant_city_flag": "New merchant city",
    "shared_device_flag": "Shared device",
    "shared_ip_flag": "Shared IP",
    "new_device_for_user_flag": "New device",
    "user_location_pattern_deviation_flag": "User location deviation",
    "odd_hour_high_amount_flag": "Odd-hour high amount",
    "rapid_repeat_5s_flag": "Rapid repeat",
    "failed_to_success_retry_flag": "Failed then success retry",
    "amount_exceeds_balance_flag": "Amount exceeds balance",
    "high_balance_utilization_flag": "High balance utilization",
    "successful_overdraft_flag": "Successful overdraft",
    "success_unusual_context_flag": "Success in unusual context",
    "malformed_ip_flag": "Malformed IP",
    "invalid_device_flag": "Invalid device",
    "amount_user_zscore": "User amount deviation",
    "amount_balance_ratio": "Amount-to-balance ratio",
    "users_per_device": "Users per device",
    "users_per_ip": "Users per IP",
    "time_since_last_transaction": "Time since last transaction",
    "anomaly_score": "Anomaly score",
    "fraud_probability": "Fraud probability",
}

SIGNAL_DESCRIPTIONS: dict[str, str] = {
    "patterns_fired": "{patterns_fired:.0f} fraud patterns fired on this transaction.",
    "pattern_score": "The rule-based pattern score reached {pattern_score:.0f}.",
    "cleaning_flag_score": "Data cleaning raised {cleaning_flag_score:.0f} quality flags.",
    "sudden_large_transaction_flag": "Amount was {amount_to_user_average_ratio:.1f}x the user's historical average.",
    "micro_transaction_payment_flag": "Small-value transaction on {payment_method} resembles probe behavior.",
    "zero_or_missing_amount_flag": "Amount is zero or missing, which is unusual for a completed transaction.",
    "category_amount_mismatch_flag": "Amount looks unusually large for the {merchant_category} category.",
    "location_mismatch_flag": "User city and merchant city do not match.",
    "new_merchant_city_flag": "This is the first transaction in a new merchant city for the user.",
    "shared_device_flag": "Device is shared across {users_per_device:.0f} user accounts.",
    "shared_ip_flag": "IP address is shared across {users_per_ip:.0f} user accounts.",
    "new_device_for_user_flag": "User is transacting from a device not seen before.",
    "user_location_pattern_deviation_flag": "User location deviates from their usual city pattern.",
    "odd_hour_high_amount_flag": "High-value transaction occurred during the unusual {transaction_hour}:00 hour.",
    "rapid_repeat_5s_flag": "Another transaction from this user happened within 5 seconds.",
    "failed_to_success_retry_flag": "A failed attempt was followed by a near-identical success shortly after.",
    "amount_exceeds_balance_flag": "Transaction amount exceeds the recorded account balance.",
    "high_balance_utilization_flag": "Transaction consumes more than 80% of the account balance.",
    "successful_overdraft_flag": "Transaction succeeded even though the amount exceeded balance.",
    "success_unusual_context_flag": "Transaction succeeded despite multiple unusual context signals.",
    "malformed_ip_flag": "IP address is malformed or invalid.",
    "invalid_device_flag": "Device identifier format is invalid.",
    "amount_user_zscore": "Amount is {amount_user_zscore:.1f} standard deviations from the user's norm.",
    "amount_balance_ratio": "Amount is {amount_balance_ratio:.2f} of the available balance.",
    "users_per_device": "Device is linked to {users_per_device:.0f} users.",
    "users_per_ip": "IP is linked to {users_per_ip:.0f} users.",
    "time_since_last_transaction": "Time since the user's previous transaction was {time_since_last_transaction:.0f} seconds.",
    "anomaly_score": "Anomaly detector score reached {anomaly_score:.2f}.",
    "fraud_probability": "Final fraud probability is {fraud_probability:.2f}.",
}

PATTERN_CATEGORIES: dict[str, str] = {
    "sudden_large_transaction_flag": "amount",
    "micro_transaction_payment_flag": "amount",
    "zero_or_missing_amount_flag": "amount",
    "category_amount_mismatch_flag": "amount",
    "location_mismatch_flag": "location",
    "new_merchant_city_flag": "location",
    "user_location_pattern_deviation_flag": "location",
    "shared_device_flag": "device",
    "new_device_for_user_flag": "device",
    "invalid_device_flag": "device",
    "shared_ip_flag": "device",
    "malformed_ip_flag": "device",
    "odd_hour_high_amount_flag": "velocity",
    "rapid_repeat_5s_flag": "velocity",
    "failed_to_success_retry_flag": "status",
    "success_unusual_context_flag": "status",
    "amount_exceeds_balance_flag": "balance",
    "high_balance_utilization_flag": "balance",
    "successful_overdraft_flag": "balance",
}


def assign_criticality(fraud_probability: float) -> str:
    """Assign a dashboard-friendly severity bucket."""
    if fraud_probability >= 0.85:
        return "critical"
    if fraud_probability >= 0.65:
        return "high"
    if fraud_probability >= 0.45:
        return "medium"
    return "low"


def _safe_value(row: pd.Series, key: str, default: Any = 0) -> Any:
    value = row.get(key, default)
    if pd.isna(value):
        return default
    return value


def _render_signal_description(signal: str, row: pd.Series) -> str:
    template = SIGNAL_DESCRIPTIONS.get(signal, f"{SIGNAL_LABELS.get(signal, signal)} contributed to the score.")
    context = {
        "patterns_fired": _safe_value(row, "patterns_fired", 0),
        "pattern_score": _safe_value(row, "pattern_score", 0),
        "cleaning_flag_score": _safe_value(row, "cleaning_flag_score", 0),
        "amount_to_user_average_ratio": _safe_value(row, "amount_to_user_average_ratio", 0.0),
        "payment_method": _safe_value(row, "payment_method", "unknown"),
        "merchant_category": _safe_value(row, "merchant_category", "unknown"),
        "users_per_device": _safe_value(row, "users_per_device", 0.0),
        "users_per_ip": _safe_value(row, "users_per_ip", 0.0),
        "transaction_hour": _safe_value(row, "transaction_hour", 0),
        "amount_user_zscore": _safe_value(row, "amount_user_zscore", 0.0),
        "amount_balance_ratio": _safe_value(row, "amount_balance_ratio", 0.0),
        "time_since_last_transaction": _safe_value(row, "time_since_last_transaction", 0.0),
        "anomaly_score": _safe_value(row, "anomaly_score", 0.0),
        "fraud_probability": _safe_value(row, "fraud_probability", 0.0),
    }
    try:
        return template.format(**context)
    except Exception:
        return SIGNAL_LABELS.get(signal, signal)


def _signal_severity(signal: str, row: pd.Series) -> str:
    if signal in {"successful_overdraft_flag", "amount_exceeds_balance_flag", "success_unusual_context_flag"}:
        return "high"
    if signal in {"shared_device_flag", "shared_ip_flag", "new_device_for_user_flag", "user_location_pattern_deviation_flag"}:
        return "high"
    if signal in {"odd_hour_high_amount_flag", "failed_to_success_retry_flag", "sudden_large_transaction_flag"}:
        return "medium"
    if signal == "fraud_probability" and _safe_value(row, "fraud_probability", 0.0) >= 0.85:
        return "high"
    return "medium"


def generate_explanation(row: pd.Series) -> dict[str, Any]:
    """Create a human-readable explanation payload for one scored transaction."""
    top_signals = row.get("top_signals", [])
    if not isinstance(top_signals, list):
        top_signals = []

    signal_details = []
    for signal in top_signals[:3]:
        signal_details.append(
            {
                "signal": signal,
                "label": SIGNAL_LABELS.get(signal, signal.replace("_", " ").title()),
                "description": _render_signal_description(signal, row),
                "severity": _signal_severity(signal, row),
            }
        )

    reason_parts = [detail["description"] for detail in signal_details[:3]]
    plain_english_reason = (
        "This transaction is suspicious because " + " ".join(reason_parts)
        if reason_parts
        else "This transaction scored high on the anomaly and pattern detectors."
    )

    return {
        "transaction_id": _safe_value(row, "transaction_id", ""),
        "user_id": _safe_value(row, "user_id", ""),
        "payment_method": _safe_value(row, "payment_method", "unknown"),
        "device_id": _safe_value(row, "device_id", "unknown"),
        "transaction_timestamp": str(_safe_value(row, "transaction_timestamp", "")),
        "user_location": _safe_value(row, "user_location", "unknown"),
        "merchant_location": _safe_value(row, "merchant_location", "unknown"),
        "fraud_probability": round(float(_safe_value(row, "fraud_probability", 0.0)), 4),
        "criticality": assign_criticality(float(_safe_value(row, "fraud_probability", 0.0))),
        "patterns_fired": int(_safe_value(row, "patterns_fired", 0)),
        "top_signals": top_signals[:3],
        "signal_details": signal_details,
        "plain_english_reason": plain_english_reason,
        "raw_values": {
            "transaction_amount": _safe_value(row, "transaction_amount", 0.0),
            "user_avg_amount": _safe_value(row, "user_avg_amount", 0.0),
            "fraud_probability": round(float(_safe_value(row, "fraud_probability", 0.0)), 4),
            "patterns_fired": int(_safe_value(row, "patterns_fired", 0)),
            "transaction_hour": int(_safe_value(row, "transaction_hour", 0)),
            "users_per_ip": float(_safe_value(row, "users_per_ip", 0.0)),
            "users_per_device": float(_safe_value(row, "users_per_device", 0.0)),
            "account_balance": _safe_value(row, "account_balance", 0.0),
            "user_id": _safe_value(row, "user_id", ""),
            "payment_method": _safe_value(row, "payment_method", "unknown"),
            "device_id": _safe_value(row, "device_id", "unknown"),
            "transaction_timestamp": str(_safe_value(row, "transaction_timestamp", "")),
            "user_location": _safe_value(row, "user_location", "unknown"),
            "merchant_location": _safe_value(row, "merchant_location", "unknown"),
        },
    }


def generate_full_report(
    scored_df: pd.DataFrame,
    threshold: float | None = None,
    model_type: str | None = None,
) -> dict[str, Any]:
    """Generate a full JSON-serializable fraud report from scored transactions."""
    if threshold is None:
        threshold = derive_flagging_threshold(scored_df)

    flagged_mask = scored_df["fraud_probability"].ge(threshold)
    criticality = scored_df["fraud_probability"].apply(lambda value: assign_criticality(float(value)))

    pattern_flags = [column for column in scored_df.columns if column.endswith("_flag")]
    unique_patterns_detected = int(
        sum(int(scored_df[column].fillna(False).astype(bool).any()) for column in pattern_flags)
    )
    pattern_breakdown: dict[str, int] = {}
    for category in sorted(set(PATTERN_CATEGORIES.values())):
        category_flags = [flag for flag, flag_category in PATTERN_CATEGORIES.items() if flag_category == category and flag in scored_df.columns]
        if not category_flags:
            pattern_breakdown[category] = 0
            continue
        pattern_breakdown[category] = int(
            scored_df[category_flags].fillna(False).astype(bool).any(axis=1).sum()
        )

    explained_top = [
        generate_explanation(row)
        for _, row in scored_df.head(50).iterrows()
    ]
    all_transactions = []
    for _, row in scored_df.iterrows():
        explanation = generate_explanation(row)
        all_transactions.append(
            {
                "transaction_id": explanation["transaction_id"],
                "fraud_probability": explanation["fraud_probability"],
                "criticality": explanation["criticality"],
                "patterns_fired": explanation["patterns_fired"],
                "plain_english_reason": explanation["plain_english_reason"],
            }
        )

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "summary": {
            "total_transactions": int(len(scored_df)),
            "fraud_detected": int(flagged_mask.sum()),
            "critical_count": int((criticality == "critical").sum()),
            "high_count": int((criticality == "high").sum()),
            "medium_count": int((criticality == "medium").sum()),
            "fraud_rate_percent": round(float(flagged_mask.mean() * 100), 2) if len(scored_df) else 0.0,
            "patterns_fired_total": int(scored_df.get("patterns_fired", pd.Series(0, index=scored_df.index)).sum()),
            "unique_patterns_detected": unique_patterns_detected,
        },
        "model_info": {
            "model_type": model_type or "unknown",
            "contamination_rate": 0.11,
            "scoring_formula": "0.55×classifier + 0.30×anomaly + 0.15×pattern",
            "threshold_used": round(float(threshold), 6),
        },
        "pattern_breakdown": pattern_breakdown,
        "top_fraud_transactions": explained_top,
        "all_transactions": all_transactions,
    }
    return report


def save_report(report: dict[str, Any], output_path: Path | None = None) -> Path:
    """Persist the fraud report as valid JSON."""
    path = output_path or DEFAULT_REPORT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, default=str))
    logger.info("Saved fraud report to %s", path)
    return path
