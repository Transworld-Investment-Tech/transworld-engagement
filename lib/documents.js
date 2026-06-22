// Pure helpers for the Documents (signing) module — NO server-only imports, so
// the same code is safe in a client component and on the server. The branded
// email shell is reused from the Greetings module so signing mail carries the
// identical navy/gold, Georgia-serif house style.

import { renderEmailHtml, escapeHtml } from "@/lib/greetings";

// --- Status -----------------------------------------------------------------

export const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "partially_signed",
  "completed",
  "voided",
  "expired",
];

export const DOCUMENT_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent for signing",
  partially_signed: "Partially signed",
  completed: "Completed",
  voided: "Voided",
  expired: "Expired",
};

export const SIGNATORY_STATUS_LABELS = {
  pending: "Awaiting",
  viewed: "Opened",
  signed: "Signed",
  declined: "Declined",
};

export const DEFAULT_EXPIRY_DAYS = 14;

// Whether a document is sent "for signature" (the standard flow) or "for
// acceptance" (a TISL-prepared proposal the client accepts; client-only).
export const DOCUMENT_KINDS = ["signature", "acceptance"];

export const DOCUMENT_KIND_LABELS = {
  signature: "For signature",
  acceptance: "For acceptance",
};

// The verb shown to a signer for a given kind ("sign" vs "accept").
export function signVerb(kind) {
  return kind === "acceptance" ? "accept" : "sign";
}

// The display label for a completed document of each kind.
export function completedLabel(kind) {
  return kind === "acceptance" ? "Accepted" : "Completed";
}

// A document is finished signing once every signatory has signed.
export function allSigned(signatories) {
  return (
    signatories.length > 0 &&
    signatories.every((s) => s.status === "signed")
  );
}

// The next signatory whose turn it is (lowest sign_order not yet signed).
export function nextSignatory(signatories) {
  const ordered = [...signatories].sort((a, b) => a.sign_order - b.sign_order);
  return ordered.find((s) => s.status !== "signed" && s.status !== "declined") || null;
}

// --- Dates ------------------------------------------------------------------

// Format a timestamp in Africa/Lagos for display on certificates and emails,
// e.g. "22 June 2026, 2:32 PM (WAT)". American English month names.
export function formatLagos(ts) {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${date}, ${time} (WAT)`;
}

// Short reference shown to humans — first 8 chars of the UUID, upper-cased.
export function shortRef(id) {
  return id ? String(id).slice(0, 8).toUpperCase() : "—";
}

// A safe download filename for the final PDF, derived from the title.
export function safeFilename(title, suffix = "signed") {
  const base = String(title || "document")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "document";
  return `${base}-${suffix}.pdf`;
}

// --- Emails (house style) ---------------------------------------------------

// The signing-request email a client receives with their one-time link. For an
// acceptance document the wording is "review and accept" rather than "sign".
export function signingRequestEmail({ signerName, documentTitle, signUrl, expiresLabel, kind }) {
  const accept = kind === "acceptance";
  const subject = accept
    ? `Proposal for your acceptance — ${documentTitle}`
    : `Document for your signature — ${documentTitle}`;
  const lead = accept
    ? `Transworld Investment &amp; Securities Limited has prepared a proposal for your review and acceptance: <strong>${escapeHtml(
        documentTitle
      )}</strong>.`
    : `Transworld Investment &amp; Securities Limited has prepared a document that requires your signature: <strong>${escapeHtml(
        documentTitle
      )}</strong>.`;
  const instruction = accept
    ? `Please review it and, if you are happy to proceed, complete the fields and accept using your secure personal link below. For your protection, you will be asked to enter a one-time code that we send to this email address before you accept.`
    : `Please review and sign it using your secure personal link below. For your protection, you will be asked to enter a one-time code that we send to this email address before you sign.`;
  const cta = accept ? "Review &amp; accept" : "Review &amp; sign the document";
  const bodyHtml = `
<p style="margin:0 0 16px;">Dear ${escapeHtml(signerName)},</p>
<p style="margin:0 0 16px;">${lead}</p>
<p style="margin:0 0 16px;">${instruction}</p>
<p style="margin:24px 0;text-align:center;">
  <a href="${escapeHtml(signUrl)}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;padding:13px 26px;border-radius:8px;">${cta}</a>
</p>
<p style="margin:0 0 16px;font-size:13px;color:#5B6675;">If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(
    signUrl
  )}</p>
<p style="margin:0 0 16px;">This link is personal to you and will expire on <strong>${escapeHtml(
    expiresLabel
  )}</strong>. If you were not expecting this, please contact us before taking any action.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`;
  return {
    subject,
    html: renderEmailHtml({
      subject,
      bodyHtml,
      preheader: accept
        ? `Please review and accept ${documentTitle}.`
        : `Please review and sign ${documentTitle}.`,
    }),
  };
}

// The one-time code email sent at sign time (second factor).
export function otpEmail({ signerName, code, documentTitle }) {
  const subject = `Your one-time signing code: ${code}`;
  const bodyHtml = `
<p style="margin:0 0 16px;">Dear ${escapeHtml(signerName)},</p>
<p style="margin:0 0 16px;">Use the one-time code below to confirm your identity and sign <strong>${escapeHtml(
    documentTitle
  )}</strong>.</p>
<p style="margin:24px 0;text-align:center;">
  <span style="display:inline-block;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:8px;color:#0B1F3A;border:1px solid #E4E2DB;border-radius:10px;padding:14px 24px;background:#FBFAF7;">${escapeHtml(
    code
  )}</span>
</p>
<p style="margin:0 0 16px;">This code expires in 10 minutes. Do not share it with anyone — Transworld will never ask you for it by phone or message.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`;
  return {
    subject,
    html: renderEmailHtml({ subject, bodyHtml, preheader: "Your one-time signing code." }),
  };
}

// Confirmation to the client once the document is complete. The final PDF is
// attached. For an acceptance, the language is "accepted" rather than "executed".
export function completionEmail({ signerName, documentTitle, kind }) {
  const accept = kind === "acceptance";
  const subject = accept ? `Accepted: ${documentTitle}` : `Completed: ${documentTitle}`;
  const lead = accept
    ? `Thank you. Your acceptance of <strong>${escapeHtml(
        documentTitle
      )}</strong> has been recorded.`
    : `Thank you. <strong>${escapeHtml(
        documentTitle
      )}</strong> has now been fully executed by all parties, including Transworld Investment &amp; Securities Limited.`;
  const keep = accept
    ? `A copy showing your completed entries and acceptance is <strong>attached to this email</strong> for your records, with a certificate of acceptance and a tamper-evidence checkmark. Please keep it safe. We will be in touch with the next steps shortly.`
    : `A fully signed copy is <strong>attached to this email</strong> for your records, including an execution page and a certificate of completion with a tamper-evidence checkmark. Please keep it safe.`;
  const bodyHtml = `
<p style="margin:0 0 16px;">Dear ${escapeHtml(signerName)},</p>
<p style="margin:0 0 16px;">${lead}</p>
<p style="margin:0 0 16px;">${keep}</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`;
  return {
    subject,
    html: renderEmailHtml({
      subject,
      bodyHtml,
      preheader: accept
        ? `${documentTitle} accepted — copy attached.`
        : `${documentTitle} is fully signed — copy attached.`,
    }),
  };
}

// A staff-facing nudge to the assigned officer that a document is waiting for
// their in-app countersignature. Never sent to a client.
export function officerNudgeEmail({ officerName, documentTitle, appUrl }) {
  const subject = `Awaiting your countersignature — ${documentTitle}`;
  const bodyHtml = `
<p style="margin:0 0 16px;">Dear ${escapeHtml(officerName)},</p>
<p style="margin:0 0 16px;">The client has signed <strong>${escapeHtml(
    documentTitle
  )}</strong>. It is now waiting for your countersignature as the executing officer.</p>
<p style="margin:24px 0;text-align:center;">
  <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;padding:13px 26px;border-radius:8px;">Open in the app to countersign</a>
</p>
<p style="margin:0 0 16px;font-size:13px;color:#5B6675;">You will sign in to the app and countersign there — this link does not sign on your behalf.</p>
<p style="margin:24px 0 0;">Regards,<br>Transworld Client Engagement</p>`;
  return {
    subject,
    html: renderEmailHtml({ subject, bodyHtml, preheader: `${documentTitle} awaits your countersignature.` }),
  };
}
