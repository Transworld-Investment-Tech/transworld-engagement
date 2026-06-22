import { getCurrentUser, hasRole } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";
import BroadcastClient from "@/components/BroadcastClient";
import { SUGGESTED_TAGS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const user = await getCurrentUser();

  if (!hasRole(user, "manager")) {
    return (
      <AppShell user={user}>
        <div className="mb-6">
          <div className="eyebrow">Greetings</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">Broadcast</h1>
        </div>
        <div className="card p-8 text-center text-sm text-muted">
          Broadcasts can be sent by a manager or admin. You don't have permission to send from this account.
        </div>
      </AppShell>
    );
  }

  const supabase = getSupabase();
  const { data: templates } = await supabase
    .from("greeting_templates")
    .select("id,name,type,subject,html_body")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <AppShell user={user}>
      <BroadcastClient templates={templates || []} suggestedTags={SUGGESTED_TAGS} />
    </AppShell>
  );
}
