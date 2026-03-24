import { NextResponse } from "next/server";

const MLPY_API_URL =
  process.env.NEXT_PUBLIC_MLPY_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const backendResponse = await fetch(`${MLPY_API_URL}/kpis`, {
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          error: data?.detail || data?.error || "Failed to load KPIs",
        },
        { status: backendResponse.status },
      );
    }

    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error("Error forwarding KPI request:", error);
    return NextResponse.json({ error: "Failed to load KPIs" }, { status: 500 });
  }
}
