import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { resolveRecipients } from "@/lib/greetingsServer";
import { renderGreeting } from "@/lib/greetings";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const SAMPLE = { title: "Mr", first_name: "Ada", last_name: "Okafor", email: "" };

async function loadTemplate(supabase, id) {
  const { data } = await supabase
    .from("greeting_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to send broadcasts" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mode = body.mode || "count";
  const supabase = getSupabase();

  // ----- COUNT: how many contacts match this filter -------------------------
  if (mode === "count") {
    try {
      const recipients = await resolveRecipients(body.filter || {});
      return NextResponse.json({
        count: recipients.length,
        sample: recipients.slice(0, 5).map((c) => [c.title, c.first_name, c.last_name].filter(Boolean).join(" ")),
      });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ----- TEST: send one sample email to a named address ---------------------
  if (mode === "test") {
    const to = (body.to || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "Enter a valid test email address" }, { status: 400 });
    }
    const template = await loadTemplate(supabase, body.template_id);
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { subject, html } = renderGreeting(template, SAMPLE);
    const sent = await sendEmail({ to, subject: `[TEST] ${subject}`, html });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  // ----- SEND: deliver to all matched recipients ----------------------------
  if (mode === "send") {
    const template = await loadTemplate(supabase, body.template_id);
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    let recipients;
    try {
      recipients = await resolveRecipients(body.filter || {});
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients match this filter" }, { status: 400 });
    }

    const logRows = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const c of recipients) {
      const { subject, html } = renderGreeting(template, c);
      const sent = await sendEmail({ to: c.email, subject, html });
      if (sent.ok) sentCount += 1;
      else failedCount += 1;
      logRows.push({
        contact_id: c.id,
        template_id: template.id,
        type: template.type === "birthday" ? "custom" : template.type,
        channel: "email",
        subject,
        status: sent.ok ? "sent" : "failed",
        resend_id: sent.ok ? sent.id : null,
        error: sent.ok ? null : sent.error,
        sent_by: user.id,
      });
    }

    const { error: lErr } = await supabase.from("greeting_logs").insert(logRows);
    if (lErr) {
      return NextResponse.json(
        { ok: true, sent: sentCount, failed: failedCount, warning: "Sent, but logging failed: " + lErr.message },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, sent: sentCount, failed: failedCount });
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
