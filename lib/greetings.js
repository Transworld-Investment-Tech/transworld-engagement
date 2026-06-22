// Pure helpers — no server-only imports — so the SAME rendering runs in the
// browser preview and in the server send path. House style: navy/gold, Georgia
// serif, justified body, confidential footer.

export const GREETING_TYPES = ["birthday", "holiday", "custom"];

export const MERGE_TAGS = [
  { tag: "{{title}}", label: "Title" },
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{last_name}}", label: "Last name" },
  { tag: "{{full_name}}", label: "Full name" },
];

export function fullName(c) {
  return [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Replace {{title}} {{first_name}} {{last_name}} {{full_name}} (case-insensitive,
// tolerant of inner spaces). Unknown tags are left untouched.
export function renderMergeTags(text, contact) {
  if (!text) return "";
  const map = {
    title: (contact && contact.title) || "",
    first_name: (contact && contact.first_name) || "",
    last_name: (contact && contact.last_name) || "",
    full_name: fullName(contact || {}),
  };
  return String(text).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
    const k = key.toLowerCase();
    return k in map ? map[k] : m;
  });
}

// Wraps an inner message (already merge-rendered) in the branded shell.
// Email-safe: table layout, inline styles only.
export function renderEmailHtml({ subject, bodyHtml, preheader = "" }) {
  const year = new Date().getFullYear();
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${escapeHtml(
        preheader
      )}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject || "Transworld")}</title>
</head>
<body style="margin:0;padding:0;background:#EFECE4;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFECE4;">
 <tr><td align="center" style="padding:28px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FBFAF7;border:1px solid #E4E2DB;border-radius:12px;overflow:hidden;">
   <tr><td style="background:#0B1F3A;padding:22px 32px;">
     <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1;color:#ffffff;">Transworld<span style="color:#C2A14D;">.</span></div>
     <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C7D2E0;">Investment &amp; Securities Limited</div>
   </td></tr>
   <tr><td style="height:3px;background:#C2A14D;line-height:3px;font-size:0;">&nbsp;</td></tr>
   <tr><td style="padding:32px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#1A1D23;text-align:justify;">
${bodyHtml}
   </td></tr>
   <tr><td style="padding:0 32px;"><div style="height:1px;background:#E4E2DB;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
   <tr><td style="padding:20px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#5B6675;">
     <div>Transworld Investment &amp; Securities Limited &middot; Lagos, Nigeria</div>
     <div style="margin-top:6px;color:#8A93A0;">This message is confidential and intended only for the named recipient. &copy; ${year} Transworld Investment &amp; Securities Limited. All rights reserved.</div>
   </td></tr>
  </table>
 </td></tr>
</table>
</body>
</html>`;
}

// Full rendered email for one contact: returns { subject, html }.
export function renderGreeting(template, contact) {
  const subject = renderMergeTags(template.subject || "", contact);
  const bodyHtml = renderMergeTags(template.html_body || "", contact);
  const preheader = subject;
  return { subject, html: renderEmailHtml({ subject, bodyHtml, preheader }) };
}

// ---- Date helpers (Lagos is UTC+1, no DST) --------------------------------

export function lagosToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
  const [y, m, d] = parts.split("-").map(Number);
  return { year: y, month: m, day: d, iso: parts };
}

export function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// month/day from a 'YYYY-MM-DD' string, by slicing (no timezone surprises).
export function monthDay(dobStr) {
  if (!dobStr || dobStr.length < 10) return null;
  return { month: Number(dobStr.slice(5, 7)), day: Number(dobStr.slice(8, 10)) };
}

// Whole days from today (Lagos) until the next occurrence of (month, day).
export function daysUntil(today, month, day) {
  const base = Date.UTC(today.year, today.month - 1, today.day);
  let target = Date.UTC(today.year, month - 1, day);
  if (target < base) target = Date.UTC(today.year + 1, month - 1, day);
  return Math.round((target - base) / 86400000);
}

export function formatDayMonth(dobStr) {
  const md = monthDay(dobStr);
  if (!md) return "—";
  const dt = new Date(Date.UTC(2000, md.month - 1, md.day));
  return dt.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
