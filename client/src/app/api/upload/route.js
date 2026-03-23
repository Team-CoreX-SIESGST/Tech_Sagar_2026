import { NextResponse } from "next/server"

const MLPY_API_URL =
  process.env.NEXT_PUBLIC_MLPY_API_URL || "http://127.0.0.1:8000"

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 })
    }

    const backendResponse = await fetch(`${MLPY_API_URL}/upload`, {
      method: "POST",
      body: formData,
    })

    const data = await backendResponse.json().catch(() => ({}))

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          error: data?.detail || data?.error || "Upload failed",
        },
        { status: backendResponse.status },
      )
    }

    return NextResponse.json(data, { status: backendResponse.status })
  } catch (error) {
    console.error("Error forwarding upload request:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
