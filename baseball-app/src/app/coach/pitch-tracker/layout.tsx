/**
 * Full-viewport pitch tracker: escapes coach shell padding/sidebar visually.
 */
export default function CoachPitchTrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[400] overflow-auto bg-zinc-950 lg:relative lg:inset-auto lg:z-auto lg:min-h-0 lg:flex-1 lg:bg-transparent">
      {children}
    </div>
  );
}
