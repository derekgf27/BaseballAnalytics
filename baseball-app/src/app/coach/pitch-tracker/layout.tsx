/**
 * Full-viewport pitch tracker: always covers coach nav and shell padding (iPad landscape included).
 */
export default function CoachPitchTrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="coach-pitch-pad fixed inset-0 z-[400] flex flex-col overflow-hidden bg-[var(--bg-base)]">
      {children}
    </div>
  );
}
