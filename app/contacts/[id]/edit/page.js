import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";
import ContactForm from "@/components/ContactForm";
import ResearchSubscribeToggle from "@/components/ResearchSubscribeToggle";

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

  const { data: subscription } = await supabase
    .from("report_subscriptions")
    .select("tier, status, created_at")
    .eq("contact_id", params.id)
    .maybeSingle();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Contacts</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">
          {contact.first_name} {contact.last_name}
        </h1>
      </div>
      <ContactForm mode="edit" initial={contact} />
      <ResearchSubscribeToggle
        contactId={contact.id}
        initial={subscription || null}
        canEdit={hasRole(user, "manager")}
      />
    </AppShell>
  );
}
