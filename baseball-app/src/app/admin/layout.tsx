import { SidebarAuthSession } from "@/components/auth/SidebarAuthSession";
import { AdminNav } from "@/components/shared/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-portal flex min-h-0 flex-1 bg-[var(--bg-base)]">
      <AdminNav footer={<SidebarAuthSession portal="admin" />} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:mx-auto lg:max-w-[96rem]">
        {children}
      </main>
    </div>
  );
}
