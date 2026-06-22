import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";
import GreetingTemplateForm from "@/components/GreetingTemplateForm";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) redirect("/greetings/templates");

  const supabase = getSupabase();
  const { data: template } = await supabase
    .from("greeting_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Edit template</h1>
      </div>
      <GreetingTemplateForm initial={template} />
    </AppShell>
  );
}
