import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSupabase } from "@/lib/supabaseServer";
import { formatLagos, shortRef, allSigned, safeFilename } from "@/lib/documents";

// Server-only: Storage, crypto, and PDF assembly for the signing module. Never
// import this into a browser component. All DB access is service-role, gated by
// the calling route (staff routes by JWT; the public sign route by sign_token).

export const BUCKET = "documents";
export const originalPath = (id) => `originals/${id}.pdf`;
export const signedPath = (id) => `signed/${id}.pdf`;

// --- Storage ----------------------------------------------------------------

export async function uploadPdf(path, bytes) {
  const supabase = getSupabase();
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function downloadPdf(path) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(error.message);
  return new Uint8Array(await data.arrayBuffer());
}

// Short-lived signed URL (default 10 minutes). The only way any PDF is exposed.
export async function signedUrl(path, expiresIn = 600) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function removeObjects(paths) {
  const supabase = getSupabase();
  const real = paths.filter(Boolean);
  if (!real.length) return;
  await supabase.storage.from(BUCKET).remove(real); // best-effort
}

// --- Tokens, OTP, hashing ---------------------------------------------------

export function genToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function genOtp() {
  // 6 digits, zero-padded, cryptographically random.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code, token) {
  return crypto.createHash("sha256").update(`${code}:${token}`).digest("hex");
}

export function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

// --- Audit trail ------------------------------------------------------------

export async function logEvent(event) {
  const supabase = getSupabase();
  const { error } = await supabase.from("signature_events").insert({
    document_id: event.document_id,
    signatory_id: event.signatory_id || null,
    event_type: event.event_type,
    actor: event.actor || "system",
    ip: event.ip || null,
    user_agent: event.user_agent || null,
    metadata: event.metadata || {},
  });
  if (error) {
    // The audit trail must never silently vanish — surface it.
    throw new Error("Could not write audit event: " + error.message);
  }
}

// Pull the client IP / user-agent from a Next request (behind Vercel's proxy).
export function requestMeta(req) {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || h.get("x-real-ip") || null;
  return { ip, user_agent: h.get("user-agent") || null };
}

// --- PDF assembly -----------------------------------------------------------

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const NAVY = rgb(11 / 255, 31 / 255, 58 / 255);
const GOLD = rgb(194 / 255, 161 / 255, 77 / 255);
const INK = rgb(26 / 255, 29 / 255, 35 / 255);
const MUTED = rgb(91 / 255, 102 / 255, 117 / 255);
const LINE = rgb(228 / 255, 226 / 255, 219 / 255);

function drawHeader(page, fonts, title) {
  const { w, h } = A4;
  page.drawRectangle({ x: 0, y: h - 84, width: w, height: 84, color: NAVY });
  page.drawText("Transworld", {
    x: MARGIN,
    y: h - 50,
    size: 22,
    font: fonts.serifBold,
    color: rgb(1, 1, 1),
  });
  const tw = fonts.serifBold.widthOfTextAtSize("Transworld", 22);
  page.drawText(".", { x: MARGIN + tw, y: h - 50, size: 22, font: fonts.serifBold, color: GOLD });
  page.drawText("INVESTMENT & SECURITIES LIMITED", {
    x: MARGIN,
    y: h - 66,
    size: 7.5,
    font: fonts.sans,
    color: rgb(199 / 255, 210 / 255, 224 / 255),
  });
  // gold rule
  page.drawRectangle({ x: 0, y: h - 87, width: w, height: 3, color: GOLD });
  // page title
  page.drawText(title, { x: MARGIN, y: h - 124, size: 20, font: fonts.serifBold, color: NAVY });
  return h - 150; // starting y for body
}

// Tamper-evident binding stamp drawn on EVERY page of the final document
// (original body pages included). It ties each page to this specific execution:
// the document reference, a matchable fragment of the original SHA-256 (printed
// in full on the certificate), continuous pagination across the whole
// instrument, and a Confidential mark. Works on any page size/orientation.
function stampFooter(page, fonts, { ref, hashShort, index, total }) {
  const { width } = page.getSize();
  const m = 40;
  const y = 16;
  page.drawRectangle({ x: m, y: y + 11, width: Math.max(0, width - m * 2), height: 0.5, color: LINE });
  const left = `Transworld · Electronically executed · Ref ${ref}`;
  const right = `Original SHA-256 ${hashShort} · Page ${index} of ${total} · Confidential`;
  page.drawText(left, { x: m, y, size: 7, font: fonts.sans, color: MUTED });
  const rw = fonts.sans.widthOfTextAtSize(right, 7);
  page.drawText(right, { x: Math.max(m, width - m - rw), y, size: 7, font: fonts.sans, color: MUTED });
}

// Word-wrap helper. Returns the y after the drawn block.
function drawWrapped(page, text, opts) {
  const { x, font, size, color, maxWidth, lineHeight } = opts;
  let y = opts.y;
  const words = String(text).split(/\s+/);
  let line = "";
  const flush = () => {
    if (line) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
      line = "";
    }
  };
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      flush();
      line = word;
    } else {
      line = trial;
    }
  }
  flush();
  return y;
}

function labelValue(page, fonts, x, y, label, value) {
  page.drawText(label.toUpperCase(), { x, y, size: 7.5, font: fonts.sans, color: GOLD });
  return drawWrapped(page, value || "—", {
    x,
    y: y - 13,
    font: fonts.serif,
    size: 11,
    color: INK,
    maxWidth: A4.w - MARGIN * 2 - (x - MARGIN),
    lineHeight: 14,
  });
}

function decodePng(signatureData) {
  if (!signatureData) return null;
  const b64 = signatureData.includes(",") ? signatureData.split(",")[1] : signatureData;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

// Draw a single line of text fit (and, if needed, truncated) inside a box, with
// the baseline vertically centered. Used to overlay entered field values and
// in-body signatures onto the document's own pages.
function drawFitText(page, text, { x, y, w, h, font, color, maxSize = 12, align = "left" }) {
  let str = String(text == null ? "" : text);
  if (!str) return;
  let size = Math.min(maxSize, Math.max(6, h * 0.66));
  while (size > 6 && font.widthOfTextAtSize(str, size) > w) size -= 0.5;
  if (font.widthOfTextAtSize(str, size) > w) {
    while (str.length > 1 && font.widthOfTextAtSize(str + "…", size) > w) str = str.slice(0, -1);
    str = str + "…";
  }
  let tx = x;
  if (align === "center") tx = x + Math.max(0, (w - font.widthOfTextAtSize(str, size)) / 2);
  const ty = y + (h - size) / 2 + size * 0.2;
  page.drawText(str, { x: tx, y: ty, size, font, color });
}

// Render a signatory's captured signature inside a placed signature box on a
// body page (drawn PNG fitted to the box, or a typed name in italic serif).
async function drawSignatureInBox(pdf, page, fonts, signatory, f) {
  const { pos_x: x, pos_y: y, width: w, height: h } = f;
  if (signatory.signature_type === "drawn") {
    const bytes = decodePng(signatory.signature_data);
    if (bytes) {
      try {
        const png = await pdf.embedPng(bytes);
        const scale = Math.min(w / png.width, h / png.height);
        page.drawImage(png, {
          x: x + (w - png.width * scale) / 2,
          y: y + (h - png.height * scale) / 2,
          width: png.width * scale,
          height: png.height * scale,
        });
        return;
      } catch {
        /* fall through to typed */
      }
    }
  }
  drawFitText(page, signatory.signature_data || signatory.name, {
    x: x + 2,
    y,
    w: w - 4,
    h,
    font: fonts.serifItalic,
    color: NAVY,
    maxSize: 22,
  });
}

// Assembles the final PDF: overlays each staff-placed field value (and the
// signer's signature) onto the document's OWN pages at the placed coordinates,
// appends an Execution page only for any signatory not shown in the body, then a
// Certificate, and binds every page with the tamper-evident footer.
//
// pdf-lib ships standard fonts only; Georgia cannot be embedded without the
// font file, so Times Roman is used as the serif on the generated pages — the
// closest standard serif to the house Georgia.
export async function assembleSignedPdf({ originalBytes, document, signatories, fields = [] }) {
  const pdf = await PDFDocument.load(originalBytes);
  const fonts = {
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
  };

  const ordered = [...signatories].sort((a, b) => a.sign_order - b.sign_order);
  const ref = shortRef(document.id);
  const isAcceptance = document.kind === "acceptance";
  const colW = A4.w - MARGIN * 2;

  // The original document's fingerprint — computed BEFORE we add, overlay, or
  // stamp any page (a file cannot contain its own final hash). Printed in full
  // on the certificate and as a matchable fragment in every page's footer.
  const originalHash = sha256Hex(originalBytes);
  const hashShort = `${originalHash.slice(0, 12)}...${originalHash.slice(-8)}`;

  // ---- Overlay placed fields onto the body --------------------------------
  // Field values and signatures are stamped at their authored coordinates on the
  // document's own pages. A role shown in the body via a signature field does
  // not need an Execution-page box.
  const bodyPages = pdf.getPages();
  const sigByRole = {};
  for (const s of ordered) sigByRole[s.role] = s;
  const renderedRoles = new Set();

  for (const f of [...fields].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
    const idx = (f.page || 1) - 1;
    if (idx < 0 || idx >= bodyPages.length) continue;
    if (![f.pos_x, f.pos_y, f.width, f.height].every((n) => Number.isFinite(Number(n)))) continue;
    const page = bodyPages[idx];
    const box = { pos_x: Number(f.pos_x), pos_y: Number(f.pos_y), width: Number(f.width), height: Number(f.height) };
    if (f.field_type === "signature") {
      const s = sigByRole[f.signatory_role];
      if (s && s.status === "signed" && s.signature_data) {
        await drawSignatureInBox(pdf, page, fonts, s, box);
        renderedRoles.add(f.signatory_role);
      }
    } else {
      const val = f.value == null ? "" : String(f.value);
      if (val) {
        drawFitText(page, val, {
          x: box.pos_x + 2,
          y: box.pos_y,
          w: box.width - 4,
          h: box.height,
          font: fonts.serif,
          color: INK,
          maxSize: 13,
        });
      }
    }
  }

  // ---- Execution page (only for signatories not shown in the body) --------
  const fallback = ordered.filter((s) => !renderedRoles.has(s.role));
  if (fallback.length) {
    const exec = pdf.addPage([A4.w, A4.h]);
    let y = drawHeader(exec, fonts, isAcceptance ? "Acceptance" : "Execution Page");
    y = drawWrapped(exec, document.title, {
      x: MARGIN,
      y,
      font: fonts.serifBold,
      size: 13,
      color: NAVY,
      maxWidth: colW,
      lineHeight: 16,
    });
    exec.drawText(`Reference ${ref}`, { x: MARGIN, y: y - 2, size: 9, font: fonts.sans, color: MUTED });
    y -= 28;

    for (const s of fallback) {
      const roleLabel = s.role === "officer" ? "TISL Officer" : "Client";
      exec.drawText(roleLabel.toUpperCase(), { x: MARGIN, y, size: 8, font: fonts.sans, color: GOLD });
      exec.drawText(s.name, { x: MARGIN, y: y - 16, size: 13, font: fonts.serifBold, color: INK });

      const boxY = y - 78;
      const boxH = 52;
      const boxW = 240;
      exec.drawRectangle({ x: MARGIN, y: boxY, width: boxW, height: boxH, borderColor: LINE, borderWidth: 0.8 });
      await drawSignatureInBox(pdf, exec, fonts, s, {
        pos_x: MARGIN + 8,
        pos_y: boxY + 6,
        width: boxW - 16,
        height: boxH - 12,
      });

      const verb = isAcceptance && s.role === "client" ? "Accepted" : "Signed";
      exec.drawText(`${verb} electronically on ${formatLagos(s.signed_at)}`, {
        x: MARGIN,
        y: boxY - 16,
        size: 9,
        font: fonts.serif,
        color: MUTED,
      });
      y = boxY - 44;
    }
  }

  // ---- Certificate --------------------------------------------------------
  const cert = pdf.addPage([A4.w, A4.h]);
  let cy = drawHeader(cert, fonts, isAcceptance ? "Certificate of Acceptance" : "Certificate of Completion");
  cy = drawWrapped(
    cert,
    isAcceptance
      ? "This certificate records the electronic acceptance of the document below and the audit trail captured for the signer."
      : "This certificate records the electronic execution of the document below and the audit trail captured for each signatory.",
    { x: MARGIN, y: cy, font: fonts.serif, size: 10.5, color: MUTED, maxWidth: colW, lineHeight: 14 }
  );
  cy -= 14;

  cy = labelValue(cert, fonts, MARGIN, cy, "Document", document.title);
  cy -= 8;
  // two columns of meta
  const col2 = MARGIN + colW / 2;
  const rowTop = cy;
  const leftEnd = labelValue(cert, fonts, MARGIN, rowTop, "Reference", ref);
  const rightEnd = labelValue(cert, fonts, col2, rowTop, "Original file", document.original_filename || "—");
  cy = Math.min(leftEnd, rightEnd) - 8;
  const r2 = cy;
  const l2e = labelValue(
    cert,
    fonts,
    MARGIN,
    r2,
    isAcceptance ? "Accepted" : "Completed",
    formatLagos(document.completed_at || new Date())
  );
  const r2e = labelValue(cert, fonts, col2, r2, isAcceptance ? "Signer" : "Parties", isAcceptance ? "1" : String(ordered.length));
  cy = Math.min(l2e, r2e) - 16;

  // per-signatory audit blocks
  for (const s of ordered) {
    cert.drawRectangle({ x: MARGIN, y: cy - 2, width: colW, height: 0.7, color: LINE });
    cy -= 16;
    const method =
      s.role === "officer"
        ? "Authenticated app session"
        : "Email link + one-time code (OTP)";
    cert.drawText(`${s.role === "officer" ? "TISL Officer" : "Client"} — ${s.name}`, {
      x: MARGIN,
      y: cy,
      size: 11.5,
      font: fonts.serifBold,
      color: NAVY,
    });
    cy -= 16;
    const consentLabel = isAcceptance && s.role === "client"
      ? "Consent to accept electronically"
      : "Consent to sign electronically";
    const whenLabel = isAcceptance && s.role === "client" ? "Accepted at" : "Signed at";
    const rows = [
      ["Email", s.email],
      ["Verification", method],
      [consentLabel, s.consent_given ? "Given" : "Not recorded"],
      [whenLabel, formatLagos(s.signed_at)],
      ["IP address", s.signer_ip || "—"],
      ["Device / browser", (s.signer_user_agent || "—").slice(0, 90)],
    ];
    for (const [k, v] of rows) {
      cert.drawText(k, { x: MARGIN + 6, y: cy, size: 9, font: fonts.sans, color: MUTED });
      cy = drawWrapped(cert, v || "—", {
        x: MARGIN + 170,
        y: cy,
        font: fonts.serif,
        size: 9.5,
        color: INK,
        maxWidth: colW - 176,
        lineHeight: 12,
      });
      cy -= 3;
    }
    cy -= 8;
  }

  // integrity fingerprint — the ORIGINAL document hash (computed above, before
  // any page was added or stamped; the final-PDF hash is stored separately).
  cert.drawRectangle({ x: MARGIN, y: cy - 2, width: colW, height: 0.7, color: LINE });
  cy -= 16;
  cert.drawText("TAMPER EVIDENCE", { x: MARGIN, y: cy, size: 8, font: fonts.sans, color: GOLD });
  cy -= 14;
  cy = drawWrapped(cert, `Original document SHA-256: ${originalHash}`, {
    x: MARGIN,
    y: cy,
    font: fonts.serif,
    size: 9,
    color: INK,
    maxWidth: colW,
    lineHeight: 12,
  });
  cy -= 2;
  cy = drawWrapped(
    cert,
    "This is a unique fingerprint of the uploaded document. If a single byte of the original changes, this value changes — so it can be used to prove the signed instrument matches what was presented. Every page below carries this reference and fingerprint, binding the original pages to this execution and certificate.",
    { x: MARGIN, y: cy, font: fonts.serif, size: 9, color: MUTED, maxWidth: colW, lineHeight: 12 }
  );

  // ---- Bind every page to this execution ----------------------------------
  // Stamp the tamper-evident footer on ALL pages (original body + the two
  // appended pages), with continuous pagination so a removed page is obvious.
  const pages = pdf.getPages();
  const total = pages.length;
  pages.forEach((p, i) =>
    stampFooter(p, fonts, { ref, hashShort, index: i + 1, total })
  );

  const bytes = await pdf.save();
  return { bytes, originalHash };
}

// Orchestrates completion: if every signatory has signed, assemble the final
// PDF, hash it, store it, stamp the document, and log the completion event.
// Returns { completed: boolean }.
export async function finalizeIfComplete(documentId) {
  const supabase = getSupabase();

  const { data: document, error: dErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (dErr) throw new Error(dErr.message);
  if (!document || document.status === "completed") return { completed: !!document?.completed_at };

  const { data: sigs, error: sErr } = await supabase
    .from("signatories")
    .select("*")
    .eq("document_id", documentId)
    .order("sign_order", { ascending: true });
  if (sErr) throw new Error(sErr.message);

  if (!allSigned(sigs || [])) return { completed: false };

  // Placed fields + entered values authored by staff and filled by the signer.
  const { data: fields } = await supabase
    .from("signature_fields")
    .select("*")
    .eq("document_id", documentId);

  const originalBytes = await downloadPdf(document.storage_path);
  const completedAt = new Date().toISOString();
  const { bytes } = await assembleSignedPdf({
    originalBytes,
    document: { ...document, completed_at: completedAt },
    signatories: sigs,
    fields: fields || [],
  });

  const outPath = signedPath(documentId);
  await uploadPdf(outPath, bytes);
  const finalHash = sha256Hex(bytes);

  const { error: uErr } = await supabase
    .from("documents")
    .update({
      status: "completed",
      signed_storage_path: outPath,
      sha256_hash: finalHash,
      completed_at: completedAt,
    })
    .eq("id", documentId);
  if (uErr) throw new Error(uErr.message);

  await logEvent({
    document_id: documentId,
    event_type: "completed",
    actor: "system",
    metadata: { final_sha256: finalHash, kind: document.kind || "signature" },
  });

  // Return the freshly assembled bytes so the caller can attach the signed PDF
  // to the client's completion email (no second download needed).
  return {
    completed: true,
    signedBytes: bytes,
    filename: safeFilename(document.title, document.kind === "acceptance" ? "accepted" : "signed"),
    title: document.title,
    kind: document.kind || "signature",
  };
}
