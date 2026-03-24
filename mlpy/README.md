# FinTech Fraud Detection Hackathon

This project runs a fraud pipeline for noisy transaction datasets:

`cleaning -> pattern detection -> feature engineering -> anomaly/classifier scoring -> explanation/reporting -> EDA`

## Install

```bash
cd /Users/umairmomin/Desktop/Tech_Sagar_2026/mlpy
python -m pip install -r requirements.txt
```

If `lightgbm` fails on macOS, install OpenMP first:

```bash
brew install libomp
python -m pip install lightgbm
```

## Run The Pipeline

Run on the sample dataset:

```bash
python run_pipeline.py
```

Run on any CSV:

```bash
python run_pipeline.py --input /absolute/path/to/your_dataset.csv
```

Outputs are written to:

- `/Users/umairmomin/Desktop/Tech_Sagar_2026/mlpy/output/fraud_report.json`
- `/Users/umairmomin/Desktop/Tech_Sagar_2026/mlpy/output/eda/`
- `/Users/umairmomin/Desktop/Tech_Sagar_2026/mlpy/output/scored_transactions.csv`

## Start The API

```bash
uvicorn backend.main:app --reload
```

Then upload a CSV to the `/upload` endpoint.

## Upload Endpoint

Example with `curl`:

```bash
curl -X POST "http://127.0.0.1:8000/upload" \
  -F "file=@/Users/umairmomin/Desktop/Tech_Sagar_2026/mlpy/data/sample.csv"
```

The API returns:

- fraud counts and score threshold
- pseudo metrics
- top suspicious transactions with explanations
- pattern breakdown
- paths to the saved fraud report and EDA outputs

## Dashboard

The backend now generates JSON and chart artifacts that a dashboard can consume:

- `output/fraud_report.json`
- `output/eda/*.png`

If you have a separate React dashboard, point it at those outputs or the `/upload` response.
