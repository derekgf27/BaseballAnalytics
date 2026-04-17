import { AnalystNav } from "@/components/shared/AnalystNav";
import { AnalystBreadcrumbs } from "@/components/shared/AnalystBreadcrumbs";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 bg-[var(--bg-base)]">
      <AnalystNav />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:mx-auto lg:max-w-[96rem]">
        <AnalystBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
