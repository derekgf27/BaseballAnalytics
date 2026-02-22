import { CoachNav } from "@/components/shared/CoachNav";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <CoachNav />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:max-w-4xl lg:mx-auto">
        {children}
      </main>
    </div>
  );
}
