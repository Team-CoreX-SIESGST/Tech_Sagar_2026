"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import {
  Activity,
  BarChart3,
  DatabaseZap,
  FileUp,
  ImageIcon,
  Shield,
  Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Formatters
───────────────────────────────────────────────────────────── */
const compactNumber = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "N/A"
    : new Intl.NumberFormat("en-IN").format(Number(value));

/* ─────────────────────────────────────────────────────────────
   ColumnStreams  — vertical dot-streams canvas background
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
   TargetBrackets
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
   PhaseText
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
        {active ? "Rendering EDA artifacts" : "Ready"}
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
   LoadingZone
───────────────────────────────────────────────────────────── */
const LoadingZone = ({ phase, progress }) => (
  <div
    style={{
      borderRadius: 20,
      border: "1px solid rgba(0,232,122,0.18)",
      background: "rgba(9,13,17,0.92)",
      backdropFilter: "blur(18px)",
      padding: "62px 28px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}
  >
    <ColumnStreams active />
    <TargetBrackets active />
    <div style={{ position: "relative", zIndex: 10 }}>
      <div
        style={{
          width: 60,
          height: 60,
          margin: "0 auto 18px",
          borderRadius: "50%",
          border: "1px solid rgba(0,232,122,0.28)",
          background: "rgba(0,232,122,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Activity
          style={{
            width: 22,
            height: 22,
            color: "rgb(0,232,122)",
            animation: "icon-breathe 1.6s ease infinite",
          }}
        />
      </div>
      <div style={{ minHeight: 26, marginBottom: 7 }}>
        <PhaseText text={phase} />
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: "rgba(0,232,122,0.38)",
          letterSpacing: "0.07em",
          marginBottom: 2,
        }}
      >
        {progress.toFixed(0)}% complete
      </div>
      <ScanningBar active progress={Math.round(progress)} />
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
      {value ?? "N/A"}
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Chart Card
───────────────────────────────────────────────────────────── */
const ChartCard = ({ chart, index }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(0,232,122,0.1)",
        background: "rgba(9,13,17,0.92)",
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        transition: "border-color 0.3s ease",
        animation: `slideUp 0.5s ease ${index * 80}ms both`,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "rgba(0,232,122,0.22)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(0,232,122,0.1)")
      }
    >
      {/* Card header */}
      <div
        style={{
          padding: "18px 22px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background:
            "linear-gradient(to right, rgba(0,232,122,0.025), transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 5,
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              border: "1px solid rgba(0,232,122,0.17)",
              color: "rgba(0,232,122,0.58)",
              background: "rgba(0,232,122,0.04)",
              marginBottom: 9,
            }}
          >
            <ImageIcon style={{ width: 9, height: 9 }} /> EDA Chart
          </div>
          <h3
            style={{
              fontFamily: "'Playfair Display',Georgia,serif",
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(255,255,255,0.88)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {chart.title}
          </h3>
        </div>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            border: "1px solid rgba(0,232,122,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,232,122,0.045)",
          }}
        >
          <BarChart3
            style={{ width: 12, height: 12, color: "rgb(0,232,122)" }}
          />
        </div>
      </div>

      {/* Image area */}
      <div
        style={{
          padding: 16,
          background: "rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {!imgLoaded && (
          <div
            style={{
              position: "absolute",
              inset: 16,
              borderRadius: 12,
              background: "rgba(0,232,122,0.03)",
              border: "1px solid rgba(0,232,122,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "rgba(0,232,122,0.35)",
                textTransform: "uppercase",
                animation: "icon-breathe 1.6s ease infinite",
              }}
            >
              Loading chart_
            </span>
          </div>
        )}
        <img
          src={chart.url}
          alt={chart.title}
          onLoad={() => setImgLoaded(true)}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "block",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Insight Row
───────────────────────────────────────────────────────────── */
const InsightRow = ({ icon: Icon, color, borderColor, bg, text, delay }) => (
  <div
    style={{
      display: "flex",
      gap: 10,
      padding: "14px 15px",
      borderRadius: 12,
      border: `1px solid ${borderColor}`,
      background: bg,
      animation: `kpiIn 0.5s ease ${delay}ms both`,
    }}
  >
    <Icon
      style={{ width: 13, height: 13, color, marginTop: 2, flexShrink: 0 }}
    />
    <p
      style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 10,
        lineHeight: 1.82,
        color: "rgba(255,255,255,0.42)",
        margin: 0,
      }}
    >
      {text}
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────── */
export default function EdaPage() {
  const [eda, setEda] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadPhase, setLoadPhase] = useState("INITIALIZING");
  const [loadProgress, setLoadProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");

  const sectionRefs = useRef({});
  const cancelSimRef = useRef(null);

  const sections = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "charts", label: "Charts", icon: ImageIcon },
    { id: "insights", label: "Insights", icon: DatabaseZap },
  ];

  const navigateToSection = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /* progress simulation */
  const runProgressSim = () => {
    const phases = [
      { label: "FETCHING EDA DATA", end: 20 },
      { label: "LOADING REPORT", end: 42 },
      { label: "PARSING CHARTS", end: 65 },
      { label: "RENDERING ARTIFACTS", end: 88 },
      { label: "FINALIZING", end: 97 },
    ];
    let idx = 0;
    let cur = 0;
    let active = true;
    let tid = null;
    const tick = () => {
      if (!active) return;
      if (idx >= phases.length) return;
      setLoadPhase(phases[idx].label);
      if (cur < phases[idx].end) {
        cur += 0.8 + Math.random() * 1.2;
        setLoadProgress(Math.min(cur, phases[idx].end));
        tid = setTimeout(tick, 65);
      } else {
        idx++;
        tid = setTimeout(tick, 130);
      }
    };
    tick();
    return () => {
      active = false;
      if (tid) clearTimeout(tid);
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadProgress(0);
        setLoadPhase("INITIALIZING");
        const cancel = runProgressSim();
        cancelSimRef.current = cancel;

        const [edaResponse, reportResponse] = await Promise.all([
          fetch("/api/eda", { cache: "no-store" }),
          fetch("/api/fraud-report", { cache: "no-store" }),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
        const edaData = await edaResponse.json();
        const reportData = await reportResponse.json();

        if (!edaResponse.ok)
          throw new Error(edaData?.error || "Failed to load EDA.");
        if (!reportResponse.ok)
          throw new Error(
            reportData?.error || "Failed to load report summary.",
          );

        if (cancelSimRef.current) {
          cancelSimRef.current();
          cancelSimRef.current = null;
        }
        setLoadProgress(100);
        setLoadPhase("COMPLETE");
        await new Promise((r) => setTimeout(r, 600));

        setEda(edaData);
        setReport(reportData);
        setActiveSection("overview");
      } catch (err) {
        setError(err.message || "Failed to load EDA.");
      } finally {
        setLoading(false);
        if (cancelSimRef.current) {
          cancelSimRef.current();
          cancelSimRef.current = null;
        }
      }
    };
    load();
    return () => {
      if (cancelSimRef.current) cancelSimRef.current();
    };
  }, []);

  const charts = eda?.charts || [];
  const summary = report?.summary || {};

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

        @keyframes fadeUp       { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp      { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes kpiIn        { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes badgeIn      { from{opacity:0;transform:scale(0.9) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes dot-blink    { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes icon-breathe { 0%,100%{opacity:0.55} 50%{opacity:1} }

        .card {
          border-radius:20px;
          border:1px solid var(--bdr);
          background:var(--card);
          backdrop-filter:blur(18px);
          transition:border-color 0.3s ease;
        }
        .card:hover { border-color:var(--bdr-h); }

        .nav-btn {
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

        .btn-g {
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 20px; border-radius:9px;
          font-family:'IBM Plex Mono',monospace;
          font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase;
          cursor:pointer; transition:all 0.2s ease;
          background:transparent; color:rgba(0,232,122,0.72);
          border:1px solid rgba(0,232,122,0.18);
          text-decoration:none;
        }
        .btn-g:hover { border-color:rgba(0,232,122,0.4); background:rgba(0,232,122,0.04); color:var(--green); }

        .pill {
          display:inline-flex; align-items:center; gap:5px;
          padding:3px 9px; border-radius:5px;
          font-family:'IBM Plex Mono',monospace;
          font-size:9px; letter-spacing:0.14em; text-transform:uppercase;
          border:1px solid rgba(0,232,122,0.17);
          color:rgba(0,232,122,0.58);
          background:rgba(0,232,122,0.04);
        }

        .hud-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .hud-row:last-child { border-bottom:none; }

        .mono  { font-family:'IBM Plex Mono',monospace; }
        .serif { font-family:'Playfair Display',Georgia,serif; }
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
            {/* ── SIDEBAR ── */}
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
                    EDA Studio
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
                  Explore · Validate · Explain
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

              {/* System status */}
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
                    v: loading ? "● LOADING" : eda ? "● READY" : "● ERROR",
                    vc: loading
                      ? "var(--green)"
                      : eda
                        ? "rgba(0,232,122,0.55)"
                        : "rgba(239,68,68,0.7)",
                  },
                  {
                    k: "Charts",
                    v: eda ? `${charts.length} loaded` : "—",
                    vc: "rgba(255,255,255,0.55)",
                  },
                  {
                    k: "Rows Scored",
                    v: report ? compactNumber(summary.total_transactions) : "—",
                    vc: "rgba(0,232,122,0.55)",
                  },
                  {
                    k: "Fraud Rate",
                    v: report ? `${summary.fraud_rate_percent ?? 0}%` : "—",
                    vc: "rgba(248,122,125,0.8)",
                  },
                ].map(({ k, v, vc }) => (
                  <div key={k} className="hud-row">
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "rgba(255,255,255,0.33)" }}
                    >
                      {k}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: vc }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Page header */}
              <div style={{ animation: "fadeUp 0.5s ease both" }}>
                <div className="pill" style={{ marginBottom: 13 }}>
                  <ImageIcon style={{ width: 9, height: 9 }} /> Visual EDA
                </div>
                <h1
                  className="serif"
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.12,
                    margin: "0 0 10px 0",
                  }}
                >
                  Dataset Exploration
                  <br />
                  <em style={{ fontStyle: "italic", color: "var(--green)" }}>
                    Studio
                  </em>
                </h1>
                <p
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.28)",
                    lineHeight: 1.8,
                    maxWidth: 520,
                  }}
                >
                  Validate dataset structure, spot drift from the sample, and
                  explain why the fraud model is reacting the way it does.
                </p>
              </div>

              {/* LOADING */}
              {loading && (
                <LoadingZone phase={loadPhase} progress={loadProgress} />
              )}

              {/* ERROR */}
              {!loading && error && (
                <div className="card" style={{ padding: "30px 34px" }}>
                  <div
                    className="mono"
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(239,68,68,0.2)",
                      background: "rgba(239,68,68,0.04)",
                      fontSize: 10,
                      color: "rgba(239,120,120,0.8)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ⚠ {error}
                  </div>
                </div>
              )}

              {/* OVERVIEW KPIs */}
              {!loading && eda && report && (
                <>
                  <section
                    ref={(n) => {
                      sectionRefs.current.overview = n;
                    }}
                    id="overview"
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
                          <BarChart3 style={{ width: 9, height: 9 }} /> Dataset
                          KPIs
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
                          Dataset metrics
                          <br />
                          <em
                            style={{
                              fontStyle: "italic",
                              color: "var(--green)",
                            }}
                          >
                            at a glance
                          </em>
                        </h2>
                      </div>
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
                        <DatabaseZap
                          style={{
                            width: 13,
                            height: 13,
                            color: "var(--green)",
                          }}
                        />
                        <span
                          className="mono"
                          style={{
                            fontSize: 9,
                            color: "var(--green)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {charts.length} CHARTS LOADED
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4,1fr)",
                        gap: 11,
                      }}
                    >
                      <KpiCard
                        label="Rows Scored"
                        value={compactNumber(summary.total_transactions ?? 0)}
                        icon={BarChart3}
                        delay={0}
                      />
                      <KpiCard
                        label="Fraud Detected"
                        value={compactNumber(summary.fraud_detected ?? 0)}
                        icon={Shield}
                        highlight
                        delay={55}
                      />
                      <KpiCard
                        label="Unique Patterns"
                        value={compactNumber(
                          summary.unique_patterns_detected ?? 0,
                        )}
                        icon={DatabaseZap}
                        delay={110}
                      />
                      <KpiCard
                        label="Fraud Rate"
                        value={`${summary.fraud_rate_percent ?? 0}%`}
                        icon={Zap}
                        highlight
                        delay={165}
                      />
                    </div>
                  </section>

                  {/* INSIGHTS */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.insights = n;
                    }}
                    id="insights"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.44s ease both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <DatabaseZap style={{ width: 9, height: 9 }} /> Chart
                        Interpretation
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
                        Why these
                        <br />
                        <em
                          style={{ fontStyle: "italic", color: "var(--green)" }}
                        >
                          charts matter
                        </em>
                      </h2>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 11,
                      }}
                    >
                      <InsightRow
                        icon={BarChart3}
                        color="rgba(0,232,122,0.6)"
                        borderColor="rgba(0,232,122,0.1)"
                        bg="rgba(0,232,122,0.025)"
                        text="Amount and balance plots help confirm whether score spikes come from true monetary anomalies or just a shifted value range."
                        delay={0}
                      />
                      <InsightRow
                        icon={ImageIcon}
                        color="rgba(116,161,255,0.7)"
                        borderColor="rgba(116,161,255,0.12)"
                        bg="rgba(116,161,255,0.025)"
                        text="Missingness, status, and category plots reveal whether the dataset is noisier than the sample and whether threshold behavior should adapt."
                        delay={60}
                      />
                      <InsightRow
                        icon={DatabaseZap}
                        color="rgba(228,180,68,0.7)"
                        borderColor="rgba(228,180,68,0.12)"
                        bg="rgba(228,180,68,0.025)"
                        text="Fraud-score and pattern-count distributions show how concentrated suspicious activity is, which is what the adaptive threshold uses."
                        delay={120}
                      />
                    </div>
                  </section>

                  {/* CHARTS GRID */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.charts = n;
                    }}
                    id="charts"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.5s ease 80ms both",
                    }}
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
                          <ImageIcon style={{ width: 9, height: 9 }} /> Visual
                          Artifacts
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
                          EDA
                          <br />
                          <em
                            style={{
                              fontStyle: "italic",
                              color: "var(--green)",
                            }}
                          >
                            charts
                          </em>
                        </h2>
                      </div>
                    </div>

                    {charts.length === 0 ? (
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.35)",
                          padding: "24px 0",
                        }}
                      >
                        No EDA charts were returned for this run.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 14,
                        }}
                      >
                        {charts.map((chart, i) => (
                          <ChartCard key={chart.name} chart={chart} index={i} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* NAV LINKS */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      animation: "slideUp 0.5s ease 160ms both",
                    }}
                  >
                    <a href="/fraud-report" className="btn-g">
                      <Shield style={{ width: 12, height: 12 }} /> Open Fraud
                      Report
                    </a>
                    <a href="/dashboard" className="btn-g">
                      <FileUp style={{ width: 12, height: 12 }} /> Back to
                      Dashboard
                    </a>
                    <a href="/graph" className="btn-g">
                      <Activity style={{ width: 12, height: 12 }} />{" "}
                      Relationship Graph
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
