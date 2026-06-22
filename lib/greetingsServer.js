import { getSupabase } from "@/lib/supabaseServer";
import {
  lagosToday,
  monthDay,
  daysUntil,
  isLeap,
} from "@/lib/greetings";

// Builds today's birthday picture plus a 7-day heads-up. The "approval queue"
// is computed on demand from contacts + greeting_logs — there are no stored
// pending rows, so nothing to migrate.
//
//   today    — every active contact whose birthday is today (handled or not)
//   pending  — today's contacts not yet sent/skipped this year AND with an email
//   upcoming — active contacts with a birthday in the next 1–7 days
export async function getBirthdayContext() {
  const supabase = getSupabase();
  const t = lagosToday();

  const { data: contacts, error: cErr } = await supabase
    .from("contacts")
    .select("id,title,first_name,last_name,email,date_of_birth")
    .eq("status", "active")
    .not("date_of_birth", "is", null);
  if (cErr) throw new Error(cErr.message);

  // Contacts already greeted (sent) or deliberately skipped this calendar year.
  const startOfYear = `${t.year}-01-01T00:00:00Z`;
  const { data: logs } = await supabase
    .from("greeting_logs")
    .select("contact_id,status")
    .eq("type", "birthday")
    .gte("sent_at", startOfYear);
  const handled = new Set(
    (logs || [])
      .filter((l) => l.status === "sent" || l.status === "skipped")
      .map((l) => l.contact_id)
  );

  const feb28NonLeap = t.month === 2 && t.day === 28 && !isLeap(t.year);

  const today = [];
  const upcoming = [];

  for (const c of contacts || []) {
    const md = monthDay(c.date_of_birth);
    if (!md) continue;

    const isToday =
      (md.month === t.month && md.day === t.day) ||
      (feb28NonLeap && md.month === 2 && md.day === 29); // 29 Feb falls back to 28 Feb

    if (isToday) {
      today.push({ ...c, handled: handled.has(c.id) });
    } else {
      const inDays = daysUntil(t, md.month, md.day);
      if (inDays >= 1 && inDays <= 7) upcoming.push({ ...c, inDays });
    }
  }

  const pending = today.filter((c) => !c.handled && c.email);
  upcoming.sort((a, b) => a.inDays - b.inDays);

  return {
    lagosDate: t.iso,
    today,
    pending,
    upcoming,
    counts: {
      today: today.length,
      pending: pending.length,
      upcoming: upcoming.length,
    },
  };
}

// Resolves broadcast recipients from a saved filter.
//   filter = { status: "active"|"all", tags: string[], match: "any"|"all" }
// Only contacts WITH an email are returned (you cannot email a blank address).
export async function resolveRecipients(filter = {}) {
  const supabase = getSupabase();
  const status = filter.status === "all" ? null : "active";
  const tags = Array.isArray(filter.tags)
    ? filter.tags.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const match = filter.match === "all" ? "all" : "any";

  let query = supabase
    .from("contacts")
    .select("id,title,first_name,last_name,email")
    .not("email", "is", null);

  if (status) query = query.eq("status", status);
  if (tags.length) {
    query = match === "all" ? query.contains("tags", tags) : query.overlaps("tags", tags);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  return (data || []).filter((c) => c.email && c.email.trim());
}
