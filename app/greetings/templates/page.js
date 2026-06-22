import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import GreetingTemplatesClient from "@/components/GreetingTemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <GreetingTemplatesClient canEdit={hasRole(user, "manager")} canDelete={hasRole(user, "admin")} />
    </AppShell>
  );
}
