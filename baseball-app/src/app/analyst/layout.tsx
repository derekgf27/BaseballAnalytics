import { AnalystNav } from "@/components/shared/AnalystNav";

export default function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <AnalystNav />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:max-w-[96rem] lg:mx-auto">
        {children}
      </main>
    </div>
  );
}
