import pandas as pd
from pathlib import Path
from backend.cleaning import run_cleaning_pipeline
from backend.patterns import detect_patterns
from backend.features import build_features
from backend.model import derive_flagging_threshold, score_fraud

root_dir = Path(__file__).resolve().parent
raw_df = pd.read_csv(root_dir / "data" / "sample.csv")
clean_df, _, _, _ = run_cleaning_pipeline(raw_df, root_dir / "clean_transactions.csv")
scored = score_fraud(build_features(detect_patterns(clean_df)))
threshold = derive_flagging_threshold(scored)
flagged = scored.loc[scored["fraud_probability"] >= threshold].copy()

print(f"Total transactions scored: {len(scored)}")
print(f"Threshold used: {threshold:.6f}")
print(f"Fraud flagged count: {len(flagged)}")
print("Pattern breakdown:")
for column in sorted([name for name in scored.columns if name.endswith('_flag')]):
    print(f"  {column}: {int(scored[column].fillna(False).astype(bool).sum())}")

top_view = scored[["transaction_id", "fraud_probability", "patterns_fired"]].head(10).copy()
top_view["fraud_probability"] = top_view["fraud_probability"].round(6)
print("Top 10 transactions:")
print(top_view.to_string(index=False))
