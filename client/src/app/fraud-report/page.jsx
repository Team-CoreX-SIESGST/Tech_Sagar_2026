"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import {
  AlertTriangle,
  BadgeAlert,
  CalendarClock,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";

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

const severityPalette = {
  critical: {
    rail: "rgba(248,122,125,0.95)",
    badgeBg: "rgba(248,122,125,0.16)",
    badgeText: "#f8a4a5",
    score: "#ff8d8f",
  },
  high: {
    rail: "rgba(228,180,68,0.95)",
    badgeBg: "rgba(228,180,68,0.16)",
    badgeText: "#e8c05d",
    score: "#e8b84a",
  },
  medium: {
    rail: "rgba(116,161,255,0.95)",
    badgeBg: "rgba(116,161,255,0.14)",
    badgeText: "#8db5ff",
    score: "#8db5ff",
  },
  low: {
    rail: "rgba(52,178,123,0.95)",
    badgeBg: "rgba(52,178,123,0.14)",
    badgeText: "#6fe2a2",
    score: "#6fe2a2",
  },
};

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

const SummaryCard = ({ label, value, tone = "default", icon: Icon }) => (
  <div
    className="float-card p-3"
    style={{
      background:
        tone === "danger"
          ? "linear-gradient(180deg, rgba(229,75,79,0.12), rgba(21,29,34,0.92))"
          : tone === "accent"
            ? "linear-gradient(180deg, rgba(228,184,74,0.12), rgba(21,29,34,0.92))"
            : "linear-gradient(180deg, rgba(106,169,255,0.10), rgba(21,29,34,0.92))",
    }}
  >
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="rounded-full border border-border bg-background/50 p-1.5">
        <Icon className="h-3 w-3 text-primary" />
      </div>
    </div>
    <div className="font-serif text-[1.35rem] font-semibold leading-none text-foreground">{value}</div>
  </div>
);

const FraudCard = ({ item }) => {
  const palette = severityPalette[item.criticality] || severityPalette.low;
  const scorePercent = Math.max(10, Math.min(item.fraud_probability * 100, 100));
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
    <article
      className="float-card overflow-hidden"
      style={{
        position: "relative",
        borderColor: "rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(42,42,40,0.96), rgba(39,39,37,0.98))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: palette.rail,
          boxShadow: `0 0 32px ${palette.rail}`,
        }}
      />
      <div className="p-3.5 pl-6">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-[0.98rem] font-bold tracking-tight text-white">
                {item.transaction_id}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                style={{
                  background: palette.badgeBg,
                  color: palette.badgeText,
                }}
              >
                {item.criticality}
              </span>
            </div>
            <p className="text-[0.82rem] leading-5 text-white/68">{subtitleBits.join(" · ")}</p>
          </div>

          <div className="text-right">
            <div
              className="font-serif text-[2.2rem] font-semibold leading-none"
              style={{ color: palette.score }}
            >
              {item.fraud_probability.toFixed(2)}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-white/50">
              Fraud Score
            </div>
          </div>
        </div>

        <div className="mb-3 h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${scorePercent}%`,
              background: `linear-gradient(90deg, ${palette.rail}, ${palette.score})`,
            }}
          />
        </div>

        <div className="space-y-0">
          {(item.signal_details || []).map((detail) => (
            <div
              key={`${item.transaction_id}-${detail.signal}`}
              className="grid items-center gap-2.5 border-b border-white/8 py-1.5 md:grid-cols-[1fr_auto]"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      detail.severity === "high"
                        ? palette.rail
                        : detail.severity === "medium"
                          ? "#e8b84a"
                          : "#8db5ff",
                    boxShadow:
                      detail.severity === "high"
                        ? `0 0 14px ${palette.rail}`
                        : "none",
                  }}
                />
                <div className="text-[0.88rem] leading-5 text-white/90">{detail.description}</div>
              </div>
              <div className="text-right text-[0.8rem] font-semibold text-white/64">
                {signalValueText(detail, item)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 rounded-[1rem] border border-white/6 bg-black/16 p-3 text-[0.84rem] leading-5 text-white/68">
          {item.plain_english_reason}
        </div>
      </div>
    </article>
  );
};

export default function FraudReportPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/fraud-report", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load report.");
        }
        setReport(data);
      } catch (err) {
        setError(err.message || "Failed to load report.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = report?.summary || {};
  const topTransactions = report?.top_fraud_transactions || [];
  const patternBreakdown = report?.pattern_breakdown || {};
  const orderedPatterns = useMemo(
    () => Object.entries(patternBreakdown).sort((a, b) => b[1] - a[1]),
    [patternBreakdown],
  );

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(950px 460px at 10% -10%, rgba(248,122,125,0.10), transparent), radial-gradient(760px 420px at 92% 0%, rgba(228,184,74,0.08), transparent), var(--background)",
      }}
    >
      <Navbar />
      <div className="mx-auto max-w-[1160px] px-4 pb-10 pt-26">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="pill-badge mb-2">Latest Fraud Report</div>
            <h1 className="font-serif text-[1.7rem] font-semibold tracking-tight text-foreground">
              Transaction Investigation Feed
            </h1>
            <p className="mt-2 max-w-3xl text-[0.88rem] leading-5 text-muted-foreground">
              Review the highest-risk transactions in the same investigator-friendly layout used during fraud triage: severity, score, evidence lines, and a plain-English narrative.
            </p>
          </div>
          <a href="/eda" className="btn-primary !px-4 !py-2.5 text-xs">
            Open EDA
          </a>
        </div>

        {loading ? (
          <div className="float-card p-8 text-sm text-muted-foreground">Loading latest fraud report...</div>
        ) : error ? (
          <div className="float-card border border-destructive/30 p-8 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <div className="mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Fraud Detected" value={summary.fraud_detected ?? 0} tone="danger" icon={ShieldAlert} />
              <SummaryCard label="Critical" value={summary.critical_count ?? 0} tone="danger" icon={Siren} />
              <SummaryCard label="High" value={summary.high_count ?? 0} tone="accent" icon={BadgeAlert} />
              <SummaryCard label="Fraud Rate" value={`${summary.fraud_rate_percent ?? 0}%`} tone="default" icon={Sparkles} />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.28fr)_280px]">
              <section className="space-y-3">
                <div className="mb-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {report?.generated_at ? new Date(report.generated_at).toLocaleString() : "N/A"}
                </div>
                {topTransactions.slice(0, 8).map((item) => (
                  <FraudCard key={item.transaction_id} item={item} />
                ))}
              </section>

              <aside className="space-y-6">
                <section className="float-card p-3.5">
                  <div className="pill-badge mb-3">Pattern Pressure</div>
                  <div className="space-y-4">
                    {orderedPatterns.map(([key, value]) => (
                      <div key={key}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="capitalize text-foreground">{key}</span>
                          <span className="font-mono text-muted-foreground">{value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${summary.total_transactions ? Math.min((value / summary.total_transactions) * 100, 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="float-card p-3.5">
                  <div className="pill-badge mb-3">Run Summary</div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Total Transactions</span>
                      <span className="font-mono text-foreground">{compactNumber(summary.total_transactions ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Patterns Fired Total</span>
                      <span className="font-mono text-foreground">{compactNumber(summary.patterns_fired_total ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unique Patterns</span>
                      <span className="font-mono text-foreground">{compactNumber(summary.unique_patterns_detected ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Model Type</span>
                      <span className="font-mono text-foreground">{report?.model_info?.model_type ?? "unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Threshold</span>
                      <span className="font-mono text-foreground">{report?.model_info?.threshold_used ?? "N/A"}</span>
                    </div>
                  </div>
                </section>

                <section className="float-card p-3.5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <div className="font-serif text-xl font-semibold text-foreground">Operator Note</div>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    Prioritize cards where the score is high and the evidence stack shows multiple independent signals. Those combinations are usually the strongest cases to surface in demos, reviews, and judge walkthroughs.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
