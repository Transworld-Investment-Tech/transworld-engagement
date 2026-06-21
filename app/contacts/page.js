import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import ContactsClient from "@/components/ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <ContactsClient canEdit={hasRole(user, "manager")} canDelete={hasRole(user, "admin")} />
    </AppShell>
  );
}
