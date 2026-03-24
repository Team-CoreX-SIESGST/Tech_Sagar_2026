from __future__ import annotations

import argparse
import logging
from pathlib import Path

import pandas as pd

from backend import model as model_module
from backend.cleaning import run_cleaning_pipeline
from backend.eda import generate_eda_artifacts
from backend.explain import generate_full_report, save_report
from backend.features import build_features
from backend.model import compute_pseudo_truth_metrics, derive_flagging_threshold, score_fraud
from backend.patterns import detect_patterns

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def run_pipeline(input_path: Path) -> dict:
    """Run the full fraud pipeline on a CSV and save report plus EDA outputs."""
    root = Path(__file__).resolve().parent
    output_dir = root / "output"
    eda_dir = output_dir / "eda"

    raw_df = pd.read_csv(input_path)
    clean_path = output_dir / "clean_transactions.csv"
    cleaned_df, quality_report, cleaning_summary, report_text = run_cleaning_pipeline(raw_df, clean_path)
    patterned_df = detect_patterns(cleaned_df)
    feature_df = build_features(patterned_df)
    scored_df = score_fraud(feature_df)
    threshold = derive_flagging_threshold(scored_df)
    pseudo_metrics = compute_pseudo_truth_metrics(scored_df, threshold)

    model_type = model_module._MODEL_CACHE.model_type if model_module._MODEL_CACHE is not None else "unknown"
    report = generate_full_report(scored_df, threshold=threshold, model_type=model_type)
    report_path = save_report(report, output_dir / "fraud_report.json")
    eda_summary = generate_eda_artifacts(raw_df, cleaned_df, scored_df, eda_dir)

    top_rows = report["top_fraud_transactions"][:5]

    return {
        "clean_path": clean_path,
        "report_path": report_path,
        "quality_report": quality_report,
        "cleaning_summary": cleaning_summary,
        "cleaning_report_text": report_text,
        "threshold": threshold,
        "pseudo_metrics": pseudo_metrics,
        "report": report,
        "eda_summary": eda_summary,
        "top_rows": top_rows,
    }


def main() -> None:
    """CLI entrypoint for judges and local runs."""
    parser = argparse.ArgumentParser(description="Run the fintech fraud pipeline on a CSV file.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "sample.csv",
        help="Path to the input CSV file.",
    )
    args = parser.parse_args()

    result = run_pipeline(args.input)
    summary = result["report"]["summary"]

    print(f"Rows processed: {summary['total_transactions']}")
    print(f"Fraud detected: {summary['fraud_detected']} ({summary['fraud_rate_percent']}%)")
    print(f"Threshold used: {result['threshold']:.6f}")
    print(f"Unique patterns detected: {summary['unique_patterns_detected']}")
    print("Pattern breakdown:")
    for category, count in result["report"]["pattern_breakdown"].items():
        print(f"  {category}: {count}")

    print("Top 5 suspicious transactions:")
    for item in result["top_rows"]:
        print(
            f"  {item['transaction_id']} | score={item['fraud_probability']:.4f} | "
            f"{item['criticality']} | {item['plain_english_reason']}"
        )

    print(f"Fraud report saved to: {result['report_path']}")
    print(f"EDA output directory: {Path(__file__).resolve().parent / 'output' / 'eda'}")


if __name__ == "__main__":
    main()
