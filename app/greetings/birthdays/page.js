import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import BirthdaysClient from "@/components/BirthdaysClient";

export const dynamic = "force-dynamic";

export default async function BirthdaysPage() {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <BirthdaysClient canSend={hasRole(user, "manager")} />
    </AppShell>
  );
}
