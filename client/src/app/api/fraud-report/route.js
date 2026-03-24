import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const REPORT_PATH = path.join(
  process.cwd(),
  "..",
  "mlpy",
  "output",
  "fraud_report.json",
);

export async function GET() {
  try {
    const content = await fs.readFile(REPORT_PATH, "utf8");
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Fraud report not found. Upload a dataset first." },
      { status: 404 },
    );
  }
}
