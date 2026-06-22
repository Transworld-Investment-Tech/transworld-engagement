import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import AppShell from "@/components/AppShell";
import { getBirthdayContext } from "@/lib/greetingsServer";

export const dynamic = "force-dynamic";

function Tile({ href, title, desc, badge }) {
  return (
    <Link href={href} className="card group p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-navy">{title}</h3>
        {badge != null && <span className="chip">{badge}</span>}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
      <span className="mt-4 inline-block text-sm font-medium text-navy-700 group-hover:text-navy">
        Open →
      </span>
    </Link>
  );
}

export default async function GreetingsHub() {
  const user = await getCurrentUser();
  let counts = { pending: 0, upcoming: 0 };
  try {
    const ctx = await getBirthdayContext();
    counts = ctx.counts;
  } catch {
    /* show zeros if the directory can't be read */
  }

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Greetings</h1>
        <p className="mt-1 text-sm text-muted">
          Birthday and holiday emails in the Transworld house style, sent through your verified domain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tile
          href="/greetings/birthdays"
          title="Birthday queue"
          desc="Today's client birthdays, ready to review and release with one click. A manager or admin approves each send."
          badge={counts.pending ? `${counts.pending} today` : "Clear"}
        />
        <Tile
          href="/greetings/broadcast"
          title="Broadcast"
          desc="A one-off email to a segment — by tag and status — for holidays and announcements."
        />
        <Tile
          href="/greetings/templates"
          title="Templates"
          desc="Create and edit the birthday, holiday, and custom email templates, with merge tags and a live preview."
        />
        <Tile
          href="/greetings/history"
          title="Send history"
          desc="Every greeting sent, skipped, or failed — the audit trail of what went out to whom."
        />
      </div>

      {counts.upcoming > 0 && (
        <p className="mt-6 text-sm text-muted">
          {counts.upcoming} birthday{counts.upcoming === 1 ? "" : "s"} in the next 7 days.{" "}
          <Link href="/greetings/birthdays" className="font-medium text-navy-700 underline">
            See the queue
          </Link>
          .
        </p>
      )}
    </AppShell>
  );
}
