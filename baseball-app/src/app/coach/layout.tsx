import { CoachNav } from "@/components/shared/CoachNav";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell flex min-h-0 flex-1 bg-[var(--neo-bg-base)]">
      <CoachNav />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:max-w-[96rem] lg:mx-auto">
        {children}
      </main>
    </div>
  );
}
