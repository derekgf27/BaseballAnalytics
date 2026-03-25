import { AnalystNav } from "@/components/shared/AnalystNav";
import { AnalystBreadcrumbs } from "@/components/shared/AnalystBreadcrumbs";

export default function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 bg-[var(--bg-base)]">
      <AnalystNav />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:max-w-[96rem] lg:mx-auto">
        <AnalystBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
