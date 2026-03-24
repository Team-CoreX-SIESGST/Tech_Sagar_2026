"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  DatabaseZap,
  FileUp,
  IndianRupee,
  MapPin,
  Shield,
  ShieldAlert,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Formatters
───────────────────────────────────────────────────────────── */
const numberText = (v) =>
  v == null || Number.isNaN(Number(v))
    ? "N/A"
    : new Intl.NumberFormat("en-IN").format(Number(v));

const moneyText = (v) =>
  v == null || Number.isNaN(Number(v))
    ? "N/A"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(v));

const percentText = (v) =>
  Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "N/A";

const dateTimeText = (v) => {
  if (!v) return "N/A";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString();
};

/* ─────────────────────────────────────────────────────────────
   ColumnStreams
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
    const NUM = 30,
      DS = 17,
      DR = 1.05;
    let cols = [];

    const build = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.offsetWidth,
        H = canvas.offsetHeight;
      const sp = W / (NUM + 1);
      cols = Array.from({ length: NUM }, (_, i) => ({
        x: sp * (i + 1),
        offset: Math.random() * DS,
        speed: 0.28 + Math.random() * 0.42,
        bright: 0,
        brightDecay: 0,
        waveDelay: i * 52,
        waveArmed: false,
        dotAlphas: Array.from(
          { length: Math.ceil(H / DS) + 2 },
          () => 0.04 + Math.random() * 0.05,
        ),
      }));
    };
    build();
    window.addEventListener("resize", build);

    let waveStart = null,
      wasActive = false;
    const draw = (ts) => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const H = canvas.offsetHeight,
        isOn = activeRef.current;
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
          col.offset = (col.offset + col.speed * 0.38) % DS;
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
        const nd = Math.ceil(H / DS) + 2;
        for (let d = 0; d < nd; d++) {
          const y = d * DS - col.offset;
          if (y < -2 || y > H + 2) continue;
          const base = col.dotAlphas[d] ?? 0.045;
          const alpha = isOn
            ? base + col.bright * 0.65
            : base * (0.45 + 0.55 * Math.sin(ts / 2800 + col.x * 0.01));
          ctx.beginPath();
          ctx.arc(col.x, y, DR, 0, Math.PI * 2);
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
  const corners = [
    { top: 14, left: 14, rot: 0 },
    { top: 14, right: 14, rot: 90 },
    { bottom: 14, right: 14, rot: 180 },
    { bottom: 14, left: 14, rot: 270 },
  ];
  const c = active ? "rgba(0,232,122,0.68)" : "rgba(0,232,122,0.16)";
  return (
    <>
      <style>{`@keyframes bkt-in{from{opacity:0;transform:rotate(var(--r)) scale(1.2)}to{opacity:1;transform:rotate(var(--r)) scale(1)}}@keyframes bkt-pulse{0%,100%{opacity:.68}50%{opacity:1}}`}</style>
      {corners.map((corner, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 20,
            height: 20,
            ...(corner.top !== undefined ? { top: corner.top } : {}),
            ...(corner.bottom !== undefined ? { bottom: corner.bottom } : {}),
            ...(corner.left !== undefined ? { left: corner.left } : {}),
            ...(corner.right !== undefined ? { right: corner.right } : {}),
            "--r": `${corner.rot}deg`,
            transform: `rotate(${corner.rot}deg)`,
            borderTop: `1.8px solid ${c}`,
            borderLeft: `1.8px solid ${c}`,
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
   PhaseText / ScanningBar / LoadingZone
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
        {active ? "Computing KPI analytics" : "Ready"}
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
          margin: 0,
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
        margin: 0,
      }}
    >
      {value ?? "N/A"}
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   ─── NEW StatBar  ─── replaces StatMini
   A horizontal metric row: label | value | filled bar
───────────────────────────────────────────────────────────── */
const StatBar = ({
  label,
  value,
  displayValue,
  max = 100,
  accent = "var(--green)",
  delay = 0,
}) => {
  const pct = Math.min(Math.max((Number(value) / Number(max)) * 100, 4), 100);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid rgba(255,255,255,0.045)",
        animation: `kpiIn 0.5s ease ${delay}ms both`,
      }}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.38)",
          letterSpacing: "0.04em",
          flexShrink: 0,
          width: 130,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(to right, ${accent}, rgba(255,255,255,0.14))`,
            boxShadow: `0 0 8px ${accent}`,
            borderRadius: 2,
            transition: "width 0.9s ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "'Playfair Display',Georgia,serif",
          fontSize: 16,
          fontWeight: 700,
          color: "rgba(255,255,255,0.82)",
          flexShrink: 0,
          minWidth: 72,
          textAlign: "right",
          letterSpacing: "-0.01em",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   ─── NEW StatGroup  ───
   Section header + a run of StatBar rows inside a card shell
───────────────────────────────────────────────────────────── */
const StatGroup = ({ title, pill, rows }) => (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.052)",
      background: "rgba(0,0,0,0.12)",
      padding: "16px 18px",
      marginBottom: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'Playfair Display',Georgia,serif",
          fontSize: 15,
          fontWeight: 700,
          color: "rgba(255,255,255,0.72)",
          letterSpacing: "0",
        }}
      >
        {title}
      </span>
      {pill && (
        <span
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 8,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(0,232,122,0.5)",
            padding: "2px 7px",
            borderRadius: 4,
            border: "1px solid rgba(0,232,122,0.14)",
            background: "rgba(0,232,122,0.03)",
          }}
        >
          {pill}
        </span>
      )}
    </div>
    {rows.map((row, i) => (
      <StatBar key={row.label} {...row} delay={i * 55} />
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────
   ─── NEW LeaderCard  ─── replaces LeaderItem
   Tight card with icon, label, truncated value, and count badge
───────────────────────────────────────────────────────────── */
const LeaderCard = ({ label, value, meta, icon: Icon, accent, delay = 0 }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "36px 1fr auto",
      alignItems: "center",
      gap: 11,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.055)",
      background: "rgba(255,255,255,0.018)",
      transition: "border-color 0.2s",
      animation: `kpiIn 0.45s ease ${delay}ms both`,
    }}
    onMouseEnter={(e) =>
      (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")
    }
    onMouseLeave={(e) =>
      (e.currentTarget.style.borderColor = "rgba(255,255,255,0.055)")
    }
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        border: `1px solid ${accent}22`,
        background: `${accent}0f`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon style={{ width: 14, height: 14, color: accent }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 8,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.26)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 11,
          color: "rgba(255,255,255,0.78)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
    <div
      style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 11,
        fontWeight: 700,
        color: accent,
        flexShrink: 0,
        padding: "3px 8px",
        borderRadius: 6,
        border: `1px solid ${accent}22`,
        background: `${accent}0d`,
      }}
    >
      {meta}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   ControlButton
───────────────────────────────────────────────────────────── */
const ControlButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: "8px 11px",
      borderRadius: 8,
      border: active
        ? "1px solid rgba(0,232,122,0.3)"
        : "1px solid rgba(255,255,255,0.06)",
      background: active ? "rgba(0,232,122,0.08)" : "rgba(255,255,255,0.02)",
      color: active ? "var(--green)" : "rgba(255,255,255,0.56)",
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 9,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    {children}
  </button>
);

/* ─────────────────────────────────────────────────────────────
   BreakdownPanel
───────────────────────────────────────────────────────────── */
const BreakdownPanel = ({ title, caption, items, accent = "var(--green)" }) => {
  const maxV = Math.max(...items.map((i) => Number(i.count || 0)), 1);
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.052)",
        background: "rgba(0,0,0,0.12)",
        padding: "18px 19px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
              marginBottom: 6,
            }}
          >
            Breakdown
          </div>
          <h3
            style={{
              fontFamily: "'Playfair Display',Georgia,serif",
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,0.86)",
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 8,
            letterSpacing: "0.14em",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {caption}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length ? (
          items.map((item, i) => (
            <div
              key={`${title}-${item.label}`}
              style={{ animation: `kpiIn 0.45s ease ${i * 60}ms both` }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 7,
                }}
              >
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.72)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 10,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {numberText(item.count)}
                </span>
              </div>
              <div className="pattern-bar-track">
                <div
                  className="pattern-bar-fill"
                  style={{
                    width: `${Math.min((Number(item.count || 0) / maxV) * 100, 100)}%`,
                    background: `linear-gradient(to right, ${accent}, rgba(255,255,255,0.08))`,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            No distribution data.
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CategoryMetricChart / TrendChart / HistogramChart
───────────────────────────────────────────────────────────── */
const CategoryMetricChart = ({
  data,
  metric,
  accent,
  formatter,
  emptyText = "No chart data returned.",
}) => {
  const maxV = Math.max(...data.map((i) => Number(i?.[metric] || 0)), 1);
  if (!data.length)
    return (
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        {emptyText}
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((item, i) => {
        const v = Number(item?.[metric] || 0);
        return (
          <div key={`${item.label}-${i}`}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 7,
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.72)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 10,
                  color: accent,
                  flexShrink: 0,
                }}
              >
                {formatter(v)}
              </span>
            </div>
            <div
              className="pattern-bar-track"
              style={{ height: 6, borderRadius: 999 }}
            >
              <div
                className="pattern-bar-fill"
                style={{
                  width: `${Math.min((v / maxV) * 100, 100)}%`,
                  background: `linear-gradient(to right, ${accent}, rgba(255,255,255,0.12))`,
                  boxShadow: `0 0 10px ${accent}`,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TrendChart = ({ data, metric, accent, formatter }) => {
  if (!data.length)
    return (
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        No hourly trend returned for this run.
      </div>
    );
  const W = 680,
    H = 230,
    pX = 18,
    pY = 20,
    iW = W - pX * 2,
    iH = H - pY * 2;
  const vals = data.map((i) => Number(i?.[metric] || 0));
  const maxV = Math.max(...vals, 1);
  const pts = data.map((item, i) => ({
    x: pX + (i / Math.max(data.length - 1, 1)) * iW,
    y: pY + iH - (Number(item?.[metric] || 0) / maxV) * iH,
    label: item.label,
    raw: Number(item?.[metric] || 0),
  }));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `M ${pX},${pY + iH}`,
    ...pts.map((p) => `L ${p.x},${p.y}`),
    `L ${pX + iW},${pY + iH}`,
    "Z",
  ].join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220 }}>
        {[0.25, 0.5, 0.75, 1].map((r) => {
          const y = pY + iH - iH * r;
          return (
            <line
              key={r}
              x1={pX}
              y1={y}
              x2={pX + iW}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray="4 6"
            />
          );
        })}
        <path d={area} fill={accent.replace(/[\d.]+\)$/, "0.14)")} />
        <polyline
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly}
        />
        {pts
          .filter((_, i) => i % 3 === 0)
          .map((p) => (
            <g key={`${p.label}-${p.x}`}>
              <circle cx={p.x} cy={p.y} r="4.5" fill={accent} />
              <circle cx={p.x} cy={p.y} r="9" fill="transparent">
                <title>{`${p.label}: ${formatter(p.raw)}`}</title>
              </circle>
            </g>
          ))}
      </svg>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {[0, 4, 8, 12, 16, 20].map((i) => (
          <div
            key={i}
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              color: "rgba(255,255,255,0.28)",
            }}
          >
            {data[i]?.label || `${String(i).padStart(2, "0")}:00`}
          </div>
        ))}
      </div>
    </div>
  );
};

const HistogramChart = ({ data, accent, formatter }) => {
  const maxV = Math.max(...data.map((i) => Number(i.count || 0)), 1);
  const stride = Math.max(Math.ceil(data.length / 6), 1);
  if (!data.length)
    return (
      <div
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        No histogram bins returned for this field.
      </div>
    );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        minHeight: 210,
        paddingTop: 8,
      }}
    >
      {data.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 9,
          }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              color: "rgba(255,255,255,0.32)",
            }}
          >
            {formatter(item.count)}
          </div>
          <div
            style={{
              width: "100%",
              height: `${Math.max((Number(item.count || 0) / maxV) * 150, 8)}px`,
              borderRadius: "10px 10px 4px 4px",
              background: `linear-gradient(180deg, ${accent}, rgba(255,255,255,0.1))`,
              boxShadow: `0 0 12px ${accent}`,
            }}
            title={`${item.label}: ${formatter(item.count)}`}
          />
          <div
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 8,
              color: "rgba(255,255,255,0.24)",
              textAlign: "center",
              minHeight: 20,
            }}
          >
            {i % stride === 0 ? item.label : ""}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────── */
export default function KpisPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadPhase, setLoadPhase] = useState("INITIALIZING");
  const [loadProgress, setLoadProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [statLens, setStatLens] = useState("transaction_amount");
  const [categoryDimension, setCategoryDimension] = useState("payment_method");
  const [categoryMetric, setCategoryMetric] = useState("count");
  const [topN, setTopN] = useState(6);
  const [distributionMetric, setDistributionMetric] =
    useState("amount_histogram");
  const [hourlyMetric, setHourlyMetric] = useState("count");

  const sectionRefs = useRef({});
  const cancelSimRef = useRef(null);

  const sections = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: BarChart3 },
      { id: "analytics", label: "Analytics", icon: Activity },
      { id: "graphs", label: "Graphs", icon: DatabaseZap },
      { id: "distribution", label: "Distribution", icon: DatabaseZap },
      { id: "source", label: "Source", icon: Database },
    ],
    [],
  );

  useEffect(() => {
    const runProgressSim = () => {
      const phases = [
        { label: "FETCHING CLEANED DATA", end: 22 },
        { label: "SCANNING KPIS", end: 46 },
        { label: "BUILDING BREAKDOWNS", end: 72 },
        { label: "ASSEMBLING ANALYTICS", end: 92 },
        { label: "FINALIZING", end: 97 },
      ];
      let idx = 0,
        cur = 0,
        timer = null,
        active = true;
      const tick = () => {
        if (!active || idx >= phases.length) return;
        setLoadPhase(phases[idx].label);
        if (cur < phases[idx].end) {
          cur += 0.8 + Math.random() * 1.2;
          setLoadProgress(Math.min(cur, phases[idx].end));
          timer = setTimeout(tick, 65);
        } else {
          idx += 1;
          timer = setTimeout(tick, 130);
        }
      };
      tick();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    };

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setLoadProgress(0);
        setLoadPhase("INITIALIZING");
        const cancel = runProgressSim();
        cancelSimRef.current = cancel;
        const [response] = await Promise.all([
          fetch("/api/kpis", { cache: "no-store" }),
          new Promise((r) => setTimeout(r, 1600)),
        ]);
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload?.error || "Failed to load cleaned-data KPIs.",
          );
        if (cancelSimRef.current) {
          cancelSimRef.current();
          cancelSimRef.current = null;
        }
        setLoadProgress(100);
        setLoadPhase("COMPLETE");
        await new Promise((r) => setTimeout(r, 450));
        setData(payload);
        setActiveSection("overview");
      } catch (err) {
        setError(err.message || "Failed to load cleaned-data KPIs.");
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

  useEffect(() => {
    if (loading) return;
    const onScroll = () => {
      const threshold = window.scrollY + 180;
      let next = sections[0]?.id || "overview";
      sections.forEach(({ id }) => {
        const n = sectionRefs.current[id];
        if (n && threshold >= n.offsetTop) next = id;
      });
      setActiveSection(next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, sections]);

  const navigateToSection = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const summary = data?.summary || {};
  const leaders = data?.leaders || {};
  const breakdowns = data?.breakdowns || {};
  const analytics = data?.analytics || {};
  const charts = data?.charts || {};
  const sourceColumns = data?.source?.column_names || [];

  const heroCards = useMemo(
    () => [
      {
        label: "Cleaned Rows",
        value: numberText(summary.cleaned_transactions),
        icon: Database,
      },
      {
        label: "Unique Users",
        value: numberText(summary.unique_users),
        icon: Users,
      },
      {
        label: "Txn Value",
        value: moneyText(summary.total_transaction_value),
        icon: IndianRupee,
      },
      {
        label: "Success Rate",
        value: percentText(summary.success_rate),
        icon: CheckCircle2,
      },
    ],
    [summary],
  );

  const riskCards = useMemo(
    () => [
      {
        label: "Unique Devices",
        value: numberText(summary.unique_devices),
        icon: Smartphone,
      },
      {
        label: "Avg Amount",
        value: moneyText(summary.average_transaction_amount),
        icon: BarChart3,
      },
      {
        label: "Invalid IP Rows",
        value: numberText(summary.invalid_ip_rows),
        icon: AlertTriangle,
        highlight: true,
      },
      {
        label: "Outlier Rows",
        value: numberText(summary.amount_outlier_rows),
        icon: ShieldAlert,
        highlight: true,
      },
    ],
    [summary],
  );

  /* ── NEW: stat bar groups replacing statLensCards ── */
  const statBarGroups = useMemo(() => {
    if (statLens === "account_balance") {
      const min = Number(analytics.account_balance?.min || 0);
      const max = Number(analytics.account_balance?.p90 || 1);
      return [
        {
          title: "Account Balance",
          pill: "Distribution",
          rows: [
            {
              label: "Minimum",
              value: min,
              displayValue: moneyText(analytics.account_balance?.min),
              max,
              accent: "rgba(116,161,255,0.82)",
            },
            {
              label: "Median",
              value: Number(analytics.account_balance?.median || 0),
              displayValue: moneyText(analytics.account_balance?.median),
              max,
              accent: "rgba(116,161,255,0.82)",
            },
            {
              label: "90th Pctile",
              value: max,
              displayValue: moneyText(analytics.account_balance?.p90),
              max,
              accent: "rgba(116,161,255,0.82)",
            },
            {
              label: "Std Deviation",
              value: Number(analytics.account_balance?.std || 0),
              displayValue: moneyText(analytics.account_balance?.std),
              max,
              accent: "rgba(116,161,255,0.82)",
            },
          ],
        },
      ];
    }
    if (statLens === "throughput") {
      const maxT = Math.max(
        Number(analytics.transactions_per_user || 0),
        Number(analytics.transactions_per_device || 0),
        Number(analytics.users_per_location || 0),
        1,
      );
      return [
        {
          title: "Throughput Ratios",
          pill: "Per Entity",
          rows: [
            {
              label: "Txn / User",
              value: Number(analytics.transactions_per_user || 0),
              displayValue: String(analytics.transactions_per_user ?? "N/A"),
              max: maxT,
              accent: "rgba(228,180,68,0.82)",
            },
            {
              label: "Txn / Device",
              value: Number(analytics.transactions_per_device || 0),
              displayValue: String(analytics.transactions_per_device ?? "N/A"),
              max: maxT,
              accent: "rgba(228,180,68,0.82)",
            },
            {
              label: "Users / Location",
              value: Number(analytics.users_per_location || 0),
              displayValue: String(analytics.users_per_location ?? "N/A"),
              max: maxT,
              accent: "rgba(228,180,68,0.82)",
            },
            {
              label: "Unique Locations",
              value: Number(summary.unique_locations || 0),
              displayValue: numberText(summary.unique_locations),
              max: Number(summary.unique_locations || 1),
              accent: "rgba(228,180,68,0.82)",
            },
          ],
        },
      ];
    }
    // default: transaction_amount
    const maxA = Number(analytics.transaction_amount?.p90 || 1);
    return [
      {
        title: "Transaction Amount",
        pill: "₹ Stats",
        rows: [
          {
            label: "Minimum",
            value: Number(analytics.transaction_amount?.min || 0),
            displayValue: moneyText(analytics.transaction_amount?.min),
            max: maxA,
            accent: "rgba(0,232,122,0.8)",
          },
          {
            label: "Q1 (25th pctile)",
            value: Number(analytics.transaction_amount?.q1 || 0),
            displayValue: moneyText(analytics.transaction_amount?.q1),
            max: maxA,
            accent: "rgba(0,232,122,0.8)",
          },
          {
            label: "90th Pctile",
            value: maxA,
            displayValue: moneyText(analytics.transaction_amount?.p90),
            max: maxA,
            accent: "rgba(0,232,122,0.8)",
          },
          {
            label: "Std Deviation",
            value: Number(analytics.transaction_amount?.std || 0),
            displayValue: moneyText(analytics.transaction_amount?.std),
            max: maxA,
            accent: "rgba(0,232,122,0.8)",
          },
        ],
      },
    ];
  }, [analytics, statLens, summary]);

  const leaderCards = useMemo(
    () => [
      {
        label: "Top payment method",
        value: leaders.top_payment_method?.label || "N/A",
        meta: numberText(leaders.top_payment_method?.count),
        icon: CreditCard,
        accent: "rgba(0,232,122,0.75)",
      },
      {
        label: "Top user location",
        value: leaders.top_user_location?.label || "N/A",
        meta: numberText(leaders.top_user_location?.count),
        icon: MapPin,
        accent: "rgba(116,161,255,0.82)",
      },
      {
        label: "Top merchant category",
        value: leaders.top_merchant_category?.label || "N/A",
        meta: numberText(leaders.top_merchant_category?.count),
        icon: Shield,
        accent: "rgba(228,180,68,0.82)",
      },
      {
        label: "Peak transaction hour",
        value: leaders.peak_transaction_hour?.label || "N/A",
        meta: numberText(leaders.peak_transaction_hour?.count),
        icon: Clock3,
        accent: "rgba(248,122,125,0.82)",
      },
    ],
    [leaders],
  );

  const breakdownGroups = useMemo(
    () => [
      {
        title: "Payment Methods",
        caption: "Mode mix",
        items: breakdowns.payment_methods || [],
        accent: "rgba(0,232,122,0.85)",
      },
      {
        title: "Merchant Categories",
        caption: "Spend surface",
        items: breakdowns.merchant_categories || [],
        accent: "rgba(228,180,68,0.88)",
      },
      {
        title: "User Locations",
        caption: "Geo density",
        items: breakdowns.user_locations || [],
        accent: "rgba(116,161,255,0.9)",
      },
      {
        title: "Transaction Status",
        caption: "Outcome mix",
        items: breakdowns.transaction_statuses || [],
        accent: "rgba(248,122,125,0.86)",
      },
    ],
    [breakdowns],
  );

  const metricFormatters = useMemo(
    () => ({
      count: numberText,
      total_amount: moneyText,
      average_amount: moneyText,
      success_rate: percentText,
    }),
    [],
  );
  const metricAccent = useMemo(
    () => ({
      count: "rgba(0,232,122,0.88)",
      total_amount: "rgba(228,180,68,0.88)",
      average_amount: "rgba(116,161,255,0.88)",
      success_rate: "rgba(248,122,125,0.88)",
    }),
    [],
  );
  const categoryOptions = useMemo(
    () => ({
      payment_method: "Payment Method",
      merchant_category: "Merchant Category",
      user_location: "User Location",
      transaction_status: "Txn Status",
    }),
    [],
  );
  const distributionOptions = useMemo(
    () => ({
      amount_histogram: "Txn Amount",
      balance_histogram: "Account Balance",
    }),
    [],
  );

  const categorySeries = useMemo(() => {
    const raw = charts.category_metrics?.[categoryDimension] || [];
    return [...raw]
      .sort(
        (a, b) =>
          Number(b?.[categoryMetric] || 0) - Number(a?.[categoryMetric] || 0),
      )
      .slice(0, topN);
  }, [categoryDimension, categoryMetric, charts.category_metrics, topN]);

  const activeHistogram = charts?.[distributionMetric] || [];
  const qualityFlags = charts?.quality_flags || [];
  const hourlySeries = charts?.hourly_activity || [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');

        :root { --green:rgb(0,232,122); --card:rgba(9,13,17,0.92); --bdr:rgba(0,232,122,0.1); --bdr-h:rgba(0,232,122,0.22); }

        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes kpiIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes badgeIn  { from{opacity:0;transform:scale(0.9) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes dot-blink{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes icon-breathe{0%,100%{opacity:.55}50%{opacity:1}}

        .card { border-radius:20px; border:1px solid var(--bdr); background:var(--card); backdrop-filter:blur(18px); transition:border-color 0.3s ease; }
        .card:hover { border-color:var(--bdr-h); }

        .nav-btn { display:flex; align-items:center; gap:12px; width:100%; border-radius:12px; padding:11px 14px; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:0.09em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
        .nav-btn.on  { border:1px solid rgba(0,232,122,0.3); background:rgba(0,232,122,0.07); color:var(--green); }
        .nav-btn.off { border:1px solid rgba(255,255,255,0.05); background:transparent; color:rgba(255,255,255,0.35); }
        .nav-btn.off:hover { border-color:rgba(0,232,122,0.18); color:rgba(255,255,255,0.68); background:rgba(0,232,122,0.03); }

        .btn-g { display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border-radius:9px; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; background:transparent; color:rgba(0,232,122,0.72); border:1px solid rgba(0,232,122,0.18); text-decoration:none; }
        .btn-g:hover { border-color:rgba(0,232,122,0.4); background:rgba(0,232,122,0.04); color:var(--green); }

        .pill { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:5px; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; border:1px solid rgba(0,232,122,0.17); color:rgba(0,232,122,0.58); background:rgba(0,232,122,0.04); }

        .hud-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
        .hud-row:last-child { border-bottom:none; }

        .pattern-bar-track { height:2px; width:100%; background:rgba(255,255,255,0.06); border-radius:1px; overflow:hidden; position:relative; }
        .pattern-bar-fill  { position:absolute; top:0; left:0; height:100%; transition:width 0.8s ease; }

        .mono  { font-family:'IBM Plex Mono',monospace; }
        .serif { font-family:'Playfair Display',Georgia,serif; }

        .shell-grid          { display:grid; gap:22px; grid-template-columns:234px 1fr; }
        .content-stack       { display:flex; flex-direction:column; gap:18px; }
        .kpi-grid            { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }
        .split-grid          { display:grid; grid-template-columns:1.15fr 0.85fr; gap:13px; }
        .distribution-grid   { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
        .graph-grid          { display:grid; grid-template-columns:1.05fr 0.95fr; gap:13px; }
        .source-grid         { display:grid; grid-template-columns:1fr 1fr; gap:13px; }
        .chip-grid           { display:flex; flex-wrap:wrap; gap:8px; }
        .chip                { padding:6px 10px; border-radius:7px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.025); color:rgba(255,255,255,0.52); font-family:'IBM Plex Mono',monospace; font-size:9px; line-height:1.4; }

        @media (max-width:1120px) { .shell-grid{grid-template-columns:1fr} .sidebar-sticky{position:static!important} .split-grid,.graph-grid,.source-grid{grid-template-columns:1fr} .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media (max-width:760px)  { .kpi-grid,.distribution-grid{grid-template-columns:1fr} }
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
          <div className="shell-grid">
            {/* ── SIDEBAR ── */}
            <aside
              className="sidebar-sticky"
              style={{ position: "sticky", top: 96, height: "fit-content" }}
            >
              <div
                className="card"
                style={{
                  padding: "20px 18px",
                  marginBottom: 10,
                  background:
                    "linear-gradient(140deg,rgba(0,232,122,0.05) 0%,rgba(9,13,17,0.96) 55%)",
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
                      animation: "dot-blink 3.4s ease infinite",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      color: "rgba(0,232,122,0.5)",
                      textTransform: "uppercase",
                    }}
                  >
                    KPI Studio
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Playfair Display',Georgia,serif",
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
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 9,
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.27)",
                    letterSpacing: "0.04em",
                    margin: 0,
                  }}
                >
                  Monitor · Compare · Validate
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

              {/* ── REDESIGNED SYSTEM STATUS SIDEBAR ── */}
              <div className="card" style={{ padding: "16px 16px 14px" }}>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 8,
                    letterSpacing: "0.22em",
                    color: "rgba(255,255,255,0.24)",
                    textTransform: "uppercase",
                    marginBottom: 13,
                  }}
                >
                  System Status
                </div>

                {/* Pipeline status pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    padding: "9px 11px",
                    borderRadius: 10,
                    border: loading
                      ? "1px solid rgba(0,232,122,0.2)"
                      : error
                        ? "1px solid rgba(239,68,68,0.2)"
                        : "1px solid rgba(0,232,122,0.14)",
                    background: loading
                      ? "rgba(0,232,122,0.04)"
                      : error
                        ? "rgba(239,68,68,0.04)"
                        : "rgba(0,232,122,0.03)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: loading
                          ? "var(--green)"
                          : error
                            ? "rgb(239,68,68)"
                            : "rgba(0,232,122,0.6)",
                        animation: loading
                          ? "dot-blink 1.4s ease infinite"
                          : "none",
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: loading
                          ? "var(--green)"
                          : error
                            ? "rgba(239,100,100,0.85)"
                            : "rgba(0,232,122,0.55)",
                      }}
                    >
                      {loading ? "Loading" : error ? "Error" : "Ready"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 9,
                      color: "rgba(255,255,255,0.25)",
                    }}
                  >
                    Pipeline
                  </span>
                </div>

                {/* Key metric bars inside sidebar */}
                {data && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 0 }}
                  >
                    {[
                      {
                        label: "Cleaned Rows",
                        raw: Number(summary.cleaned_transactions || 0),
                        display: numberText(summary.cleaned_transactions),
                        max: Number(summary.cleaned_transactions || 1),
                        accent: "rgba(0,232,122,0.75)",
                      },
                      {
                        label: "Success Rate",
                        raw: Number(summary.success_rate || 0) * 100,
                        display: percentText(summary.success_rate),
                        max: 100,
                        accent: "rgba(0,232,122,0.6)",
                      },
                      {
                        label: "Invalid IPs",
                        raw: Number(summary.invalid_ip_rows || 0),
                        display: numberText(summary.invalid_ip_rows),
                        max: Number(summary.cleaned_transactions || 1),
                        accent: "rgba(248,122,125,0.72)",
                      },
                      {
                        label: "Outlier Rows",
                        raw: Number(summary.amount_outlier_rows || 0),
                        display: numberText(summary.amount_outlier_rows),
                        max: Number(summary.cleaned_transactions || 1),
                        accent: "rgba(248,122,125,0.55)",
                      },
                    ].map((item, i) => {
                      const pct = Math.min(
                        Math.max((item.raw / item.max) * 100, 3),
                        100,
                      );
                      return (
                        <div
                          key={item.label}
                          style={{
                            padding: "9px 0",
                            borderBottom:
                              i < 3
                                ? "1px solid rgba(255,255,255,0.04)"
                                : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                color: "rgba(255,255,255,0.32)",
                                letterSpacing: "0.03em",
                              }}
                            >
                              {item.label}
                            </span>
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                color: item.accent,
                                fontWeight: 700,
                              }}
                            >
                              {item.display}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 2,
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: 1,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: `linear-gradient(to right, ${item.accent}, rgba(255,255,255,0.08))`,
                                boxShadow: `0 0 6px ${item.accent}`,
                                transition: "width 1s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unique entity chips */}
                {data && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 8,
                        letterSpacing: "0.18em",
                        color: "rgba(255,255,255,0.22)",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Unique Entities
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 7,
                      }}
                    >
                      {[
                        {
                          icon: Users,
                          label: "Users",
                          value: numberText(summary.unique_users),
                        },
                        {
                          icon: Smartphone,
                          label: "Devices",
                          value: numberText(summary.unique_devices),
                        },
                        {
                          icon: MapPin,
                          label: "Locations",
                          value: numberText(summary.unique_locations),
                        },
                        {
                          icon: CreditCard,
                          label: "Pay Methods",
                          value: numberText(summary.unique_payment_methods),
                        },
                      ].map(({ icon: Icon, label, value }) => (
                        <div
                          key={label}
                          style={{
                            padding: "8px 9px",
                            borderRadius: 9,
                            border: "1px solid rgba(255,255,255,0.055)",
                            background: "rgba(255,255,255,0.018)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Icon
                              style={{
                                width: 10,
                                height: 10,
                                color: "rgba(0,232,122,0.5)",
                              }}
                            />
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 8,
                                letterSpacing: "0.1em",
                                color: "rgba(255,255,255,0.28)",
                                textTransform: "uppercase",
                              }}
                            >
                              {label}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: "'Playfair Display',Georgia,serif",
                              fontSize: 15,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.78)",
                              lineHeight: 1,
                            }}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div className="content-stack">
              <div style={{ animation: "fadeUp 0.5s ease both" }}>
                <div className="pill" style={{ marginBottom: 13 }}>
                  <BarChart3 style={{ width: 9, height: 9 }} /> Cleaned Data
                  KPIs
                </div>
                <h1
                  style={{
                    fontFamily: "'Playfair Display',Georgia,serif",
                    fontSize: 36,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.12,
                    margin: "0 0 10px 0",
                  }}
                >
                  Stats &amp; analytics
                  <br />
                  <em style={{ fontStyle: "italic", color: "var(--green)" }}>
                    control room
                  </em>
                </h1>
                <p
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.28)",
                    lineHeight: 1.8,
                    maxWidth: 560,
                    margin: 0,
                  }}
                >
                  Read the cleaned transaction base like an operator dashboard:
                  scale, health, dominant behaviors, and structural distribution
                  in one professional KPI view.
                </p>
              </div>

              {loading && (
                <LoadingZone phase={loadPhase} progress={loadProgress} />
              )}

              {!loading && error && (
                <div className="card" style={{ padding: "30px 34px" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(239,68,68,0.2)",
                      background: "rgba(239,68,68,0.04)",
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 10,
                      color: "rgba(239,120,120,0.82)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Failed to load KPI analytics: {error}
                  </div>
                </div>
              )}

              {!loading && !error && data && (
                <>
                  {/* ── OVERVIEW ── */}
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
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 24,
                      }}
                    >
                      <div>
                        <div className="pill" style={{ marginBottom: 13 }}>
                          <DatabaseZap style={{ width: 9, height: 9 }} />{" "}
                          Overview
                        </div>
                        <h2
                          style={{
                            fontFamily: "'Playfair Display',Georgia,serif",
                            fontSize: 28,
                            fontWeight: 900,
                            color: "rgba(255,255,255,0.88)",
                            lineHeight: 1.12,
                            margin: 0,
                          }}
                        >
                          Operational
                          <br />
                          <em
                            style={{
                              fontStyle: "italic",
                              color: "var(--green)",
                            }}
                          >
                            snapshot
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
                        <Clock3
                          style={{
                            width: 13,
                            height: 13,
                            color: "var(--green)",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            color: "var(--green)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {dateTimeText(data.generated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="kpi-grid" style={{ marginBottom: 11 }}>
                      {heroCards.map((c, i) => (
                        <KpiCard key={c.label} {...c} delay={i * 55} />
                      ))}
                    </div>
                    <div className="kpi-grid">
                      {riskCards.map((c, i) => (
                        <KpiCard key={c.label} {...c} delay={220 + i * 55} />
                      ))}
                    </div>
                  </section>

                  {/* ── ANALYTICS ── */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.analytics = n;
                    }}
                    id="analytics"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.44s ease both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Activity style={{ width: 9, height: 9 }} /> Analytics
                      </div>
                      <h2
                        style={{
                          fontFamily: "'Playfair Display',Georgia,serif",
                          fontSize: 28,
                          fontWeight: 900,
                          color: "rgba(255,255,255,0.88)",
                          lineHeight: 1.12,
                          margin: 0,
                        }}
                      >
                        Behavioral
                        <br />
                        <em
                          style={{ fontStyle: "italic", color: "var(--green)" }}
                        >
                          readout
                        </em>
                      </h2>
                    </div>

                    <div className="split-grid">
                      <div>
                        {/* Lens switcher */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 16,
                          }}
                        >
                          <ControlButton
                            active={statLens === "transaction_amount"}
                            onClick={() => setStatLens("transaction_amount")}
                          >
                            Amount Stats
                          </ControlButton>
                          <ControlButton
                            active={statLens === "account_balance"}
                            onClick={() => setStatLens("account_balance")}
                          >
                            Balance Stats
                          </ControlButton>
                          <ControlButton
                            active={statLens === "throughput"}
                            onClick={() => setStatLens("throughput")}
                          >
                            Throughput
                          </ControlButton>
                        </div>

                        {/* ── REDESIGNED STATS AREA ── */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 11,
                            marginBottom: 14,
                          }}
                        >
                          {statBarGroups.map((g) => (
                            <StatGroup key={g.title} {...g} />
                          ))}
                        </div>

                        {/* Analyst note */}
                        <div
                          style={{
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.052)",
                            padding: "17px 19px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'IBM Plex Mono',monospace",
                              fontSize: 9,
                              letterSpacing: "0.13em",
                              color: "rgba(255,255,255,0.33)",
                              textTransform: "uppercase",
                              marginBottom: 13,
                            }}
                          >
                            Analyst Note
                          </div>
                          {[
                            {
                              icon: CheckCircle2,
                              c: "rgba(0,232,122,0.65)",
                              b: "rgba(0,232,122,0.12)",
                              bg: "rgba(0,232,122,0.025)",
                              t: "Use the success rate and transaction value cards together to judge whether data cleanup preserved healthy volume without flattening the distribution.",
                            },
                            {
                              icon: AlertTriangle,
                              c: "rgba(239,68,68,0.62)",
                              b: "rgba(239,68,68,0.1)",
                              bg: "rgba(239,68,68,0.025)",
                              t: "Invalid IP rows and amount outliers are the fastest way to spot whether the cleaned file still carries suspicious operational residue.",
                            },
                            {
                              icon: Zap,
                              c: "rgba(116,161,255,0.72)",
                              b: "rgba(116,161,255,0.12)",
                              bg: "rgba(116,161,255,0.025)",
                              t: "Median, mean, and max amount together reveal whether a small tail of high-value transactions is distorting the baseline.",
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                gap: 10,
                                padding: "11px 12px",
                                borderRadius: 9,
                                border: `1px solid ${item.b}`,
                                background: item.bg,
                                marginBottom: i < 2 ? 8 : 0,
                              }}
                            >
                              <item.icon
                                style={{
                                  width: 12,
                                  height: 12,
                                  color: item.c,
                                  marginTop: 2,
                                  flexShrink: 0,
                                }}
                              />
                              <p
                                style={{
                                  fontFamily: "'IBM Plex Mono',monospace",
                                  fontSize: 9,
                                  lineHeight: 1.78,
                                  color: "rgba(255,255,255,0.4)",
                                  margin: 0,
                                }}
                              >
                                {item.t}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dominant segments — uses new LeaderCard */}
                      <div
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.052)",
                          padding: "17px 19px",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            letterSpacing: "0.13em",
                            color: "rgba(255,255,255,0.33)",
                            textTransform: "uppercase",
                            marginBottom: 13,
                          }}
                        >
                          Dominant Segments
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 9,
                          }}
                        >
                          {leaderCards.map((item, i) => (
                            <LeaderCard
                              key={item.label}
                              {...item}
                              delay={i * 60}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ── GRAPHS ── */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.graphs = n;
                    }}
                    id="graphs"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.48s ease 40ms both",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 22,
                      }}
                    >
                      <div>
                        <div className="pill" style={{ marginBottom: 13 }}>
                          <DatabaseZap style={{ width: 9, height: 9 }} />{" "}
                          Interactive Graphs
                        </div>
                        <h2
                          style={{
                            fontFamily: "'Playfair Display',Georgia,serif",
                            fontSize: 28,
                            fontWeight: 900,
                            color: "rgba(255,255,255,0.88)",
                            lineHeight: 1.12,
                            margin: 0,
                          }}
                        >
                          Manipulate cleaned
                          <br />
                          <em
                            style={{
                              fontStyle: "italic",
                              color: "var(--green)",
                            }}
                          >
                            data views
                          </em>
                        </h2>
                      </div>
                      <div
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.34)",
                          lineHeight: 1.7,
                          maxWidth: 360,
                        }}
                      >
                        Switch dimensions, metrics, and ranking depth live. All
                        charts are driven from the cleaned CSV summary endpoint
                        rather than hardcoded demo values.
                      </div>
                    </div>

                    <div className="graph-grid" style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.052)",
                          background: "rgba(0,0,0,0.12)",
                          padding: "18px 19px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 14,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.28)",
                                marginBottom: 6,
                              }}
                            >
                              Category Explorer
                            </div>
                            <h3
                              style={{
                                fontFamily: "'Playfair Display',Georgia,serif",
                                fontSize: 22,
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.86)",
                                margin: 0,
                              }}
                            >
                              Ranked category graph
                            </h3>
                          </div>
                          <div
                            style={{
                              fontFamily: "'IBM Plex Mono',monospace",
                              fontSize: 9,
                              color: "rgba(255,255,255,0.38)",
                            }}
                          >
                            Top {topN} by {categoryMetric.replace("_", " ")}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {Object.entries(categoryOptions).map(([k, l]) => (
                            <ControlButton
                              key={k}
                              active={categoryDimension === k}
                              onClick={() => setCategoryDimension(k)}
                            >
                              {l}
                            </ControlButton>
                          ))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 14,
                          }}
                        >
                          {Object.keys(metricFormatters).map((k) => (
                            <ControlButton
                              key={k}
                              active={categoryMetric === k}
                              onClick={() => setCategoryMetric(k)}
                            >
                              {k.replace("_", " ")}
                            </ControlButton>
                          ))}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.28)",
                              }}
                            >
                              Rank Depth
                            </span>
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 10,
                                color: "var(--green)",
                              }}
                            >
                              {topN}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="4"
                            max="12"
                            step="1"
                            value={topN}
                            onChange={(e) => setTopN(Number(e.target.value))}
                            style={{ width: "100%" }}
                          />
                        </div>
                        <CategoryMetricChart
                          data={categorySeries}
                          metric={categoryMetric}
                          accent={metricAccent[categoryMetric]}
                          formatter={metricFormatters[categoryMetric]}
                        />
                      </div>

                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.052)",
                          background: "rgba(0,0,0,0.12)",
                          padding: "18px 19px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 14,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.28)",
                                marginBottom: 6,
                              }}
                            >
                              Time Trend
                            </div>
                            <h3
                              style={{
                                fontFamily: "'Playfair Display',Georgia,serif",
                                fontSize: 22,
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.86)",
                                margin: 0,
                              }}
                            >
                              Hour-by-hour activity
                            </h3>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <ControlButton
                              active={hourlyMetric === "count"}
                              onClick={() => setHourlyMetric("count")}
                            >
                              Volume
                            </ControlButton>
                            <ControlButton
                              active={hourlyMetric === "total_amount"}
                              onClick={() => setHourlyMetric("total_amount")}
                            >
                              Value
                            </ControlButton>
                            <ControlButton
                              active={hourlyMetric === "success_rate"}
                              onClick={() => setHourlyMetric("success_rate")}
                            >
                              Success Rate
                            </ControlButton>
                          </div>
                        </div>
                        <TrendChart
                          data={hourlySeries}
                          metric={hourlyMetric}
                          accent={metricAccent[hourlyMetric]}
                          formatter={metricFormatters[hourlyMetric]}
                        />
                      </div>
                    </div>

                    <div className="graph-grid">
                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.052)",
                          background: "rgba(0,0,0,0.12)",
                          padding: "18px 19px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 14,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 9,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.28)",
                                marginBottom: 6,
                              }}
                            >
                              Distribution
                            </div>
                            <h3
                              style={{
                                fontFamily: "'Playfair Display',Georgia,serif",
                                fontSize: 22,
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.86)",
                                margin: 0,
                              }}
                            >
                              Histogram view
                            </h3>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            {Object.entries(distributionOptions).map(
                              ([k, l]) => (
                                <ControlButton
                                  key={k}
                                  active={distributionMetric === k}
                                  onClick={() => setDistributionMetric(k)}
                                >
                                  {l}
                                </ControlButton>
                              ),
                            )}
                          </div>
                        </div>
                        <HistogramChart
                          data={activeHistogram}
                          accent={
                            distributionMetric === "amount_histogram"
                              ? "rgba(0,232,122,0.88)"
                              : "rgba(116,161,255,0.88)"
                          }
                          formatter={numberText}
                        />
                      </div>

                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.052)",
                          background: "rgba(0,0,0,0.12)",
                          padding: "18px 19px",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.28)",
                            marginBottom: 6,
                          }}
                        >
                          Quality Flags
                        </div>
                        <h3
                          style={{
                            fontFamily: "'Playfair Display',Georgia,serif",
                            fontSize: 22,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.86)",
                            margin: "0 0 14px 0",
                          }}
                        >
                          Cleaned-data risk residue
                        </h3>
                        <CategoryMetricChart
                          data={qualityFlags}
                          metric="percent"
                          accent="rgba(248,122,125,0.88)"
                          formatter={percentText}
                          emptyText="No quality flags returned for this run."
                        />
                      </div>
                    </div>
                  </section>

                  {/* ── DISTRIBUTION ── */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.distribution = n;
                    }}
                    id="distribution"
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
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 22,
                      }}
                    >
                      <div>
                        <div className="pill" style={{ marginBottom: 13 }}>
                          <DatabaseZap style={{ width: 9, height: 9 }} />{" "}
                          Category Distribution
                        </div>
                        <h2
                          style={{
                            fontFamily: "'Playfair Display',Georgia,serif",
                            fontSize: 28,
                            fontWeight: 900,
                            color: "rgba(255,255,255,0.88)",
                            lineHeight: 1.12,
                            margin: 0,
                          }}
                        >
                          Mix, density,
                          <br />
                          <em
                            style={{
                              fontStyle: "italic",
                              color: "var(--green)",
                            }}
                          >
                            and spread
                          </em>
                        </h2>
                      </div>
                      <div
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.34)",
                          lineHeight: 1.7,
                          maxWidth: 360,
                        }}
                      >
                        These breakdowns show which categories dominate the
                        cleaned dataset. Strong concentration usually means the
                        model sees a narrow operational pattern.
                      </div>
                    </div>
                    <div className="distribution-grid">
                      {breakdownGroups.map((g) => (
                        <BreakdownPanel key={g.title} {...g} />
                      ))}
                    </div>
                  </section>

                  {/* ── SOURCE ── */}
                  <section
                    ref={(n) => {
                      sectionRefs.current.source = n;
                    }}
                    id="source"
                    className="card"
                    style={{
                      padding: "30px 34px",
                      scrollMarginTop: 112,
                      animation: "slideUp 0.5s ease 120ms both",
                    }}
                  >
                    <div style={{ marginBottom: 22 }}>
                      <div className="pill" style={{ marginBottom: 13 }}>
                        <Database style={{ width: 9, height: 9 }} /> Source
                        Reference
                      </div>
                      <h2
                        style={{
                          fontFamily: "'Playfair Display',Georgia,serif",
                          fontSize: 28,
                          fontWeight: 900,
                          color: "rgba(255,255,255,0.88)",
                          lineHeight: 1.12,
                          margin: 0,
                        }}
                      >
                        Dataset
                        <br />
                        <em
                          style={{ fontStyle: "italic", color: "var(--green)" }}
                        >
                          metadata
                        </em>
                      </h2>
                    </div>
                    <div className="source-grid">
                      <div
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.052)",
                          padding: "17px 19px",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            letterSpacing: "0.13em",
                            color: "rgba(255,255,255,0.33)",
                            textTransform: "uppercase",
                            marginBottom: 13,
                          }}
                        >
                          Dataset Health
                        </div>
                        {[
                          {
                            key: "Source Rows",
                            value: numberText(data?.source?.rows),
                          },
                          {
                            key: "Source Columns",
                            value: numberText(data?.source?.columns),
                          },
                          {
                            key: "Last Updated",
                            value: dateTimeText(data?.source_last_modified),
                          },
                          {
                            key: "Unique Payment Methods",
                            value: numberText(summary.unique_payment_methods),
                          },
                          {
                            key: "Invalid Device Rows",
                            value: numberText(summary.invalid_device_rows),
                          },
                          {
                            key: "Success Count",
                            value: numberText(summary.success_count),
                          },
                          {
                            key: "Failed Count",
                            value: numberText(summary.failed_count),
                          },
                        ].map((item) => (
                          <div key={item.key} className="hud-row">
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 10,
                                color: "rgba(255,255,255,0.35)",
                              }}
                            >
                              {item.key}
                            </span>
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono',monospace",
                                fontSize: 10,
                                color: "rgba(0,232,122,0.66)",
                                textAlign: "right",
                              }}
                            >
                              {item.value}
                            </span>
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
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            letterSpacing: "0.13em",
                            color: "rgba(255,255,255,0.33)",
                            textTransform: "uppercase",
                            marginBottom: 13,
                          }}
                        >
                          Column Surface
                        </div>
                        <div className="chip-grid" style={{ marginBottom: 14 }}>
                          {sourceColumns.slice(0, 16).map((col) => (
                            <div key={col} className="chip">
                              {col}
                            </div>
                          ))}
                          {sourceColumns.length === 0 && (
                            <div className="chip">No columns returned</div>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 9,
                            letterSpacing: "0.13em",
                            color: "rgba(255,255,255,0.33)",
                            textTransform: "uppercase",
                            marginBottom: 7,
                          }}
                        >
                          Cleaned CSV Path
                        </div>
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 10,
                            color: "rgba(0,232,122,0.58)",
                            lineHeight: 1.8,
                            wordBreak: "break-all",
                          }}
                        >
                          {data?.source_path || "N/A"}
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
                      <Link href="/dashboard" className="btn-g">
                        <FileUp style={{ width: 12, height: 12 }} /> Back to
                        Dashboard
                      </Link>
                      <Link href="/fraud-report" className="btn-g">
                        <ShieldAlert style={{ width: 12, height: 12 }} /> Fraud
                        Report
                      </Link>
                      <Link href="/eda" className="btn-g">
                        <BarChart3 style={{ width: 12, height: 12 }} /> Open EDA
                      </Link>
                      <Link href="/graph" className="btn-g">
                        <Activity style={{ width: 12, height: 12 }} />{" "}
                        Relationship Graph
                      </Link>
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
