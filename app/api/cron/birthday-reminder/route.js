import { NextResponse } from "next/server";
import { getBirthdayContext } from "@/lib/greetingsServer";
import { renderEmailHtml } from "@/lib/greetings";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Vercel Cron calls this each morning. Vercel automatically attaches
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set,
// so we verify that and reject anything else. This endpoint only NOTIFIES
// staff that birthdays are waiting in the approval queue — it never emails a
// client. Releasing greetings stays a deliberate human click.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ctx;
  try {
    ctx = await getBirthdayContext();
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to compute queue" }, { status: 500 });
  }

  if (!ctx.pending.length) {
    return NextResponse.json({ ok: true, count: 0, note: "No birthdays pending today" });
  }

  const to = (process.env.GREETINGS_REMINDER_TO || "").trim();
  if (!to) {
    // Nothing to send to — succeed quietly so the cron run isn't marked failed.
    return NextResponse.json({
      ok: true,
      count: ctx.pending.length,
      note: "GREETINGS_REMINDER_TO not set; reminder not emailed",
    });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://transworld-engagement.vercel.app").replace(/\/+$/, "");
  const link = `${base}/greetings/birthdays`;
  const names = ctx.pending
    .map((c) => [c.title, c.first_name, c.last_name].filter(Boolean).join(" "))
    .map((n) => `<li style="margin:0 0 4px;">${n}</li>`)
    .join("");

  const bodyHtml = `
<p style="margin:0 0 16px;">Good morning,</p>
<p style="margin:0 0 16px;">There ${ctx.pending.length === 1 ? "is" : "are"} <strong>${ctx.pending.length}</strong> client ${
    ctx.pending.length === 1 ? "birthday" : "birthdays"
  } waiting in the approval queue today:</p>
<ul style="margin:0 0 20px;padding-left:20px;">${names}</ul>
<p style="margin:0 0 24px;">No greeting has been sent yet — open the queue to review and release.</p>
<p style="margin:0;"><a href="${link}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">Open the birthday queue</a></p>`;

  const subject = `${ctx.pending.length} birthday${ctx.pending.length === 1 ? "" : "s"} to release today`;
  const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
  const sent = await sendEmail({
    to: recipients,
    subject,
    html: renderEmailHtml({ subject, bodyHtml, preheader: subject }),
  });

  if (!sent.ok) {
    return NextResponse.json({ ok: false, count: ctx.pending.length, error: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, count: ctx.pending.length, notified: recipients.length });
}
