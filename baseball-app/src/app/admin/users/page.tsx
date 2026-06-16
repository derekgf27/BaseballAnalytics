import { listAdminUsersAction } from "./actions";
import { AdminUsersClient } from "./AdminUsersClient";
import { APP_NAME } from "@/lib/appBrand";

export const metadata = {
  title: `Users · Admin · ${APP_NAME}`,
};

export default async function AdminUsersPage() {
  const res = await listAdminUsersAction();

  return (
    <AdminUsersClient
      initialUsers={res.ok ? res.users : []}
      initialOrphans={res.ok ? res.orphans : []}
      initialError={res.ok ? null : res.error}
      adminConfigured={res.ok ? true : res.adminConfigured}
    />
  );
}
