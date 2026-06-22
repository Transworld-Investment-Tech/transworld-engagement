import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import { lagosToday, isBirthdayThisMonth, isBirthdayWithinDays } from "@/lib/greetings";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = getSupabase();

  const { count: activeCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Birthdays — pull DoBs and compute in JS (small directory). The same
  // predicates back the contacts birthday filter, so each card's number matches
  // the list it surfaces.
  const { data: dobs } = await supabase
    .from("contacts")
    .select("date_of_birth")
    .eq("status", "active")
    .not("date_of_birth", "is", null);

  const today = lagosToday();
  let thisMonthCount = 0;
  let next7 = 0;
  (dobs || []).forEach((r) => {
    if (isBirthdayThisMonth(r.date_of_birth, today)) thisMonthCount += 1;
    if (isBirthdayWithinDays(r.date_of_birth, 7, today)) next7 += 1;
  });

  return { active: activeCount || 0, thisMonth: thisMonthCount, next7 };
}

function Stat({ label, value, hint, href }) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        {href && (
          <span className="text-xs font-medium text-navy-700 opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
        )}
      </div>
      <div className="mt-2 font-serif text-3xl text-navy">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card group p-5 transition-shadow hover:shadow-md">
        {body}
      </Link>
    );
  }
  return <div className="card p-5">{body}</div>;
}

export default async function Dashboard() {
  const user = await getCurrentUser();
  const stats = await getStats();

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <div className="eyebrow">Dashboard</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">
          Good to see you, {user?.name?.split(" ")[0]}.
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active contacts" value={stats.active} hint="In your directory" href="/contacts" />
        <Stat
          label="Birthdays this month"
          value={stats.thisMonth}
          hint="Active contacts · view list"
          href="/contacts?birthday=month"
        />
        <Stat
          label="Birthdays next 7 days"
          value={stats.next7}
          hint="Ready to greet · view list"
          href="/contacts?birthday=week"
        />
      </div>

      <h2 className="mb-3 mt-10 font-serif text-xl text-ink">Modules</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/contacts" className="card group p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-navy">Contacts</h3>
            <span className="chip">Live</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The shared directory of clients. Add, edit, tag, and import from a
            spreadsheet. Both other modules build on this.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-navy-700 group-hover:text-navy">
            Open contacts →
          </span>
        </Link>

        <Link href="/greetings" className="card group p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-navy">Greetings</h3>
            <span className="chip">Live</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Designed birthday and holiday emails, an approval queue for automatic
            birthday sends, and one-off broadcasts. Email first; WhatsApp later.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-navy-700 group-hover:text-navy">
            Open greetings →
          </span>
        </Link>

        <Link href="/documents" className="card group p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-navy">Documents</h3>
            <span className="chip">Live</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Upload a document, send it for signing, and collect a client
            signature plus a TISL officer countersignature with a full audit
            trail.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-navy-700 group-hover:text-navy">
            Open documents →
          </span>
        </Link>
      </div>
    </AppShell>
  );
}
