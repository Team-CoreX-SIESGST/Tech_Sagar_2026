"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Upload,
  Zap,
  Shield,
  Activity,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Constants & helpers
───────────────────────────────────────────────────────────── */
const MIN_LOAD_MS = 2000; // minimum animation display time
const DASHBOARD_RESULT_STORAGE_KEY = "parkhi-dashboard-upload-result";

const sections = [
  { id: "upload-file", label: "Upload File", icon: Upload },
  { id: "backend-data", label: "Data Quality", icon: Activity },
  { id: "kpi", label: "KPI", icon: BarChart3 },
  { id: "fraud-insights", label: "Fraud", icon: Shield },
];

const formatNumber = (v) =>
  new Intl.NumberFormat("en-IN").format(Number(v) || 0);

const formatPercent = (v) =>
  Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "N/A";

/* ─────────────────────────────────────────────────────────────
   ColumnStreams  — vertical dot-streams canvas background
   Faint idle; active state lights columns in a cascade wave.
───────────────────────────────────────────────────────────── */
const ColumnStreams = ({ active }) => {
  const cvs = useRef(null);
  const rafRef = useRef(null);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const NUM_COLS = 30;
    const DOT_SPACING = 17;
    const DOT_R = 1.05;
    let cols = [];

    const build = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const spacing = W / (NUM_COLS + 1);
      cols = Array.from({ length: NUM_COLS }, (_, i) => ({
        x: spacing * (i + 1),
        offset: Math.random() * DOT_SPACING,
        speed: 0.28 + Math.random() * 0.42,
        bright: 0,
        brightDecay: 0,
        waveDelay: i * 52,
        waveArmed: false,
        dotAlphas: Array.from(
          { length: Math.ceil(H / DOT_SPACING) + 2 },
          () => 0.04 + Math.random() * 0.05,
        ),
      }));
    };
    build();
    window.addEventListener("resize", build);

    let waveStart = null;
    let wasActive = false;

    const draw = (ts) => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const H = canvas.offsetHeight;
      const isOn = activeRef.current;

      if (isOn && !wasActive) {
        waveStart = ts;
        wasActive = true;
      }
      if (!isOn) {
        wasActive = false;
        waveStart = null;
      }

      cols.forEach((col) => {
        if (isOn) {
          col.offset = (col.offset + col.speed * 0.38) % DOT_SPACING;
          if (waveStart !== null) {
            const elapsed = ts - waveStart - col.waveDelay;
            if (elapsed > 0 && !col.waveArmed) {
              col.waveArmed = true;
              col.bright = 1;
              col.brightDecay = 1;
            }
          }
          if (col.waveArmed && col.brightDecay > 0) {
            col.brightDecay -= 0.005;
            col.bright = Math.max(0, col.brightDecay);
          }
        } else {
          col.waveArmed = false;
          col.bright = 0;
          col.brightDecay = 0;
        }

        const numDots = Math.ceil(H / DOT_SPACING) + 2;
        for (let d = 0; d < numDots; d++) {
          const y = d * DOT_SPACING - col.offset;
          if (y < -2 || y > H + 2) continue;
          const base = col.dotAlphas[d] ?? 0.045;
          const alpha = isOn
            ? base + col.bright * 0.65
            : base * (0.45 + 0.55 * Math.sin(ts / 2800 + col.x * 0.01));
          ctx.beginPath();
          ctx.arc(col.x, y, DOT_R, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,232,122,${Math.min(alpha, 0.75).toFixed(3)})`;
          ctx.fill();
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", build);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={cvs}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
};

/* ─────────────────────────────────────────────────────────────
   TargetBrackets  — CSS corner L-brackets, animate on upload
───────────────────────────────────────────────────────────── */
const TargetBrackets = ({ active }) => {
  const arm = 20;
  const T = "1.8px";
  const c = active ? "rgba(0,232,122,0.68)" : "rgba(0,232,122,0.16)";
  const corners = [
    { top: 14, left: 14, rot: 0 },
    { top: 14, right: 14, rot: 90 },
    { bottom: 14, right: 14, rot: 180 },
    { bottom: 14, left: 14, rot: 270 },
  ];
  return (
    <>
      <style>{`
        @keyframes bkt-in { from{opacity:0;transform:rotate(var(--r)) scale(1.2)} to{opacity:1;transform:rotate(var(--r)) scale(1)} }
        @keyframes bkt-pulse { 0%,100%{opacity:0.68} 50%{opacity:1} }
      `}</style>
      {corners.map((corner, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: arm,
            height: arm,
            ...(corner.top !== undefined ? { top: corner.top } : {}),
            ...(corner.bottom !== undefined ? { bottom: corner.bottom } : {}),
            ...(corner.left !== undefined ? { left: corner.left } : {}),
            ...(corner.right !== undefined ? { right: corner.right } : {}),
            "--r": `${corner.rot}deg`,
            transform: `rotate(${corner.rot}deg)`,
            borderTop: `${T} solid ${c}`,
            borderLeft: `${T} solid ${c}`,
            transition: "border-color 0.4s ease",
            animation: active
              ? `bkt-in 0.4s ease ${i * 55}ms both, bkt-pulse 2.2s ease ${i * 55 + 400}ms infinite`
              : "none",
            pointerEvents: "none",
            zIndex: 6,
          }}
        />
      ))}
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   ArcSpinner  — rotating dual-arc around the center icon
───────────────────────────────────────────────────────────── */
const ArcSpinner = ({ active }) => (
  <>
    <style>{`
      @keyframes spin-cw  { to { transform: rotate(360deg);  } }
      @keyframes spin-ccw { to { transform: rotate(-360deg); } }
      @keyframes arc-appear { from{opacity:0;transform:scale(0.78) rotate(0deg)} to{opacity:1;transform:scale(1) rotate(0deg)} }
    `}</style>
    {active && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 7,
        }}
      >
        {/* outer arc — 3/4 circle, clockwise */}
        <div
          style={{
            position: "absolute",
            width: 84,
            height: 84,
            borderRadius: "50%",
            border: "1.5px solid transparent",
            borderTopColor: "rgba(0,232,122,0.9)",
            borderRightColor: "rgba(0,232,122,0.9)",
            borderBottomColor: "rgba(0,232,122,0.9)",
            animation:
              "spin-cw 1.05s cubic-bezier(0.4,0,0.2,1) infinite, arc-appear 0.38s ease both",
          }}
        />
        {/* inner half arc — counter-clockwise */}
        <div
          style={{
            position: "absolute",
            width: 68,
            height: 68,
            borderRadius: "50%",
            border: "1px solid transparent",
            borderTopColor: "rgba(0,232,122,0.32)",
            borderRightColor: "rgba(0,232,122,0.32)",
            animation:
              "spin-ccw 1.7s linear infinite, arc-appear 0.45s ease 0.08s both",
          }}
        />
      </div>
    )}
  </>
);

/* ─────────────────────────────────────────────────────────────
   PhaseText  — monospace typing text with blinking cursor
───────────────────────────────────────────────────────────── */
const PhaseText = ({ text }) => (
  <>
    <style>{`@keyframes cur{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
    <span
      style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 12,
        color: "rgba(0,232,122,0.72)",
        letterSpacing: "0.07em",
      }}
    >
      {text}
      <span style={{ animation: "cur 0.9s step-end infinite", marginLeft: 2 }}>
        _
      </span>
    </span>
  </>
);

/* ─────────────────────────────────────────────────────────────
   ScanningBar
───────────────────────────────────────────────────────────── */
const ScanningBar = ({ active, progress }) => (
  <div style={{ width: "100%", marginTop: 20 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 7,
      }}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "rgba(0,232,122,0.42)",
          textTransform: "uppercase",
        }}
      >
        {active ? "Processing data stream" : "Ready"}
      </span>
      {active && (
        <span
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 9,
            color: "rgba(0,232,122,0.42)",
          }}
        >
          {progress}%
        </span>
      )}
    </div>
    <div
      style={{
        height: 2,
        width: "100%",
        background: "rgba(0,232,122,0.07)",
        borderRadius: 1,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: active ? `${progress}%` : "0%",
          background:
            "linear-gradient(to right, rgba(0,232,122,0.5), rgba(0,232,122,0.95))",
          transition: "width 0.35s ease",
          boxShadow: active ? "0 0 7px rgba(0,232,122,0.55)" : "none",
        }}
      />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, icon: Icon, highlight, delay = 0 }) => (
  <div
    style={{
      borderRadius: 15,
      border: highlight
        ? "1px solid rgba(239,68,68,0.26)"
        : "1px solid rgba(0,232,122,0.1)",
      background: highlight ? "rgba(239,68,68,0.035)" : "rgba(0,232,122,0.022)",
      padding: "17px 19px",
      position: "relative",
      overflow: "hidden",
      animation: `kpiIn 0.5s ease ${delay}ms both`,
    }}
  >
    <style>{`@keyframes kpiIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 54,
        height: 54,
        background: highlight
          ? "radial-gradient(circle at top right,rgba(239,68,68,0.13),transparent 70%)"
          : "radial-gradient(circle at top right,rgba(0,232,122,0.08),transparent 70%)",
      }}
    />
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 11,
      }}
    >
      <p
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9,
          letterSpacing: "0.13em",
          color: "rgba(255,255,255,0.33)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          border: highlight
            ? "1px solid rgba(239,68,68,0.2)"
            : "1px solid rgba(0,232,122,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: highlight
            ? "rgba(239,68,68,0.065)"
            : "rgba(0,232,122,0.045)",
        }}
      >
        <Icon
          style={{
            width: 12,
            height: 12,
            color: highlight ? "rgb(239,68,68)" : "rgb(0,232,122)",
          }}
        />
      </div>
    </div>
    <p
      style={{
        fontFamily: "'Playfair Display',Georgia,serif",
        fontSize: 30,
        fontWeight: 700,
        color: highlight ? "rgba(239,100,100,0.9)" : "rgba(255,255,255,0.86)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      {typeof value === "number" ? formatNumber(value) : value ?? "N/A"}
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────────────────────────── */
function DashboardPage() {
  const fileInputRef = useRef(null);
  const sectionRefs = useRef({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState("");
  const [error, setError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [activeSection, setActiveSection] = useState("upload-file");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Store the cancellation function for the progress simulation
  const cancelSimulationRef = useRef(null);

  const cleaningSummary = uploadResult?.cleaning_summary || {};
  const qualityReport = uploadResult?.quality_report || {};
  const qualityColumns = Array.isArray(qualityReport.columns)
    ? qualityReport.columns
    : [];
  const fraudMetrics = uploadResult?.fraud_metrics || uploadResult || {};
  const topTransactions = Array.isArray(uploadResult?.top_transactions)
    ? uploadResult.top_transactions
    : [];

  const derivedMetrics = (() => ({
    rowsBefore: Number(
      cleaningSummary.rows_before_cleaning || qualityReport?.summary?.rows || 0,
    ),
    rowsAfter: Number(cleaningSummary.rows_after_cleaning || 0),
    duplicatesRemoved: Number(cleaningSummary.duplicates_removed || 0),
    invalidTimestamps: Number(cleaningSummary.invalid_timestamps_removed || 0),
    invalidIps: Number(cleaningSummary.invalid_ips_detected || 0),
    outliersDetected: Number(cleaningSummary.outliers_detected || 0),
    missingFilled: Number(cleaningSummary.missing_values_filled || 0),
  }))();

  const navigateToSection = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are accepted.");
      setSelectedFile(null);
      return;
    }
    setError("");
    setSelectedFile(file);
  };

  const handleFileChange = (e) => handleFile(e.target.files?.[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // Fixed progress simulation: returns a cancel function
  const runProgressSim = useCallback(() => {
    const phases = [
      { label: "VALIDATING SCHEMA", end: 16 },
      { label: "PARSING RECORDS", end: 36 },
      { label: "DETECTING ANOMALIES", end: 60 },
      { label: "CLEANING DATA", end: 79 },
      { label: "COMPUTING METRICS", end: 92 },
      { label: "FINALIZING", end: 98 },
    ];
    let idx = 0;
    let cur = 0;
    let active = true;
    let timeoutId = null;

    const tick = () => {
      if (!active) return;
      if (idx >= phases.length) return;
      setUploadPhase(phases[idx].label);
      if (cur < phases[idx].end) {
        cur += 0.7 + Math.random() * 1.1;
        setUploadProgress(Math.min(cur, phases[idx].end));
        timeoutId = setTimeout(tick, 65);
      } else {
        idx++;
        timeoutId = setTimeout(tick, 130);
      }
    };

    tick();

    const cancel = () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };

    return cancel;
  }, []);

  const submitUpload = async () => {
    if (!selectedFile) {
      setError("Select a CSV file first.");
      return;
    }
    const startTime = Date.now();
    try {
      setIsUploading(true);
      setError("");
      setUploadProgress(0);
      setUploadPhase("INITIALIZING");

      // Start simulation and store cancel function
      const cancelSim = runProgressSim();
      cancelSimulationRef.current = cancelSim;

      const formData = new FormData();
      formData.append("file", selectedFile);

      // ── MINIMUM LOAD TIME GUARANTEE ─────────────────────────
      const [response] = await Promise.all([
        fetch("/api/upload", { method: "POST", body: formData }),
        new Promise((r) => setTimeout(r, MIN_LOAD_MS)),
      ]);
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data?.detail || data?.error || "Upload failed.");

      // Stop simulation immediately to avoid further progress updates
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
        cancelSimulationRef.current = null;
      }

      // ── Visual grace period before revealing results ─────────
      setUploadProgress(100);
      setUploadPhase("COMPLETE");
      setUploadSuccess(true);
      await new Promise((r) => setTimeout(r, 700));

      setUploadResult(data);
      setActiveSection("backend-data");
      sectionRefs.current["backend-data"]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
      // Ensure simulation is cancelled if something went wrong
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
        cancelSimulationRef.current = null;
      }
      setUploadProgress(0);
      setUploadPhase("");
    }
  };

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const savedResult = window.localStorage.getItem(
        DASHBOARD_RESULT_STORAGE_KEY,
      );
      if (!savedResult) return;

      const parsedResult = JSON.parse(savedResult);
      if (parsedResult && typeof parsedResult === "object") {
        setUploadResult(parsedResult);
        setUploadSuccess(true);
      }
    } catch (storageError) {
      console.error("Failed to restore dashboard upload result", storageError);
    }
  }, []);

  useEffect(() => {
    if (!uploadResult) return;

    try {
      window.localStorage.setItem(
        DASHBOARD_RESULT_STORAGE_KEY,
        JSON.stringify(uploadResult),
      );
    } catch (storageError) {
      console.error("Failed to persist dashboard upload result", storageError);
    }
  }, [uploadResult]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');

        :root {
          --green: rgb(0,232,122);
          --card:  rgba(9,13,17,0.92);
          --bdr:   rgba(0,232,122,0.1);
          --bdr-h: rgba(0,232,122,0.22);
        }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes badgeIn { from{opacity:0;transform:scale(0.9) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dot-blink{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes ok-ring {
          0%  {box-shadow:0 0 0 0   rgba(0,232,122,0);}
          40% {box-shadow:0 0 0 9px rgba(0,232,122,0.16);}
          100%{box-shadow:0 0 0 0   rgba(0,232,122,0);}
        }
        @keyframes icon-breathe { 0%,100%{opacity:0.55} 50%{opacity:1} }

        .card{
          border-radius:20px;
          border:1px solid var(--bdr);
          background:var(--card);
          backdrop-filter:blur(18px);
          transition:border-color 0.3s ease;
        }
        .card:hover { border-color:var(--bdr-h); }

        .nav-btn{
          display:flex; align-items:center; gap:12px;
          width:100%; border-radius:12px; padding:11px 14px;
          font-family:'IBM Plex Mono',monospace;
          font-size:10px; letter-spacing:0.09em; text-transform:uppercase;
          cursor:pointer; transition:all 0.2s ease;
        }
        .nav-btn.on {
          border:1px solid rgba(0,232,122,0.3);
          background:rgba(0,232,122,0.07);
          color:var(--green);
        }
        .nav-btn.off {
          border:1px solid rgba(255,255,255,0.05);
          background:transparent;
          color:rgba(255,255,255,0.35);
        }
        .nav-btn.off:hover {
          border-color:rgba(0,232,122,0.18);
          color:rgba(255,255,255,0.68);
          background:rgba(0,232,122,0.03);
        }

        .drop-zone{
          border-radius:15px;
          border:1px solid;
          transition:border-color 0.3s ease, background 0.3s ease;
          position:relative; overflow:hidden;
        }
        .drop-zone.idle   { border-color:rgba(0,232,122,0.11); background:rgba(0,232,122,0.015); }
        .drop-zone.hover  { border-color:rgba(0,232,122,0.4);  background:rgba(0,232,122,0.042); }
        .drop-zone.active { border-color:rgba(0,232,122,0.27); background:rgba(0,232,122,0.022); }
        .drop-zone.done   { border-color:rgba(0,232,122,0.52); animation:ok-ring 1s ease forwards; }

        .btn-p{
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 25px; border-radius:9px;
          font-family:'IBM Plex Mono',monospace;
          font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
          cursor:pointer; transition:all 0.2s ease;
          background:var(--green); color:rgb(0,17,8); border:none;
        }
        .btn-p:hover:not(:disabled){ background:rgb(10,248,136); transform:translateY(-1px); }
        .btn-p:disabled{ opacity:0.38; cursor:not-allowed; }

        .btn-g{
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 20px; border-radius:9px;
          font-family:'IBM Plex Mono',monospace;
          font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase;
          cursor:pointer; transition:all 0.2s ease;
          background:transparent; color:rgba(0,232,122,0.72);
          border:1px solid rgba(0,232,122,0.18);
        }
        .btn-g:hover{ border-color:rgba(0,232,122,0.4); background:rgba(0,232,122,0.04); color:var(--green); }

        .mono  { font-family:'IBM Plex Mono',monospace; }
        .serif { font-family:'Playfair Display',Georgia,serif; }

        .pill{
          display:inline-flex; align-items:center; gap:5px;
          padding:3px 9px; border-radius:5px;
          font-family:'IBM Plex Mono',monospace;
          font-size:9px; letter-spacing:0.14em; text-transform:uppercase;
          border:1px solid rgba(0,232,122,0.17);
          color:rgba(0,232,122,0.58);
          background:rgba(0,232,122,0.04);
        }

        .hud-row{
          display:flex; align-items:center; justify-content:space-between;
          padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .hud-row:last-child{ border-bottom:none; }

        .stat-mini{
          border-radius:12px;
          border:1px solid rgba(0,232,122,0.08);
          background:rgba(0,232,122,0.02);
          padding:13px 16px;
        }

        .col-row{
          border-radius:9px;
          border:1px solid rgba(255,255,255,0.052);
          background:rgba(255,255,255,0.016);
          padding:10px 13px;
          transition:border-color 0.18s;
        }
        .col-row:hover{ border-color:rgba(0,232,122,0.16); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#070a0d" }}>
        <Navbar />
        <main
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "112px 24px 64px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 22,
              gridTemplateColumns: "234px 1fr",
            }}
          >
            {/* ── SIDEBAR ───────────────────────────────────── */}
            <aside
              style={{ position: "sticky", top: 96, height: "fit-content" }}
            >
              <div
                className="card"
                style={{
                  padding: "20px 18px",
                  marginBottom: 10,
                  background:
                    "linear-gradient(140deg,rgba(0,232,122,0.04) 0%,rgba(9,13,17,0.96) 55%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    marginBottom: 13,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--green)",
                      animation: "dot-blink 4s ease infinite",
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      color: "rgba(0,232,122,0.48)",
                      textTransform: "uppercase",
                    }}
                  >
                    Dashboard
                  </span>
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 25,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  PARKHI.ai
                </div>
                <p
                  className="mono"
                  style={{
                    fontSize: 9,
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.27)",
                    letterSpacing: "0.04em",
                  }}
                >
                  Upload · Clean · Inspect
                </p>
              </div>

              <div className="card" style={{ padding: 10, marginBottom: 10 }}>
                {sections.map(({ id, label, icon: Icon }) => {
                  const on = activeSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => navigateToSection(id)}
                      className={`nav-btn ${on ? "on" : "off"}`}
                      style={{ marginBottom: 4 }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          flexShrink: 0,
                          border: `1px solid ${on ? "rgba(0,232,122,0.24)" : "rgba(255,255,255,0.055)"}`,
                          background: on
                            ? "rgba(0,232,122,0.08)"
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon style={{ width: 12, height: 12 }} />
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="card" style={{ padding: "14px 16px" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.22em",
                    color: "rgba(255,255,255,0.24)",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  System Status
                </div>
                {[
                  {
                    k: "Pipeline",
                    v: isUploading ? "● ACTIVE" : "● READY",
                    vc: isUploading ? "var(--green)" : "rgba(0,232,122,0.42)",
                  },
                  {
                    k: "File",
                    v: selectedFile ? selectedFile.name : "—",
                    vc: "rgba(255,255,255,0.58)",
                    maxW: 106,
                  },
                  ...(uploadResult
                    ? [{ k: "Result", v: "✓ CLEAN", vc: "var(--green)" }]
                    : []),
                ].map(({ k, v, vc, maxW }) => (
                  <div key={k} className="hud-row">
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "rgba(255,255,255,0.33)" }}
                    >
                      {k}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: vc,
                        ...(maxW
                          ? {
                              maxWidth: maxW,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }
                          : {}),
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </aside>

            {/* ── MAIN CONTENT ──────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* ── UPLOAD ──────────────────────────────────── */}
              <section
                ref={(n) => {
                  sectionRefs.current["upload-file"] = n;
                }}
                id="upload-file"
                className="card"
                style={{ padding: "30px 34px", scrollMarginTop: 112 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 26,
                  }}
                >
                  <div>
                    <div className="pill" style={{ marginBottom: 13 }}>
                      <FileUp style={{ width: 9, height: 9 }} /> Upload File
                    </div>
                    <h2
                      className="serif"
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "rgba(255,255,255,0.88)",
                        lineHeight: 1.12,
                        margin: 0,
                      }}
                    >
                      Drop a CSV to
                      <br />
                      <em
                        style={{ fontStyle: "italic", color: "var(--green)" }}
                      >
                        begin analysis
                      </em>
                    </h2>
                  </div>
                  {selectedFile && !isUploading && (
                    <div
                      style={{
                        padding: "9px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,232,122,0.15)",
                        background: "rgba(0,232,122,0.03)",
                        animation: "badgeIn 0.28s ease both",
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontSize: 8,
                          color: "rgba(0,232,122,0.48)",
                          marginBottom: 3,
                        }}
                      >
                        SELECTED
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.7)",
                          fontWeight: 700,
                        }}
                      >
                        {selectedFile.name}
                      </div>
                    </div>
                  )}
                </div>

                {/* Drop Zone */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={handleDrop}
                  className={`drop-zone ${uploadSuccess ? "done" : isUploading ? "active" : dragActive ? "hover" : "idle"}`}
                  style={{ padding: "62px 28px", textAlign: "center" }}
                >
                  <ColumnStreams active={isUploading} />
                  <TargetBrackets active={isUploading} />
                  {/* <ArcSpinner active={isUploading} /> */}

                  <div style={{ position: "relative", zIndex: 10 }}>
                    {/* Icon circle */}
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        margin: "0 auto 18px",
                        borderRadius: "50%",
                        border: isUploading
                          ? "1px solid rgba(0,232,122,0.28)"
                          : "1px solid rgba(0,232,122,0.12)",
                        background: isUploading
                          ? "rgba(0,232,122,0.06)"
                          : "rgba(0,232,122,0.032)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.4s ease",
                      }}
                    >
                      {isUploading ? (
                        <Activity
                          style={{
                            width: 22,
                            height: 22,
                            color: "var(--green)",
                            animation: "icon-breathe 1.6s ease infinite",
                          }}
                        />
                      ) : uploadSuccess ? (
                        <CheckCircle2
                          style={{
                            width: 22,
                            height: 22,
                            color: "var(--green)",
                          }}
                        />
                      ) : (
                        <FileUp
                          style={{
                            width: 22,
                            height: 22,
                            color: "rgba(0,232,122,0.52)",
                          }}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div style={{ minHeight: 26, marginBottom: 7 }}>
                      {isUploading ? (
                        <PhaseText text={uploadPhase} />
                      ) : (
                        <h3
                          className="serif"
                          style={{
                            fontSize: 19,
                            fontWeight: 700,
                            color: uploadSuccess
                              ? "var(--green)"
                              : "rgba(255,255,255,0.75)",
                            margin: 0,
                          }}
                        >
                          {dragActive
                            ? "Release to upload"
                            : uploadSuccess
                              ? "Upload complete"
                              : "Drag & drop your CSV here"}
                        </h3>
                      )}
                    </div>

                    {isUploading && (
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(0,232,122,0.38)",
                          letterSpacing: "0.07em",
                          marginBottom: 2,
                        }}
                      >
                        {uploadProgress.toFixed(0)}% complete
                      </div>
                    )}

                    {!isUploading && !uploadSuccess && (
                      <p
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.2)",
                          letterSpacing: "0.04em",
                          marginBottom: 20,
                          lineHeight: 1.8,
                        }}
                      >
                        Dataset posted to backend /upload route.
                        <br />
                        Cleaning and fraud scoring results populate the
                        dashboard automatically.
                      </p>
                    )}

                    <ScanningBar
                      active={isUploading}
                      progress={Math.round(uploadProgress)}
                    />

                    {!isUploading && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          marginTop: 22,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-g"
                        >
                          <FileSpreadsheet style={{ width: 12, height: 12 }} />{" "}
                          Choose file
                        </button>
                        <button
                          type="button"
                          onClick={submitUpload}
                          disabled={!selectedFile || isUploading}
                          className="btn-p"
                        >
                          <Upload style={{ width: 12, height: 12 }} /> Upload to
                          backend
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </div>

                {error && (
                  <div
                    className="mono"
                    style={{
                      marginTop: 12,
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(239,68,68,0.2)",
                      background: "rgba(239,68,68,0.04)",
                      fontSize: 10,
                      color: "rgba(239,120,120,0.8)",
                      letterSpacing: "0.04em",
                      animation: "badgeIn 0.2s ease",
                    }}
                  >
                    ⚠ {error}
                  </div>
                )}
              </section>

              {uploadResult && (
                <section
                  ref={(n) => {
                    sectionRefs.current["backend-data"] = n;
                  }}
                  id="backend-data"
                  className="card"
                  style={{
                    padding: "30px 34px",
                    scrollMarginTop: 112,
                    animation: "slideUp 0.44s ease both",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: 22,
                    }}
                  >
                    <div>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Shield style={{ width: 9, height: 9 }} /> Backend Data
                      </div>
                      <h2
                        className="serif"
                        style={{
                          fontSize: 24,
                          fontWeight: 900,
                          color: "rgba(255,255,255,0.88)",
                          margin: 0,
                        }}
                      >
                        Data Quality Report
                      </h2>
                    </div>
                    {uploadResult.cleaned_file_path && (
                      <div style={{ textAlign: "right" }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: 8,
                            color: "rgba(255,255,255,0.24)",
                            marginBottom: 3,
                            letterSpacing: "0.1em",
                          }}
                        >
                          CLEANED PATH
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "rgba(0,232,122,0.58)",
                          }}
                        >
                          {uploadResult.cleaned_file_path}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 13,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.052)",
                        padding: "17px 19px",
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.13em",
                          color: "rgba(255,255,255,0.33)",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Quality Report
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.26)",
                          marginBottom: 13,
                          lineHeight: 1.85,
                        }}
                      >
                        Rows:{" "}
                        <span style={{ color: "rgba(0,232,122,0.6)" }}>
                          {formatNumber(qualityReport?.summary?.rows)}
                        </span>
                        {" · "}Cols:{" "}
                        <span style={{ color: "rgba(0,232,122,0.6)" }}>
                          {formatNumber(qualityReport?.summary?.columns)}
                        </span>
                        {" · "}Dupes:{" "}
                        <span style={{ color: "rgba(239,68,68,0.6)" }}>
                          {formatNumber(qualityReport?.summary?.duplicate_rows)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 7,
                        }}
                      >
                        {qualityColumns.slice(0, 5).map((col) => (
                          <div key={col.column} className="col-row">
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 3,
                              }}
                            >
                              <span
                                className="mono"
                                style={{
                                  fontSize: 10,
                                  color: "rgba(255,255,255,0.68)",
                                  fontWeight: 700,
                                }}
                              >
                                {col.column}
                              </span>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 8,
                                  color: "rgba(0,232,122,0.4)",
                                  padding: "2px 6px",
                                  border: "1px solid rgba(0,232,122,0.1)",
                                  borderRadius: 3,
                                }}
                              >
                                {col.dtype}
                              </span>
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.25)",
                              }}
                            >
                              Missing {col.missing} ({col.missing_percent}%) ·
                              Unique {col.unique_values}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.052)",
                        padding: "17px 19px",
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.13em",
                          color: "rgba(255,255,255,0.33)",
                          textTransform: "uppercase",
                          marginBottom: 13,
                        }}
                      >
                        Interpretation
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {[
                          {
                            Icon: AlertTriangle,
                            c: "rgba(239,68,68,0.55)",
                            b: "rgba(239,68,68,0.1)",
                            bg: "rgba(239,68,68,0.025)",
                            t: "Duplicates and invalid timestamps are useful preprocessing signals for cleanup and pipeline hygiene.",
                          },
                          {
                            Icon: CheckCircle2,
                            c: "rgba(0,232,122,0.6)",
                            b: "rgba(0,232,122,0.1)",
                            bg: "rgba(0,232,122,0.025)",
                            t: "Cleaned output is stored on the backend and is ready for downstream model inference.",
                          },
                          {
                            Icon: Zap,
                            c: "rgba(0,232,122,0.4)",
                            b: "rgba(0,232,122,0.07)",
                            bg: "rgba(0,0,0,0.16)",
                            t: "High outlier counts may indicate behavioral anomalies worth routing to the risk scoring module.",
                          },
                        ].map(({ Icon, c, b, bg, t }, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 10,
                              padding: "11px 12px",
                              borderRadius: 9,
                              border: `1px solid ${b}`,
                              background: bg,
                            }}
                          >
                            <Icon
                              style={{
                                width: 12,
                                height: 12,
                                color: c,
                                marginTop: 2,
                                flexShrink: 0,
                              }}
                            />
                            <p
                              className="mono"
                              style={{
                                fontSize: 9,
                                lineHeight: 1.78,
                                color: "rgba(255,255,255,0.37)",
                                margin: 0,
                              }}
                            >
                              {t}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <Link href="/fraud-report" className="btn-g">
                      View fraud report
                    </Link>
                    <Link href="/eda" className="btn-g">
                      Open EDA
                    </Link>
                    <Link href="/graph" className="btn-g">
                      Relationship graph
                    </Link>
                  </div>
                </section>
              )}

              {/* ── KPI ─────────────────────────────────────── */}
              <section
                ref={(n) => {
                  sectionRefs.current.kpi = n;
                }}
                id="kpi"
                className="card"
                style={{ padding: "30px 34px", scrollMarginTop: 112 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 26,
                  }}
                >
                  <div>
                    <div className="pill" style={{ marginBottom: 13 }}>
                      <BarChart3 style={{ width: 9, height: 9 }} /> KPI Metrics
                    </div>
                    <h2
                      className="serif"
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "rgba(255,255,255,0.88)",
                        lineHeight: 1.12,
                        margin: 0,
                      }}
                    >
                      Cleaning metrics
                      <br />
                      <em
                        style={{ fontStyle: "italic", color: "var(--green)" }}
                      >
                        at a glance
                      </em>
                    </h2>
                  </div>
                  {uploadResult && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "7px 13px",
                        borderRadius: 9,
                        border: "1px solid rgba(0,232,122,0.24)",
                        background: "rgba(0,232,122,0.05)",
                        animation: "badgeIn 0.35s ease both",
                      }}
                    >
                      <CheckCircle2
                        style={{ width: 13, height: 13, color: "var(--green)" }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: "var(--green)",
                          letterSpacing: "0.12em",
                        }}
                      >
                        PROCESSED
                      </span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 11,
                    marginBottom: 11,
                  }}
                >
                  <KpiCard
                    label="Rows before"
                    value={derivedMetrics.rowsBefore}
                    icon={BarChart3}
                    delay={0}
                  />
                  <KpiCard
                    label="Rows after"
                    value={derivedMetrics.rowsAfter}
                    icon={CheckCircle2}
                    delay={55}
                  />
                  <KpiCard
                    label="Duplicates"
                    value={derivedMetrics.duplicatesRemoved}
                    icon={FileSpreadsheet}
                    delay={110}
                  />
                  <KpiCard
                    label="Outliers"
                    value={derivedMetrics.outliersDetected}
                    icon={AlertTriangle}
                    highlight
                    delay={165}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 11,
                  }}
                >
                  {[
                    {
                      label: "Invalid timestamps",
                      value: derivedMetrics.invalidTimestamps,
                    },
                    { label: "Invalid IPs", value: derivedMetrics.invalidIps },
                    {
                      label: "Missing values filled",
                      value: derivedMetrics.missingFilled,
                    },
                  ].map((m, i) => (
                    <div
                      key={m.label}
                      className="stat-mini"
                      style={{
                        animation: `kpiIn 0.5s ease ${215 + i * 55}ms both`,
                      }}
                    >
                      <p
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          color: "rgba(255,255,255,0.26)",
                          textTransform: "uppercase",
                          marginBottom: 7,
                        }}
                      >
                        {m.label}
                      </p>
                      <p
                        className="serif"
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.76)",
                          margin: 0,
                        }}
                      >
                        {formatNumber(m.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── BACKEND DATA ────────────────────────────── */}
              {uploadResult && (
                <section
                  ref={(n) => {
                    sectionRefs.current["fraud-insights"] = n;
                  }}
                  id="fraud-insights"
                  className="card"
                  style={{
                    padding: "30px 34px",
                    scrollMarginTop: 112,
                    animation: "slideUp 0.44s ease both",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: 22,
                    }}
                  >
                    <div>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Shield style={{ width: 9, height: 9 }} /> Fraud
                        Insights
                      </div>
                      <h2
                        className="serif"
                        style={{
                          fontSize: 24,
                          fontWeight: 900,
                          color: "rgba(255,255,255,0.88)",
                          margin: 0,
                        }}
                      >
                        Fraud Detection Summary
                      </h2>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: 8,
                          color: "rgba(255,255,255,0.24)",
                          marginBottom: 3,
                          letterSpacing: "0.1em",
                        }}
                      >
                        MODEL THRESHOLD
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(0,232,122,0.58)",
                        }}
                      >
                        {formatPercent(fraudMetrics.threshold_used)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      gap: 11,
                      marginBottom: 11,
                    }}
                  >
                    <KpiCard
                      label="Flagged"
                      value={fraudMetrics.fraud_transaction_count}
                      icon={AlertTriangle}
                      highlight
                      delay={0}
                    />
                    <KpiCard
                      label="Precision"
                      value={formatPercent(fraudMetrics.precision)}
                      icon={Shield}
                      delay={55}
                    />
                    <KpiCard
                      label="Recall"
                      value={formatPercent(fraudMetrics.recall)}
                      icon={Activity}
                      delay={110}
                    />
                    <KpiCard
                      label="F1 Score"
                      value={formatPercent(fraudMetrics.f1)}
                      icon={Zap}
                      delay={165}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 11,
                      marginBottom: 18,
                    }}
                  >
                    {[
                      {
                        label: "Scored transactions",
                        value: uploadResult.total_transactions_scored ?? 0,
                      },
                      {
                        label: "Actual fraud",
                        value: fraudMetrics.actual_fraud_count ?? "N/A",
                      },
                      {
                        label: "Pseudo F1",
                        value: formatPercent(fraudMetrics.pseudo_f1),
                      },
                    ].map((m, i) => (
                      <div
                        key={m.label}
                        className="stat-mini"
                        style={{
                          animation: `kpiIn 0.5s ease ${215 + i * 55}ms both`,
                        }}
                      >
                        <p
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            color: "rgba(255,255,255,0.26)",
                            textTransform: "uppercase",
                            marginBottom: 7,
                          }}
                        >
                          {m.label}
                        </p>
                        <p
                          className="serif"
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.76)",
                            margin: 0,
                          }}
                        >
                          {typeof m.value === "number" ? formatNumber(m.value) : m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.052)",
                      padding: "17px 19px",
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.13em",
                        color: "rgba(255,255,255,0.33)",
                        textTransform: "uppercase",
                        marginBottom: 13,
                      }}
                    >
                      Top flagged transactions
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                      }}
                    >
                      {topTransactions.length ? (
                        topTransactions.map((tx, i) => (
                          <div
                            key={`${tx.transaction_id || "txn"}-${i}`}
                            className="col-row"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.1fr 0.8fr 0.7fr 1.4fr",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div
                                className="mono"
                                style={{
                                  fontSize: 10,
                                  color: "rgba(255,255,255,0.68)",
                                  fontWeight: 700,
                                }}
                              >
                                {tx.transaction_id || "Unknown"}
                              </div>
                              <div
                                className="mono"
                                style={{
                                  fontSize: 9,
                                  color: "rgba(255,255,255,0.25)",
                                }}
                              >
                                {tx.criticality
                                  ? `Severity: ${String(tx.criticality).toUpperCase()}`
                                  : tx.user_id || "Scored transaction"}
                              </div>
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.42)",
                              }}
                            >
                              {tx.transaction_amount != null
                                ? `INR ${formatNumber(tx.transaction_amount)}`
                                : "Amount N/A"}
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 9,
                                color: "rgba(239,120,120,0.88)",
                              }}
                            >
                              {formatPercent(tx.fraud_probability)}
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 9,
                                color: "rgba(0,232,122,0.5)",
                                lineHeight: 1.7,
                              }}
                            >
                              {tx.plain_english_reason ||
                                (Array.isArray(tx.top_signals) && tx.top_signals.length
                                  ? tx.top_signals.join(" | ")
                                  : "Signals unavailable")}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.35)",
                            padding: "12px 2px",
                          }}
                        >
                          No ranked transactions were returned for this upload.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default DashboardPage;
