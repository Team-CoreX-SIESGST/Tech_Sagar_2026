# Tech_Sagar_2026

PARKHI.ai is a fraud-detection workspace built around a Next.js dashboard and a Python pipeline that cleans transaction CSVs, scores suspicious activity, and generates explainable fraud outputs.

## Project Overview

The core flow is:

1. Upload a transaction CSV in the dashboard.
2. Send the file to the Python fraud pipeline.
3. Clean and standardize the dataset.
4. Detect patterns, engineer features, and score fraud risk.
5. View the generated report, KPI summaries, and EDA charts in the UI.

## Repository Layout

```text
Tech_Sagar_2026/
├── client/    # Next.js frontend for the PARKHI.ai experience
├── mlpy/      # FastAPI/Python fraud pipeline and report generator
├── server/    # Supporting API service used by parts of the workspace
└── README.md
```

## Frontend

The frontend lives in `client/` and includes:

- landing page sections for the PARKHI.ai product story
- login and signup screens
- dashboard views for fraud results, EDA, KPIs, and feeds
- API proxy routes for the Python fraud service
- shared UI components, auth context, and custom visualizations

Main routes:

- `/` - landing page
- `/dashboard` - fraud analysis dashboard
- `/fraud-report` - report viewer
- `/eda` - EDA chart viewer
- `/feeds` - content/feed page
- `/kpis` - KPI page

## Python Fraud Pipeline

The Python service in `mlpy/` provides:

- CSV upload via FastAPI
- cleaning and standardization
- fraud pattern detection
- feature engineering
- model scoring and thresholding
- metrics generation
- EDA artifact generation
- fraud report export

API endpoints:

- `POST /upload` - upload a CSV and run the full pipeline
- `GET /kpis` - return KPI summaries from the latest cleaned dataset

## Prerequisites

- Node.js 18+ for `client/`
- Python 3.10+ for `mlpy/`
- Optional integrations depending on the features you use:
  - Gemini API key
  - Cloudinary credentials
  - News API key for feeds

## Environment Variables

Only set the variables you need for the features you use.

### `client/`

- `NEXT_PUBLIC_MLPY_API_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GRAPH_API_URL`
- `NEXT_PUBLIC_LUNA_API_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEWS_API_KEY`

Note: the client code uses a few hard-coded local fallbacks such as `http://localhost:5002` and `http://localhost:5001`. If your local setup uses different ports, set the environment variables accordingly.

### `mlpy/`

- `PORT`

## Local Setup

The client and Python service can be run independently.

### 1. Install dependencies

```bash
cd client
npm install

cd ../mlpy
python -m pip install -r requirements.txt
```

### 2. Start the services

Run the Python API:

```bash
cd mlpy
uvicorn backend.main:app --reload
```

Run the Next.js app:

```bash
cd client
npm run dev
```

## Data And Outputs

The fraud pipeline writes artifacts into `mlpy/output/`, including:

- `fraud_report.json`
- `eda/` charts
- cleaned and scored transaction CSVs

The frontend reads those outputs through its internal API routes.

## Notes

- There are a few existing README files inside subfolders, but this root README is the best place to understand the fraud workspace.
- The `server/` folder is kept as a supporting service for parts of the workspace, but the main documented flow here is the fraud dashboard and Python pipeline.

live link : https://tech-sagar-2026-1-1.onrender.com
