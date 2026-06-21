import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = getSupabase();

  const { count: activeCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Birthdays — pull DoBs and compute in JS (small directory).
  const { data: dobs } = await supabase
    .from("contacts")
    .select("date_of_birth")
    .eq("status", "active")
    .not("date_of_birth", "is", null);

  const now = new Date();
  const todayMD = (now.getMonth() + 1) * 100 + now.getDate();
  const thisMonth = now.getMonth() + 1;
  let thisMonthCount = 0;
  let next7 = 0;

  (dobs || []).forEach((r) => {
    const d = new Date(r.date_of_birth + "T00:00:00");
    if (Number.isNaN(d.getTime())) return;
    const m = d.getMonth() + 1;
    if (m === thisMonth) thisMonthCount += 1;
    // next 7 days window (month/day only)
    for (let i = 0; i < 7; i++) {
      const t = new Date(now);
      t.setDate(now.getDate() + i);
      if (t.getMonth() + 1 === m && t.getDate() === d.getDate()) {
        next7 += 1;
        break;
      }
    }
  });

  return { active: activeCount || 0, thisMonth: thisMonthCount, next7, todayMD };
}

function Stat({ label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-serif text-3xl text-navy">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
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
        <Stat label="Active contacts" value={stats.active} hint="In your directory" />
        <Stat label="Birthdays this month" value={stats.thisMonth} hint="Active contacts" />
        <Stat label="Birthdays next 7 days" value={stats.next7} hint="Ready to greet" />
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

        <div className="card p-5 opacity-80">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">Greetings</h3>
            <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-600">
              Next build
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Designed birthday and holiday emails, automatic birthday sends, and
            one-off broadcasts. Email first; WhatsApp later.
          </p>
        </div>

        <div className="card p-5 opacity-80">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">Documents</h3>
            <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-600">
              Next build
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Upload a document, send it for signing, and collect a client
            signature plus a TISL officer countersignature with a full audit
            trail.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
