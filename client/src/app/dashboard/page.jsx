"use client"

import { useRef, useState } from "react"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react"

const sections = [
  { id: "upload-file", label: "Upload File", icon: Upload },
  { id: "kpi", label: "KPI", icon: BarChart3 },
]

const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0)

function DashboardPage() {
  const fileInputRef = useRef(null)
  const sectionRefs = useRef({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [uploadResult, setUploadResult] = useState(null)
  const [activeSection, setActiveSection] = useState("upload-file")

  const cleaningSummary = uploadResult?.cleaning_summary || {}
  const qualityReport = uploadResult?.quality_report || {}
  const qualityColumns = Array.isArray(qualityReport.columns) ? qualityReport.columns : []

  const derivedMetrics = (() => {
    const rowsBefore = Number(cleaningSummary.rows_before_cleaning || qualityReport?.summary?.rows || 0)
    const rowsAfter = Number(cleaningSummary.rows_after_cleaning || 0)
    const duplicatesRemoved = Number(cleaningSummary.duplicates_removed || 0)
    const invalidTimestamps = Number(cleaningSummary.invalid_timestamps_removed || 0)
    const invalidIps = Number(cleaningSummary.invalid_ips_detected || 0)
    const outliersDetected = Number(cleaningSummary.outliers_detected || 0)
    const missingFilled = Number(cleaningSummary.missing_values_filled || 0)
    const columnsAnalyzed = Number(qualityReport?.summary?.columns || 0)

    return {
      rowsBefore,
      rowsAfter,
      duplicatesRemoved,
      invalidTimestamps,
      invalidIps,
      outliersDetected,
      missingFilled,
      columnsAnalyzed,
    }
  })()

  const navigateToSection = (sectionId) => {
    setActiveSection(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleFile = (file) => {
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.")
      setSelectedFile(null)
      return
    }

    setError("")
    setSelectedFile(file)
    setUploadResult(null)
  }

  const handleFileChange = (event) => {
    handleFile(event.target.files?.[0])
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const submitUpload = async () => {
    if (!selectedFile) {
      setError("Choose a CSV file first.")
      return
    }

    try {
      setIsUploading(true)
      setError("")

      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Upload failed.")
      }

      setUploadResult(data)
      setActiveSection("kpi")
      sectionRefs.current.kpi?.scrollIntoView({ behavior: "smooth", block: "start" })
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.")
    } finally {
      setIsUploading(false)
    }
  }

  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="sticky top-24 h-fit rounded-3xl border border-border bg-card/80 p-4 shadow-xl backdrop-blur">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 via-card to-card p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">Dashboard</p>
              <h1 className="mt-3 font-serif text-2xl text-foreground">PARKHI.ai</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a CSV, inspect the cleaning KPIs, and review the cleaned results in one place.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => navigateToSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                      isActive
                        ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/25 hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/15 bg-background/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{section.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground">Status</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upload pipeline</span>
                <span className="pill-badge">{isUploading ? "Processing" : "Ready"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selected file</span>
                <span className="max-w-[120px] truncate text-sm text-foreground">
                  {selectedFile ? selectedFile.name : "None"}
                </span>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section
              ref={(node) => {
                sectionRefs.current["upload-file"] = node
              }}
              id="upload-file"
              className="scroll-mt-28 rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur md:p-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="pill-badge">Upload File</p>
                  <h2 className="mt-4 font-serif text-3xl text-foreground">Drop a CSV to start analysis</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Drag and drop your dataset here or choose a file manually. The backend will clean the data and return KPI-ready metrics.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedFile ? selectedFile.name : "No file selected"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV only, sent to `/upload` in `mlpy/backend/main.py`
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                onDragEnter={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                }}
                onDrop={handleDrop}
                className={cn(
                  "mt-6 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all md:px-10",
                  dragActive
                    ? "border-primary bg-primary/10"
                    : "border-border bg-gradient-to-br from-background via-background to-muted/30",
                )}
              >
                <div className="mx-auto flex max-w-2xl flex-col items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <FileUp className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl text-foreground">
                    {dragActive ? "Release to upload" : "Drag and drop your CSV here"}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    The file will be posted to the backend `/upload` route and the cleaned results will populate the dashboard automatically.
                  </p>

                  <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
                    <Button type="button" onClick={openFilePicker} variant="outline" className="rounded-full px-5">
                      Choose file
                    </Button>
                    <Button
                      type="button"
                      onClick={submitUpload}
                      disabled={!selectedFile || isUploading}
                      className="rounded-full px-5"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUploading ? "Uploading..." : "Upload to backend"}
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {selectedFile ? (
                    <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
                      Ready to upload <span className="font-medium">{selectedFile.name}</span>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section
              ref={(node) => {
                sectionRefs.current.kpi = node
              }}
              id="kpi"
              className="scroll-mt-28 rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur md:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="pill-badge">KPI</p>
                  <h2 className="mt-4 font-serif text-3xl text-foreground">Cleaning metrics at a glance</h2>
                </div>
                {uploadResult ? (
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                    <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
                    Upload processed
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Rows before", value: derivedMetrics.rowsBefore, icon: BarChart3 },
                  { label: "Rows after", value: derivedMetrics.rowsAfter, icon: CheckCircle2 },
                  { label: "Duplicates removed", value: derivedMetrics.duplicatesRemoved, icon: FileSpreadsheet },
                  { label: "Outliers detected", value: derivedMetrics.outliersDetected, icon: AlertTriangle },
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.label} className="rounded-2xl border border-border bg-background/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{metric.label}</p>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <p className="mt-3 font-serif text-3xl text-foreground">{formatNumber(metric.value)}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Invalid timestamps", value: derivedMetrics.invalidTimestamps },
                  { label: "Invalid IPs", value: derivedMetrics.invalidIps },
                  { label: "Missing values filled", value: derivedMetrics.missingFilled },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 font-serif text-2xl text-foreground">{formatNumber(metric.value)}</p>
                  </div>
                ))}
              </div>
            </section>

            {uploadResult ? (
              <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur md:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="pill-badge">Backend Data</p>
                    <h2 className="mt-4 font-serif text-3xl text-foreground">Response from `/upload`</h2>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Cleaned file path: <span className="text-foreground">{uploadResult.cleaned_file_path}</span>
                  </span>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <h3 className="text-lg font-semibold text-foreground">Quality report</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Rows: {formatNumber(qualityReport?.summary?.rows)} | Columns: {formatNumber(qualityReport?.summary?.columns)} | Duplicates: {formatNumber(qualityReport?.summary?.duplicate_rows)}
                    </p>
                    <div className="mt-4 space-y-3">
                      {(qualityColumns.slice(0, 5)).map((column) => (
                        <div key={`${column.column}-detail`} className="rounded-2xl border border-border bg-card px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium text-foreground">{column.column}</p>
                            <span className="text-xs text-muted-foreground">{column.dtype}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Missing {column.missing} ({column.missing_percent}%), unique {column.unique_values}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <h3 className="text-lg font-semibold text-foreground">Quick interpretation</h3>
                    <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        Duplicates and invalid timestamps are useful preprocessing signals for cleanup.
                      </li>
                      <li className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        The cleaned output is already stored on the backend and can be used for the next model step.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage
