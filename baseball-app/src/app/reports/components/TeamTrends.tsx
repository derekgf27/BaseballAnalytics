"use client";

import type { RefObject } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TeamTrendPoint } from "@/lib/reports/teamTrendsSnapshot";

export function TeamTrends({
  points,
  insights,
  loading,
  captureRef,
  pdfCapture = false,
}: {
  points: TeamTrendPoint[];
  insights: string[];
  loading?: boolean;
  captureRef?: RefObject<HTMLDivElement | null>;
  pdfCapture?: boolean;
}) {
  const chartData = points.map((p) => ({
    label: p.date.slice(5),
    OPS: Number(p.ops.toFixed(3)),
    Kpct: Math.round(p.kPct * 100),
    Runs: p.runsScored,
  }));

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-card)]" aria-hidden />;
  }

  return (
    <div
      ref={captureRef}
      className={`team-trends-report-root space-y-6${pdfCapture ? " reports-print-area reports-pdf-capture" : ""}`}
    >
      {!pdfCapture ? (
        <p
          data-pdf-exclude="true"
          className="reports-screen-only rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]"
        >
          On-screen preview of team trends. Use{" "}
          <span className="font-semibold text-[var(--text)]">Export PDF</span> above to download and open the same view
          in a new tab.
        </p>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition hover:border-[var(--accent)]/30">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">Insights</h3>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--text)]">
          {insights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition hover:border-[var(--accent)]/30">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">OPS by game</h4>
          <div className="mt-4 h-56 w-full min-h-[14rem]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="OPS" stroke="var(--accent)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">No games yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition hover:border-[var(--accent)]/30">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            K% & runs
          </h4>
          <div className="mt-4 h-56 w-full min-h-[14rem]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis yAxisId="l" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line yAxisId="l" type="monotone" dataKey="Kpct" stroke="#94a3b8" name="K%" strokeWidth={2} dot />
                  <Line yAxisId="r" type="monotone" dataKey="Runs" stroke="#f472b6" name="Runs" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
