"use client";

import { motion } from "framer-motion";
import type { TodayAlert, TodayMatchupBullet } from "@/app/coach/CoachTodayClient";

export interface TacticalAlertsPanelProps {
  alerts: TodayAlert[];
  matchupSummary: TodayMatchupBullet[];
}

export function TacticalAlertsPanel({ alerts, matchupSummary }: TacticalAlertsPanelProps) {
  const hasAlerts = alerts.length > 0 || matchupSummary.length > 0;
  const items: { id: string; icon: string; text: string }[] = [];

  alerts.forEach((a) => {
    items.push({
      id: a.id,
      icon: a.type === "risk" ? "⚠️" : a.type === "hot" ? "🔥" : "❄️",
      text: a.line || a.title,
    });
  });
  matchupSummary.forEach((m) => {
    items.push({
      id: m.id,
      icon: m.kind === "risk" ? "!" : m.kind === "advantage" ? "✓" : "·",
      text: m.text,
    });
  });

  if (items.length === 0) {
    return (
      <section className="neo-card p-4">
        <div className="section-label mb-2">Tactical alerts</div>
        <p className="text-sm text-[var(--neo-text-muted)]">No alerts right now.</p>
      </section>
    );
  }

  return (
    <motion.section
      className="neo-card p-4"
      initial={hasAlerts ? { opacity: 0.7, boxShadow: "0 0 32px rgba(255, 212, 111, 0.2)" } : false}
      animate={{ opacity: 1, boxShadow: "0 0 24px -8px rgba(102, 224, 255, 0.08)" }}
      transition={{ duration: 0.6 }}
    >
      <div className="section-label mb-2">Tactical alerts</div>
      <ul className="space-y-1.5 text-sm text-[var(--neo-text)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span aria-hidden>{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
