import ipaddress
import logging
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

TEXT_COLUMNS = [
    "user_location",
    "merchant_location",
    "merchant_category",
    "device_type",
    "payment_method",
    "transaction_status",
]

CITY_ALIASES = {
    # Mumbai
    "mumbai": "mumbai",
    "mumb": "mumbai",
    "m": "mumbai",
    "bom": "mumbai",
    "bombay": "mumbai",
    # Bengaluru / Bangalore
    "bengaluru": "bengaluru",
    "bangalore": "bengaluru",
    "bangalo": "bengaluru",
    "beng": "bengaluru",
    "blr": "bengaluru",
    "ba": "bengaluru",
    # Delhi / New Delhi
    "delhi": "delhi",
    "del": "delhi",
    "de": "delhi",
    "new delhi": "delhi",
    # Hyderabad
    "hyderabad": "hyderabad",
    "hyd": "hyderabad",
    "hyde": "hyderabad",
    "hyder": "hyderabad",
    "hyderab": "hyderabad",
    "h": "hyderabad",
    # Chennai
    "chennai": "chennai",
    "chenna": "chennai",
    "che": "chennai",
    "maa": "chennai",
    "madras": "chennai",
    "madr": "chennai",
    # Kolkata
    "kolkata": "kolkata",
    "calcutta": "kolkata",
    "ccu": "kolkata",
    # Jaipur
    "jaipur": "jaipur",
    "jai": "jaipur",
    "j": "jaipur",
    # Lucknow
    "lucknow": "lucknow",
    "luckn": "lucknow",
    "lko": "lucknow",
    "lu": "lucknow",
    "luc": "lucknow",
    "l": "lucknow",
    # Pune
    "pune": "pune",
    "pnq": "pune",
    "pu": "pune",
    "pun": "pune",
    # Ahmedabad
    "ahmedabad": "ahmedabad",
    "amd": "ahmedabad",
    # New York
    "new york": "new york",
    "new yor": "new york",
}

NULL_TOKENS = {"", "null", "none", "nan", "na"}


def generate_quality_report(df: pd.DataFrame) -> Dict:
    """Generate a data quality report for the DataFrame."""
    summary = {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "duplicate_rows": int(df.duplicated().sum()),
    }

    report = []
    for col in df.columns:
        non_null = df[col].dropna()
        example_values = non_null.astype(str).unique()[:3].tolist()
        report.append(
            {
                "column": col,
                "dtype": str(df[col].dtype),
                "missing": int(df[col].isna().sum()),
                "missing_percent": round(float(df[col].isna().mean()) * 100, 2),
                "unique_values": int(df[col].nunique(dropna=True)),
                "duplicate_rows": summary["duplicate_rows"],
                "example_values": example_values,
            }
        )

    return {"summary": summary, "columns": report}


def _clean_amount_series(series: pd.Series) -> pd.Series:
    """Extract numeric values from messy amount strings."""
    s = series.astype("string")
    s = s.str.strip()
    s = s.mask(s.str.lower().isin(NULL_TOKENS))
    s = s.str.replace(",", "", regex=False)
    extracted = s.str.extract(r"([-+]?\d*\.?\d+)")[0]
    return pd.to_numeric(extracted, errors="coerce")


def clean_amount(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, int]]:
    """Clean and reconcile transaction_amount and amt."""
    stats = {"amounts_filled_from_amt": 0}

    if "transaction_amount" in df.columns:
        df["transaction_amount"] = _clean_amount_series(df["transaction_amount"])

    if "amt" in df.columns:
        df["amt"] = _clean_amount_series(df["amt"])

    if "transaction_amount" in df.columns and "amt" in df.columns:
        fill_mask = df["transaction_amount"].isna() & df["amt"].notna()
        stats["amounts_filled_from_amt"] = int(fill_mask.sum())
        df.loc[fill_mask, "transaction_amount"] = df.loc[fill_mask, "amt"]

    if "transaction_amount" in df.columns:
        df["is_amount_missing"] = df["transaction_amount"].isna()

    return df, stats


def _parse_datetime_series(series: pd.Series) -> pd.Series:
    """Parse mixed-format timestamps into pandas datetime."""
    s = series.astype("string").str.strip()
    numeric_mask = s.str.match(r"^\d+$", na=False)

    result = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")

    if numeric_mask.any():
        numeric_vals = s[numeric_mask]
        lengths = numeric_vals.str.len()
        mask14 = lengths == 14  # YYYYMMDDHHMMSS
        mask13 = lengths == 13  # epoch milliseconds
        mask10 = lengths == 10  # epoch seconds
        mask8 = lengths == 8    # YYYYMMDD

        if mask14.any():
            result.loc[numeric_vals.index[mask14]] = pd.to_datetime(
                numeric_vals[mask14], format="%Y%m%d%H%M%S", errors="coerce"
            )
        if mask13.any():
            result.loc[numeric_vals.index[mask13]] = pd.to_datetime(
                numeric_vals[mask13].astype("int64"), unit="ms", errors="coerce"
            )
        if mask10.any():
            result.loc[numeric_vals.index[mask10]] = pd.to_datetime(
                numeric_vals[mask10].astype("int64"), unit="s", errors="coerce"
            )
        if mask8.any():
            result.loc[numeric_vals.index[mask8]] = pd.to_datetime(
                numeric_vals[mask8], format="%Y%m%d", errors="coerce"
            )

        other_mask = ~(mask14 | mask13 | mask10 | mask8)
        if other_mask.any():
            result.loc[numeric_vals.index[other_mask]] = pd.to_datetime(
                numeric_vals[other_mask], errors="coerce"
            )

    non_numeric = s[~numeric_mask]
    if not non_numeric.empty:
        parsed = pd.to_datetime(non_numeric, errors="coerce", format="mixed")
        # Retry day-first for remaining NaT values.
        retry_mask = parsed.isna()
        if retry_mask.any():
            parsed.loc[retry_mask] = pd.to_datetime(
                non_numeric.loc[retry_mask],
                errors="coerce",
                format="mixed",
                dayfirst=True,
            )
        result.loc[non_numeric.index] = parsed

    return result


def clean_timestamp(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Clean and enforce datetime for transaction_timestamp; drop invalid rows."""
    if "transaction_timestamp" not in df.columns:
        return df, 0

    before_rows = len(df)
    df["transaction_timestamp"] = _parse_datetime_series(df["transaction_timestamp"])
    df = df.loc[df["transaction_timestamp"].notna()].copy()
    invalid_removed = before_rows - len(df)
    return df, int(invalid_removed)


def _normalize_series(series: pd.Series) -> pd.Series:
    """Normalize text by lowering, trimming, and removing special chars."""
    s = series.astype("string")
    s = s.str.strip().str.lower()
    s = s.str.replace(r"[^a-z0-9\s]", "", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True)
    s = s.replace("", pd.NA)
    return s


def normalize_text(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Normalize text columns and standardize city names."""
    filled_count = 0
    for col in TEXT_COLUMNS:
        if col in df.columns:
            df[col] = _normalize_series(df[col])

    # City standardization for location columns.
    for col in ["user_location", "merchant_location"]:
        if col in df.columns:
            df[col] = df[col].replace(CITY_ALIASES)

    # Fill missing categorical values with "unknown".
    for col in TEXT_COLUMNS:
        if col in df.columns:
            missing = int(df[col].isna().sum())
            if missing:
                df[col] = df[col].fillna("unknown")
                filled_count += missing

    return df, filled_count


def validate_ip(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Validate IP addresses and add is_valid_ip column."""
    if "ip_address" not in df.columns:
        return df, 0

    def _is_valid_ip(value) -> bool:
        if pd.isna(value):
            return False
        try:
            ipaddress.ip_address(str(value).strip())
            return True
        except ValueError:
            return False

    df["is_valid_ip"] = df["ip_address"].apply(_is_valid_ip)
    invalid_count = int((~df["is_valid_ip"]).sum())
    return df, invalid_count


def clean_device_id(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Standardize and validate device_id values."""
    if "device_id" not in df.columns:
        return df, 0

    s = df["device_id"].astype("string").str.strip().str.upper()
    s = s.mask(s.str.lower().isin(NULL_TOKENS))
    df["device_id"] = s

    # Expected pattern from sample: DEV-XXXXXXXX (8 alnum chars).
    valid_mask = s.str.match(r"^DEV-[A-Z0-9]{8}$", na=False)
    df["is_device_id_invalid"] = ~valid_mask

    invalid_count = int(df["is_device_id_invalid"].sum())
    return df, invalid_count


def handle_duplicates(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Remove exact duplicates and duplicate transaction_id, keeping most recent."""
    before = len(df)

    if "transaction_timestamp" in df.columns:
        df = df.sort_values("transaction_timestamp")

    df = df.drop_duplicates(keep="last")

    if "transaction_id" in df.columns:
        df = df.drop_duplicates(subset=["transaction_id"], keep="last")

    removed = before - len(df)
    return df, int(removed)


def detect_outliers(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Detect outliers using the IQR method."""
    if "transaction_amount" not in df.columns:
        return df, 0

    amounts = df["transaction_amount"].dropna()
    if amounts.empty:
        df["is_amount_outlier"] = False
        return df, 0

    q1 = amounts.quantile(0.25)
    q3 = amounts.quantile(0.75)
    iqr = q3 - q1

    if iqr == 0:
        df["is_amount_outlier"] = False
        return df, 0

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    df["is_amount_outlier"] = df["transaction_amount"].apply(
        lambda x: False if pd.isna(x) else (x < lower or x > upper)
    )
    outliers = int(df["is_amount_outlier"].sum())
    return df, outliers


def fix_dtypes(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure correct data types for key columns."""
    if "transaction_id" in df.columns:
        df["transaction_id"] = df["transaction_id"].astype("string")
    if "user_id" in df.columns:
        df["user_id"] = df["user_id"].astype("string")
    if "transaction_amount" in df.columns:
        df["transaction_amount"] = pd.to_numeric(df["transaction_amount"], errors="coerce")
    if "account_balance" in df.columns:
        df["account_balance"] = pd.to_numeric(df["account_balance"], errors="coerce")
    if "transaction_timestamp" in df.columns:
        df["transaction_timestamp"] = pd.to_datetime(df["transaction_timestamp"], errors="coerce")
    return df


def generate_cleaning_summary(
    rows_before: int,
    rows_after: int,
    duplicates_removed: int,
    invalid_timestamps_removed: int,
    missing_values_filled: int,
    invalid_ips_detected: int,
    outliers_detected: int,
) -> Dict[str, int]:
    """Compile cleaning summary metrics."""
    return {
        "rows_before_cleaning": int(rows_before),
        "rows_after_cleaning": int(rows_after),
        "duplicates_removed": int(duplicates_removed),
        "invalid_timestamps_removed": int(invalid_timestamps_removed),
        "missing_values_filled": int(missing_values_filled),
        "invalid_ips_detected": int(invalid_ips_detected),
        "outliers_detected": int(outliers_detected),
    }


def print_cleaning_report(cleaning_summary: Dict[str, int]) -> str:
    """Build a human-readable cleaning summary report."""
    lines = [
        "DATA CLEANING SUMMARY",
        "",
        f"Rows before cleaning: {cleaning_summary['rows_before_cleaning']}",
        f"Rows after cleaning: {cleaning_summary['rows_after_cleaning']}",
        f"Duplicate rows removed: {cleaning_summary['duplicates_removed']}",
        f"Invalid timestamps removed: {cleaning_summary['invalid_timestamps_removed']}",
        f"Missing values filled: {cleaning_summary['missing_values_filled']}",
        f"Invalid IP addresses detected: {cleaning_summary['invalid_ips_detected']}",
        f"Outliers detected: {cleaning_summary['outliers_detected']}",
    ]
    return "\n".join(lines)


def run_cleaning_pipeline(df: pd.DataFrame, output_path: Path) -> Tuple[pd.DataFrame, Dict, Dict, str]:
    """Run the full data cleaning pipeline and save the cleaned dataset."""
    rows_before = len(df)
    quality_report = generate_quality_report(df)

    df, amount_stats = clean_amount(df)
    df, invalid_timestamps_removed = clean_timestamp(df)
    df, missing_categorical_filled = normalize_text(df)
    df, _device_id_invalid = clean_device_id(df)
    df, duplicates_removed = handle_duplicates(df)
    df, invalid_ips_detected = validate_ip(df)
    df, outliers_detected = detect_outliers(df)
    df = fix_dtypes(df)

    missing_values_filled = amount_stats.get("amounts_filled_from_amt", 0) + missing_categorical_filled

    cleaning_summary = generate_cleaning_summary(
        rows_before=rows_before,
        rows_after=len(df),
        duplicates_removed=duplicates_removed,
        invalid_timestamps_removed=invalid_timestamps_removed,
        missing_values_filled=missing_values_filled,
        invalid_ips_detected=invalid_ips_detected,
        outliers_detected=outliers_detected,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info("Cleaned dataset saved to %s", output_path)

    report_text = print_cleaning_report(cleaning_summary)
    return df, quality_report, cleaning_summary, report_text
