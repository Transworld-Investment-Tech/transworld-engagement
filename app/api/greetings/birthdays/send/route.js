import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { renderGreeting } from "@/lib/greetings";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Pull client IP / agent for the log (not strictly needed for greetings, but
// cheap and consistent with the rest of the app).
function reqMeta(req) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return { ip: fwd.split(",")[0].trim() || null };
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to release birthday greetings" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const action = body.action === "skip" ? "skip" : "release";
  const ids = Array.isArray(body.contact_ids) ? body.contact_ids.filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { ip } = reqMeta(req);

  // ----- SKIP: record a skip so the contact drops out of this year's queue ---
  if (action === "skip") {
    const rows = ids.map((contact_id) => ({
      contact_id,
      type: "birthday",
      channel: "email",
      status: "skipped",
      sent_by: user.id,
    }));
    const { error } = await supabase.from("greeting_logs").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skipped: ids.length });
  }

  // ----- RELEASE: a template is required -------------------------------------
  const templateId = body.template_id;
  if (!templateId) {
    return NextResponse.json({ error: "Choose a template to send" }, { status: 400 });
  }

  const { data: template, error: tErr } = await supabase
    .from("greeting_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: contacts, error: cErr } = await supabase
    .from("contacts")
    .select("id,title,first_name,last_name,email")
    .in("id", ids);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const results = [];
  const logRows = [];

  for (const c of contacts || []) {
    if (!c.email) {
      logRows.push({
        contact_id: c.id,
        template_id: template.id,
        type: "birthday",
        channel: "email",
        subject: template.subject,
        status: "skipped",
        error: "No email address",
        sent_by: user.id,
      });
      results.push({ id: c.id, ok: false, error: "No email address" });
      continue;
    }

    const { subject, html } = renderGreeting(template, c);
    const sent = await sendEmail({ to: c.email, subject, html });

    logRows.push({
      contact_id: c.id,
      template_id: template.id,
      type: "birthday",
      channel: "email",
      subject,
      status: sent.ok ? "sent" : "failed",
      resend_id: sent.ok ? sent.id : null,
      error: sent.ok ? null : sent.error,
      sent_by: user.id,
    });
    results.push({ id: c.id, ok: sent.ok, error: sent.ok ? null : sent.error });
  }

  if (logRows.length) {
    const { error: lErr } = await supabase.from("greeting_logs").insert(logRows);
    if (lErr) {
      // Email already went out; surface the logging failure but don't pretend it failed.
      return NextResponse.json(
        { ok: true, results, warning: "Sent, but logging failed: " + lErr.message },
        { status: 200 }
      );
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - sentCount;
  return NextResponse.json({ ok: true, sent: sentCount, failed: failedCount, results });
}
