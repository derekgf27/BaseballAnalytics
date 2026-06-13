interface RecordPrimaryActionsProps {
  hasLastPa: boolean;
  destructivePending: boolean;
  saving: boolean;
  savePaDisabled: boolean;
  clearingPAs: boolean;
  isDemoGame: boolean;
  onUndoLastPa: () => void;
  onSubstitution: () => void;
  onClearPas: () => void;
  onSave: () => void;
}

export function RecordPrimaryActions({
  hasLastPa,
  destructivePending,
  saving,
  savePaDisabled,
  clearingPAs,
  isDemoGame,
  onUndoLastPa,
  onSubstitution,
  onClearPas,
  onSave,
}: RecordPrimaryActionsProps) {
  return (
    <nav
      id="record-pa-primary-actions"
      className="scroll-mt-4 flex flex-wrap items-center gap-2 max-lg:sticky max-lg:bottom-0 max-lg:z-40 max-lg:-mx-2 max-lg:mt-2 max-lg:border-t max-lg:border-[var(--border)] max-lg:bg-[var(--bg-base)]/92 max-lg:px-2 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pt-3 max-lg:backdrop-blur-md max-lg:shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
      aria-label="Primary recording actions"
    >
      <button
        type="button"
        onClick={onUndoLastPa}
        disabled={!hasLastPa || destructivePending}
        title={
          hasLastPa
            ? "Remove the most recently saved plate appearance for this game."
            : "Save a plate appearance first — then you can undo the last one if you mis-entered it."
        }
        className="min-h-[48px] shrink-0 rounded-lg border-2 border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
      >
        Undo last PA
      </button>
      <button
        type="button"
        onClick={onSubstitution}
        disabled={isDemoGame}
        className="min-h-[48px] shrink-0 cursor-pointer rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--accent-dim)]/20 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
      >
        Substitution
      </button>
      {!isDemoGame && (
        <button
          type="button"
          disabled={clearingPAs || destructivePending}
          onClick={onClearPas}
          className="min-h-[48px] shrink-0 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-dim)]/25 hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearingPAs ? "Clearing…" : "Clear PAs"}
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={savePaDisabled}
        className="min-h-[48px] min-w-[8rem] flex-1 cursor-pointer rounded-lg bg-[var(--accent)] py-3 text-base font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
      >
        {saving ? "Saving…" : "Save PA"}
      </button>
    </nav>
  );
}
