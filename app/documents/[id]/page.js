import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DocumentDetailClient from "@/components/DocumentDetailClient";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({ params }) {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <DocumentDetailClient
        id={params.id}
        canManage={hasRole(user, "manager")}
        canDelete={hasRole(user, "admin")}
        currentUser={{ id: user.id, name: user.name, email: user.email }}
      />
    </AppShell>
  );
}
