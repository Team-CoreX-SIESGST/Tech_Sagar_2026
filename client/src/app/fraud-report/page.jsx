"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import {
  Activity,
  AlertTriangle,
  BadgeAlert,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FileUp,
  Shield,
  ShieldAlert,
  Siren,
  Sparkles,
  Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Formatters
───────────────────────────────────────────────────────────── */
const money = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "N/A"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(value));

const compactNumber = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "N/A"
    : new Intl.NumberFormat("en-IN").format(Number(value));

const formatClock = (timestamp) => {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatPercent = (v) =>
  Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "N/A";

/* ─────────────────────────────────────────────────────────────
   Severity palette
───────────────────────────────────────────────────────────── */
const severityPalette = {
  critical: {
    rail: "rgba(248,122,125,0.95)",
    glow: "rgba(248,122,125,0.28)",
    badgeBg: "rgba(248,122,125,0.13)",
    badgeText: "#f8a4a5",
    score: "#ff8d8f",
    border: "rgba(248,122,125,0.22)",
  },
  high: {
    rail: "rgba(228,180,68,0.95)",
    glow: "rgba(228,180,68,0.28)",
    badgeBg: "rgba(228,180,68,0.13)",
    badgeText: "#e8c05d",
    score: "#e8b84a",
    border: "rgba(228,180,68,0.22)",
  },
  medium: {
    rail: "rgba(116,161,255,0.95)",
    glow: "rgba(116,161,255,0.22)",
    badgeBg: "rgba(116,161,255,0.11)",
    badgeText: "#8db5ff",
    score: "#8db5ff",
    border: "rgba(116,161,255,0.18)",
  },
  low: {
    rail: "rgba(0,232,122,0.95)",
    glow: "rgba(0,232,122,0.22)",
    badgeBg: "rgba(0,232,122,0.10)",
    badgeText: "#6fe2a2",
    score: "#6fe2a2",
    border: "rgba(0,232,122,0.18)",
  },
};

/* ─────────────────────────────────────────────────────────────
   Signal value helper
───────────────────────────────────────────────────────────── */
const signalValueText = (detail, item) => {
  const raw = item.raw_values || {};
  switch (detail.signal) {
    case "amount_user_zscore":
      return `${money(raw.transaction_amount)} vs avg ${money(raw.user_avg_amount)}`;
    case "patterns_fired":
      return `${compactNumber(raw.patterns_fired)} signals`;
    case "users_per_ip":
    case "shared_ip_flag":
      return `users_per_ip = ${compactNumber(raw.users_per_ip)}`;
    case "users_per_device":
    case "shared_device_flag":
      return `users_per_device = ${compactNumber(raw.users_per_device)}`;
    case "odd_hour_high_amount_flag":
      return formatClock(raw.transaction_timestamp);
    case "new_device_for_user_flag":
      return "first occurrence";
    case "new_merchant_city_flag":
      return `first time in ${raw.merchant_location || "new city"}`;
    case "location_mismatch_flag":
      return `${raw.user_location || "unknown"} → ${raw.merchant_location || "unknown"}`;
    case "amount_exceeds_balance_flag":
    case "successful_overdraft_flag":
      return `${money(raw.transaction_amount)} vs bal ${money(raw.account_balance)}`;
    case "high_balance_utilization_flag":
      return `${money(raw.transaction_amount)} / ${money(raw.account_balance)}`;
    case "cleaning_flag_score":
      return "quality flags";
    default:
      return detail.severity;
  }
};

/* ─────────────────────────────────────────────────────────────
   ColumnStreams  — same canvas background from dashboard
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
  const c = active ? "rgba(248,122,125,0.68)" : "rgba(0,232,122,0.16)";
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
        {active ? "Fetching fraud report" : "Ready"}
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
   KPI Card  — matches dashboard KpiCard exactly
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
   Stat Mini
───────────────────────────────────────────────────────────── */
const StatMini = ({ label, value, delay = 0 }) => (
  <div
    style={{
      borderRadius: 12,
      border: "1px solid rgba(0,232,122,0.08)",
      background: "rgba(0,232,122,0.02)",
      padding: "13px 16px",
      animation: `kpiIn 0.5s ease ${delay}ms both`,
    }}
  >
    <p
      style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 9,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.26)",
        textTransform: "uppercase",
        marginBottom: 7,
      }}
    >
      {label}
    </p>
    <p
      style={{
        fontFamily: "'Playfair Display',Georgia,serif",
        fontSize: 24,
        fontWeight: 700,
        color: "rgba(255,255,255,0.76)",
        margin: 0,
      }}
    >
      {value}
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   FraudCard — complete redesign matching dashboard aesthetic
───────────────────────────────────────────────────────────── */
const FraudCard = ({ item, index }) => {
  const palette = severityPalette[item.criticality] || severityPalette.low;
  const scorePercent = Math.max(
    10,
    Math.min(item.fraud_probability * 100, 100),
  );
  const raw = item.raw_values || {};
  const subtitleBits = [
    item.user_id,
    money(raw.transaction_amount),
    item.payment_method ? String(item.payment_method).toUpperCase() : null,
    raw.user_location || item.user_location,
    formatClock(raw.transaction_timestamp || item.transaction_timestamp),
    raw.device_id || item.device_id,
  ].filter(Boolean);

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${palette.border}`,
        background: "rgba(9,13,17,0.92)",
        backdropFilter: "blur(18px)",
        position: "relative",
        overflow: "hidden",
        animation: `slideUp 0.5s ease ${index * 70}ms both`,
      }}
    >
      {/* Left severity rail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: palette.rail,
          boxShadow: `0 0 24px ${palette.glow}`,
        }}
      />

      {/* Top-right glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 120,
          height: 80,
          background: `radial-gradient(circle at top right,${palette.glow},transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ padding: "22px 24px 22px 28px" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <h2
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "rgba(255,255,255,0.92)",
                  margin: 0,
                }}
              >
                {item.transaction_id}
              </h2>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  background: palette.badgeBg,
                  color: palette.badgeText,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {item.criticality}
              </span>
            </div>
            <p
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.04em",
                lineHeight: 1.9,
                margin: 0,
              }}
            >
              {subtitleBits.join(" · ")}
            </p>
          </div>

          {/* Score bubble */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: "'Playfair Display',Georgia,serif",
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 1,
                color: palette.score,
                letterSpacing: "-0.03em",
              }}
            >
              {item.fraud_probability.toFixed(2)}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 8,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.28)",
                marginTop: 3,
              }}
            >
              Fraud Score
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 2,
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 1,
            overflow: "hidden",
            marginBottom: 18,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${scorePercent}%`,
              background: `linear-gradient(to right, ${palette.rail}, ${palette.score})`,
              boxShadow: `0 0 8px ${palette.glow}`,
            }}
          />
        </div>

        {/* Signal rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            marginBottom: 14,
          }}
        >
          {(item.signal_details || []).map((detail) => (
            <div
              key={`${item.transaction_id}-${detail.signal}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "9px 0",
                borderBottom: "1px solid rgba(255,255,255,0.048)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background:
                      detail.severity === "high"
                        ? palette.rail
                        : detail.severity === "medium"
                          ? "#e8b84a"
                          : "#8db5ff",
                    boxShadow:
                      detail.severity === "high"
                        ? `0 0 10px ${palette.glow}`
                        : "none",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.78)",
                    lineHeight: 1.6,
                  }}
                >
                  {detail.description}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.42)",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {signalValueText(detail, item)}
              </span>
            </div>
          ))}
        </div>

        {/* Plain-English reason */}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.18)",
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              lineHeight: 1.82,
              color: "rgba(255,255,255,0.48)",
              margin: 0,
            }}
          >
            {item.plain_english_reason}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Loading State — matches dashboard upload zone feel
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
   Main Page
───────────────────────────────────────────────────────────── */
export default function FraudReportPage() {
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
    { id: "transactions", label: "Transactions", icon: ShieldAlert },
    { id: "patterns", label: "Patterns", icon: Activity },
    { id: "summary", label: "Summary", icon: Shield },
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
      { label: "FETCHING REPORT", end: 22 },
      { label: "PARSING RECORDS", end: 48 },
      { label: "SCORING SIGNALS", end: 70 },
      { label: "RANKING THREATS", end: 88 },
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

        const [response] = await Promise.all([
          fetch("/api/fraud-report", { cache: "no-store" }),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
        const data = await response.json();
        if (!response.ok)
          throw new Error(data?.error || "Failed to load report.");

        if (cancelSimRef.current) {
          cancelSimRef.current();
          cancelSimRef.current = null;
        }
        setLoadProgress(100);
        setLoadPhase("COMPLETE");
        await new Promise((r) => setTimeout(r, 600));
        setReport(data);
        setActiveSection("overview");
      } catch (err) {
        setError(err.message || "Failed to load report.");
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

  const summary = report?.summary || {};
  const topTransactions = report?.top_fraud_transactions || [];
  const patternBreakdown = report?.pattern_breakdown || {};
  const orderedPatterns = useMemo(
    () => Object.entries(patternBreakdown).sort((a, b) => b[1] - a[1]),
    [patternBreakdown],
  );
  const maxPatternVal = orderedPatterns[0]?.[1] || 1;

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

        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes kpiIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes badgeIn  { from{opacity:0;transform:scale(0.9) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes dot-blink{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes icon-breathe { 0%,100%{opacity:0.55} 50%{opacity:1} }
        @keyframes rail-glow { 0%,100%{opacity:0.85} 50%{opacity:1} }

        .card {
          border-radius: 20px;
          border: 1px solid var(--bdr);
          background: var(--card);
          backdrop-filter: blur(18px);
          transition: border-color 0.3s ease;
        }
        .card:hover { border-color: var(--bdr-h); }

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

        .pattern-bar-track {
          height: 2px;
          width: 100%;
          background: rgba(0,232,122,0.07);
          border-radius: 1px;
          overflow: hidden;
          position: relative;
        }
        .pattern-bar-fill {
          position: absolute;
          top: 0; left: 0; height: 100%;
          background: linear-gradient(to right, rgba(0,232,122,0.5), rgba(0,232,122,0.95));
          box-shadow: 0 0 6px rgba(0,232,122,0.45);
          transition: width 0.8s ease;
        }
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
                    "linear-gradient(140deg,rgba(248,68,68,0.04) 0%,rgba(9,13,17,0.96) 55%)",
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
                      background: "rgb(248,122,125)",
                      animation: "dot-blink 2.8s ease infinite",
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      color: "rgba(248,122,125,0.55)",
                      textTransform: "uppercase",
                    }}
                  >
                    Fraud Report
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
                  Investigate · Score · Triage
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
                    v: loading
                      ? "● FETCHING"
                      : report
                        ? "● COMPLETE"
                        : "● ERROR",
                    vc: loading
                      ? "var(--green)"
                      : report
                        ? "rgba(0,232,122,0.55)"
                        : "rgba(239,68,68,0.7)",
                  },
                  {
                    k: "Fraud Detected",
                    v: report ? compactNumber(summary.fraud_detected) : "—",
                    vc: "rgba(248,122,125,0.8)",
                  },
                  {
                    k: "Critical",
                    v: report ? compactNumber(summary.critical_count) : "—",
                    vc: "rgba(255,255,255,0.55)",
                  },
                  {
                    k: "Fraud Rate",
                    v: report ? `${summary.fraud_rate_percent ?? 0}%` : "—",
                    vc: "rgba(0,232,122,0.55)",
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
                  <ShieldAlert style={{ width: 9, height: 9 }} /> Transaction
                  Investigation Feed
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
                  Fraud Triage
                  <br />
                  <em
                    style={{ fontStyle: "italic", color: "rgb(248,122,125)" }}
                  >
                    Report
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
                  Highest-risk transactions ranked by score. Each card shows the
                  evidence stack, signal severity, and plain-English narrative
                  used during fraud triage.
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
              {!loading && report && (
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
                          <BarChart3 style={{ width: 9, height: 9 }} /> Overview
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
                          Risk metrics
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
                      {report.generated_at && (
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
                          <CalendarClock
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
                            {new Date(report.generated_at).toLocaleString()}
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
                        label="Fraud Detected"
                        value={compactNumber(summary.fraud_detected ?? 0)}
                        icon={ShieldAlert}
                        highlight
                        delay={0}
                      />
                      <KpiCard
                        label="Critical"
                        value={compactNumber(summary.critical_count ?? 0)}
                        icon={Siren}
                        highlight
                        delay={55}
                      />
                      <KpiCard
                        label="High"
                        value={compactNumber(summary.high_count ?? 0)}
                        icon={BadgeAlert}
                        delay={110}
                      />
                      <KpiCard
                        label="Fraud Rate"
                        value={`${summary.fraud_rate_percent ?? 0}%`}
                        icon={Sparkles}
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
                      <StatMini
                        label="Total Transactions"
                        value={compactNumber(summary.total_transactions ?? 0)}
                        delay={215}
                      />
                      <StatMini
                        label="Patterns Fired"
                        value={compactNumber(summary.patterns_fired_total ?? 0)}
                        delay={270}
                      />
                      <StatMini
                        label="Unique Patterns"
                        value={compactNumber(
                          summary.unique_patterns_detected ?? 0,
                        )}
                        delay={325}
                      />
                    </div>
                  </section>

                  {/* TRANSACTIONS */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.transactions = n;
                    }}
                    id="transactions"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.44s ease both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <ShieldAlert style={{ width: 9, height: 9 }} /> Flagged
                        Transactions
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
                        Investigation
                        <br />
                        <em
                          style={{
                            fontStyle: "italic",
                            color: "rgb(248,122,125)",
                          }}
                        >
                          feed
                        </em>
                      </h2>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      {topTransactions.slice(0, 8).map((item, i) => (
                        <FraudCard
                          key={item.transaction_id}
                          item={item}
                          index={i}
                        />
                      ))}
                      {topTransactions.length === 0 && (
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.35)",
                            padding: "24px 0",
                          }}
                        >
                          No flagged transactions in this report.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* PATTERNS */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.patterns = n;
                    }}
                    id="patterns"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.5s ease 80ms both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Activity style={{ width: 9, height: 9 }} /> Pattern
                        Breakdown
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
                        Pattern
                        <br />
                        <em
                          style={{ fontStyle: "italic", color: "var(--green)" }}
                        >
                          pressure
                        </em>
                      </h2>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {orderedPatterns.map(([key, value], i) => (
                        <div
                          key={key}
                          style={{
                            animation: `kpiIn 0.5s ease ${i * 60}ms both`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.68)",
                                textTransform: "capitalize",
                              }}
                            >
                              {key}
                            </span>
                            <span
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: "rgba(0,232,122,0.7)",
                                fontWeight: 700,
                              }}
                            >
                              {compactNumber(value)}
                            </span>
                          </div>
                          <div className="pattern-bar-track">
                            <div
                              className="pattern-bar-fill"
                              style={{
                                width: `${Math.min((value / maxPatternVal) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* SUMMARY + OPERATOR NOTE */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.summary = n;
                    }}
                    id="summary"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.5s ease 120ms both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Shield style={{ width: 9, height: 9 }} /> Run Summary
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
                        Model &amp;
                        <br />
                        <em
                          style={{ fontStyle: "italic", color: "var(--green)" }}
                        >
                          metadata
                        </em>
                      </h2>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 13,
                      }}
                    >
                      {/* Run info */}
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
                          Model Info
                        </div>
                        {[
                          {
                            k: "Model Type",
                            v: report?.model_info?.model_type ?? "unknown",
                          },
                          {
                            k: "Threshold",
                            v: report?.model_info?.threshold_used ?? "N/A",
                          },
                          {
                            k: "Total Transactions",
                            v: compactNumber(summary.total_transactions ?? 0),
                          },
                          {
                            k: "Patterns Fired Total",
                            v: compactNumber(summary.patterns_fired_total ?? 0),
                          },
                          {
                            k: "Unique Patterns",
                            v: compactNumber(
                              summary.unique_patterns_detected ?? 0,
                            ),
                          },
                        ].map(({ k, v }) => (
                          <div key={k} className="hud-row">
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                color: "rgba(255,255,255,0.33)",
                              }}
                            >
                              {k}
                            </span>
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                color: "rgba(0,232,122,0.65)",
                              }}
                            >
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Operator notes */}
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
                          Operator Note
                        </div>
                        {[
                          {
                            icon: AlertTriangle,
                            c: "rgba(239,68,68,0.55)",
                            b: "rgba(239,68,68,0.1)",
                            bg: "rgba(239,68,68,0.025)",
                            t: "Prioritize cards where the score is high and the evidence stack shows multiple independent signals.",
                          },
                          {
                            icon: CheckCircle2,
                            c: "rgba(0,232,122,0.6)",
                            b: "rgba(0,232,122,0.1)",
                            bg: "rgba(0,232,122,0.025)",
                            t: "Those combinations are the strongest cases to surface in demos, reviews, and judge walkthroughs.",
                          },
                          {
                            icon: Zap,
                            c: "rgba(0,232,122,0.4)",
                            b: "rgba(0,232,122,0.07)",
                            bg: "rgba(0,0,0,0.16)",
                            t: "High outlier counts may indicate behavioral anomalies worth routing to the risk scoring module.",
                          },
                        ].map(({ icon: Icon, c, b, bg, t }, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 10,
                              padding: "11px 12px",
                              borderRadius: 9,
                              border: `1px solid ${b}`,
                              background: bg,
                              marginBottom: i < 2 ? 8 : 0,
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

                    {/* Nav links */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <a href="/dashboard" className="btn-g">
                        <FileUp style={{ width: 12, height: 12 }} /> Back to
                        Dashboard
                      </a>
                      <a href="/eda" className="btn-g">
                        <BarChart3 style={{ width: 12, height: 12 }} /> Open EDA
                      </a>
                      <a href="/graph" className="btn-g">
                        <Activity style={{ width: 12, height: 12 }} />{" "}
                        Relationship Graph
                      </a>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
