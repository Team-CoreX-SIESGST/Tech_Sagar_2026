"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { BarChart3, DatabaseZap, ImageIcon } from "lucide-react";

const SummaryItem = ({ label, value }) => (
  <div className="rounded-3xl border border-border bg-background/55 p-4">
    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    <div className="font-serif text-2xl font-semibold text-foreground">{value}</div>
  </div>
);

export default function EdaPage() {
  const [eda, setEda] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [edaResponse, reportResponse] = await Promise.all([
          fetch("/api/eda", { cache: "no-store" }),
          fetch("/api/fraud-report", { cache: "no-store" }),
        ]);
        const edaData = await edaResponse.json();
        const reportData = await reportResponse.json();
        if (!edaResponse.ok) {
          throw new Error(edaData?.error || "Failed to load EDA.");
        }
        if (!reportResponse.ok) {
          throw new Error(reportData?.error || "Failed to load report summary.");
        }
        setEda(edaData);
        setReport(reportData);
      } catch (err) {
        setError(err.message || "Failed to load EDA.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const charts = eda?.charts || [];
  const summary = report?.summary || {};

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(820px 420px at 10% -10%, rgba(106,169,255,0.14), transparent), radial-gradient(720px 320px at 92% 0%, rgba(52,178,123,0.16), transparent), var(--background)",
      }}
    >
      <Navbar />
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-28">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="pill-badge mb-3">Visual EDA</div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
              Dataset Exploration Studio
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use these charts to validate dataset structure, spot drift from the sample, and explain why the fraud model is reacting the way it does.
            </p>
          </div>
          <a href="/fraud-report" className="btn-primary !px-5 !py-3 text-sm">
            Open Fraud Report
          </a>
        </div>

        {loading ? (
          <div className="float-card p-8 text-sm text-muted-foreground">Loading EDA artifacts...</div>
        ) : error ? (
          <div className="float-card border border-destructive/30 p-8 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryItem label="Rows Scored" value={summary.total_transactions ?? 0} />
              <SummaryItem label="Fraud Detected" value={summary.fraud_detected ?? 0} />
              <SummaryItem label="Unique Patterns" value={summary.unique_patterns_detected ?? 0} />
              <SummaryItem label="Fraud Rate" value={`${summary.fraud_rate_percent ?? 0}%`} />
            </div>

            <div className="mb-6 float-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full border border-border bg-background/50 p-2">
                  <DatabaseZap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-foreground">Why These Charts Matter</h2>
                  <p className="text-sm text-muted-foreground">
                    The strongest signal for a hidden judge dataset is whether its amount behavior, quality issues, and pattern density resemble the hackathon sample.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-border bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                  <BarChart3 className="mb-3 h-4 w-4 text-primary" />
                  Amount and balance plots help confirm whether score spikes come from true monetary anomalies or just a shifted value range.
                </div>
                <div className="rounded-3xl border border-border bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                  <ImageIcon className="mb-3 h-4 w-4 text-primary" />
                  Missingness, status, and category plots reveal whether the dataset is noisier than the sample and whether threshold behavior should adapt.
                </div>
                <div className="rounded-3xl border border-border bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                  <DatabaseZap className="mb-3 h-4 w-4 text-primary" />
                  Fraud-score and pattern-count distributions show how concentrated suspicious activity is, which is what the adaptive threshold uses.
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {charts.map((chart) => (
                <section key={chart.name} className="float-card overflow-hidden">
                  <div className="border-b border-border px-5 py-4">
                    <div className="pill-badge mb-2">EDA Chart</div>
                    <h3 className="font-serif text-2xl font-semibold text-foreground">{chart.title}</h3>
                  </div>
                  <div className="bg-background/55 p-4">
                    <img
                      src={chart.url}
                      alt={chart.title}
                      className="w-full rounded-2xl border border-border object-cover"
                    />
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
