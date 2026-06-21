import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import ContactForm from "@/components/ContactForm";

export default async function NewContactPage() {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) redirect("/contacts");
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Contacts</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Add contact</h1>
      </div>
      <ContactForm mode="create" />
    </AppShell>
  );
}
