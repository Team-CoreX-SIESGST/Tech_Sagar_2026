import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const EDA_DIR = path.join(
  process.cwd(),
  "..",
  "mlpy",
  "output",
  "eda",
);

const friendlyTitle = (fileName) =>
  fileName
    .replace(/\.png$/i, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export async function GET() {
  try {
    const entries = await fs.readdir(EDA_DIR, { withFileTypes: true });
    const charts = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map((entry) => ({
        name: entry.name,
        title: friendlyTitle(entry.name),
        url: `/api/eda/${encodeURIComponent(entry.name)}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ charts });
  } catch {
    return NextResponse.json(
      { error: "EDA output not found. Run the pipeline first." },
      { status: 404 },
    );
  }
}
