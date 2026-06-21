import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) redirect("/contacts");

  const supabase = getSupabase();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!contact) notFound();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Contacts</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">
          {contact.first_name} {contact.last_name}
        </h1>
      </div>
      <ContactForm mode="edit" initial={contact} />
    </AppShell>
  );
}
