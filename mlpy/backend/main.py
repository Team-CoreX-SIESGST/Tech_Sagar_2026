from pathlib import Path

import io
import logging
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException

try:
    from .cleaning import run_cleaning_pipeline
except ImportError:  # Allows running as a script without package context.
    from cleaning import run_cleaning_pipeline

app = FastAPI()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload endpoint that accepts a CSV, runs the cleaning pipeline,
    saves clean_transactions.csv, and returns reports.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        logger.error("Failed to read uploaded CSV: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid CSV file.")

    output_path = Path(__file__).resolve().parents[1] / "clean_transactions.csv"
    _, quality_report, cleaning_summary, report_text = run_cleaning_pipeline(df, output_path)

    return {
        "quality_report": quality_report,
        "cleaning_summary": cleaning_summary,
        "cleaning_report_text": report_text,
        "cleaned_file_path": str(output_path),
    }
