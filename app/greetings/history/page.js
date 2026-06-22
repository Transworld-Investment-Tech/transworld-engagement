import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const STATUS_STYLE = {
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-line/60 text-muted",
};

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function name(c) {
  if (!c) return "—";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "—";
}

export default async function HistoryPage({ searchParams }) {
  const user = await getCurrentUser();
  const type = searchParams?.type || "";
  const status = searchParams?.status || "";

  const supabase = getSupabase();
  let query = supabase
    .from("greeting_logs")
    .select("id,type,channel,subject,status,error,sent_at,contacts(first_name,last_name,email),greeting_templates(name)")
    .order("sent_at", { ascending: false })
    .limit(300);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  const { data: logs } = await query;

  const chip = (label, key, val) => {
    const active = (key === "type" ? type : status) === val;
    const params = new URLSearchParams();
    if (key === "type" ? val : type) params.set("type", key === "type" ? val : type);
    if (key === "status" ? val : status) params.set("status", key === "status" ? val : status);
    const qs = params.toString();
    return (
      <Link
        href={`/greetings/history${qs ? "?" + qs : ""}`}
        className={
          "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "bg-navy text-white" : "bg-navy-50 text-navy-700 hover:bg-navy-200/60")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Send history</h1>
        <p className="mt-1 text-sm text-muted">The audit trail of every greeting sent, skipped, or failed.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Type</span>
        {chip("All", "type", "")}
        {chip("Birthday", "type", "birthday")}
        {chip("Holiday", "type", "holiday")}
        {chip("Custom", "type", "custom")}
        <span className="ml-3 text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
        {chip("All", "status", "")}
        {chip("Sent", "status", "sent")}
        {chip("Failed", "status", "failed")}
        {chip("Skipped", "status", "skipped")}
      </div>

      {!logs || logs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No history yet for this filter.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(l.sent_at)}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink">{name(l.contacts)}</div>
                    {l.contacts?.email && <div className="text-xs text-muted">{l.contacts.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {l.subject || "—"}
                    {l.error && <div className="text-xs text-red-600">{l.error}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">{l.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize " +
                        (STATUS_STYLE[l.status] || "bg-line/60 text-muted")
                      }
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
