"use client";

import { useRouter } from "next/navigation";

const ACTIONS = [
  { id: "steal", label: "Steal?" },
  { id: "bunt", label: "Bunt?" },
  { id: "hitrun", label: "Hit & Run?" },
] as const;

export interface QuickActionsProps {
  onAction?: (id: (typeof ACTIONS)[number]["id"]) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const router = useRouter();

  const handleAction = (id: (typeof ACTIONS)[number]["id"]) => {
    onAction?.(id);
    router.push("/coach/green-light");
  };

  return (
    <section className="neo-card p-3.5">
      <div className="section-label mb-2">Quick actions</div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action.id)}
            className="font-display rounded-lg border border-[var(--neo-secondary)]/40 bg-[var(--neo-secondary-dim)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--neo-secondary)] transition hover:border-[var(--neo-secondary)] hover:shadow-[0_0_16px_rgba(255,76,109,0.25)]"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
