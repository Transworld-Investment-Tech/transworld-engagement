import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import ContactsClient from "@/components/ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }) {
  const user = await getCurrentUser();
  const sp = searchParams || {};
  const initialStatus =
    sp.status === "inactive" || sp.status === "all" ? sp.status : "active";
  const initialBirthday = sp.birthday === "week" || sp.birthday === "month" ? sp.birthday : "";
  return (
    <AppShell user={user}>
      <ContactsClient
        canEdit={hasRole(user, "manager")}
        canDelete={hasRole(user, "admin")}
        initialStatus={initialStatus}
        initialBirthday={initialBirthday}
      />
    </AppShell>
  );
}
