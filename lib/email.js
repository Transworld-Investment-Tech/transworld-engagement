import { Resend } from "resend";

// Thin wrapper over Resend. Server-only: never import into a browser component.
// All Greetings email goes out from here so logging and error handling stay
// in one place.

let _resend = null;

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY must be set");
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export function mailFrom() {
  return process.env.MAIL_FROM || "Transworld <noreply@transworldltd.com.ng>";
}

// Returns { ok: true, id } or { ok: false, error } — never throws on a send
// failure, so callers can log per-recipient outcomes and keep going.
export async function sendEmail({ to, subject, html, replyTo }) {
  try {
    const resend = client();
    const { data, error } = await resend.emails.send({
      from: mailFrom(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      const msg =
        (error && error.message) ||
        (typeof error === "string" ? error : JSON.stringify(error));
      return { ok: false, error: msg };
    }
    return { ok: true, id: (data && data.id) || null };
  } catch (e) {
    return { ok: false, error: e.message || "Email send failed" };
  }
}
