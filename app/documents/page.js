import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DocumentsClient from "@/components/DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <DocumentsClient canCreate={hasRole(user, "manager")} canDelete={hasRole(user, "admin")} />
    </AppShell>
  );
}
