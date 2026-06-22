// Pure helpers for placed document fields — NO server-only or browser-only
// imports, so this is safe in the placement editor, the signer page, and the
// server-side PDF assembly alike. Field geometry is stored in PDF points with a
// bottom-left origin (matching `signature_fields` and pdf-lib's coordinate
// system), so the same numbers flow straight from the editor into assembly.

// The field types a document can carry. `value` = the signer enters/produces a
// text value (stored on the field); signature fields instead render the
// signatory's captured signature. All four are allowed by the
// `signature_fields.field_type` check constraint.
export const FIELD_TYPES = {
  signature: { key: "signature", name: "Signature", w: 200, h: 56, value: false },
  text: { key: "text", name: "Text", w: 220, h: 26, value: true },
  date: { key: "date", name: "Date", w: 150, h: 24, value: true },
  initial: { key: "initial", name: "Initial", w: 90, h: 40, value: true },
};

// Palette shown in the placement editor. "Full name" is a convenience that
// drops a text field pre-labeled for the signer's name; it is still a `text`
// field in the database.
export const FIELD_PALETTE = [
  { key: "signature", type: "signature", name: "Signature", label: "Signature" },
  { key: "fullname", type: "text", name: "Full name", label: "Full name" },
  { key: "text", type: "text", name: "Text", label: "Text" },
  { key: "date", type: "date", name: "Date", label: "Date" },
  { key: "initial", type: "initial", name: "Initial", label: "Initial" },
];

export const FIELD_MIN = { w: 36, h: 14 };

export function defaultSize(type) {
  const t = FIELD_TYPES[type] || FIELD_TYPES.text;
  return { w: t.w, h: t.h };
}

export function isValueField(type) {
  return !!(FIELD_TYPES[type] && FIELD_TYPES[type].value);
}

// Does the signer actively fill this field, or is it derived/auto?
// Date fields are auto-filled with the signing date, server-side; the signer
// does not type them.
export function isSignerEntered(type) {
  return type === "text" || type === "initial";
}

// A text field whose label reads like a name — used to pre-fill the signer's
// known name as a convenience on the signing page.
export function looksLikeNameField(field) {
  return (
    field &&
    field.field_type === "text" &&
    /\b(full\s*name|name)\b/i.test(field.label || "")
  );
}

// Format a timestamp as a plain date for a "Date:" field, in Africa/Lagos and
// American English, e.g. "9 June 2026". (No time — a date line wants a date.)
export function formatSignDate(ts) {
  const d = ts ? (ts instanceof Date ? ts : new Date(ts)) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// Normalize/validate a field coming from the placement editor before it is
// persisted. Returns null if it is not usable. Clamps geometry to the page.
export function sanitizeField(raw, { pageSizes } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const type = FIELD_TYPES[raw.field_type] ? raw.field_type : null;
  if (!type) return null;
  const role = raw.role === "officer" ? "officer" : "client";
  const page = Math.max(1, parseInt(raw.page, 10) || 1);

  let pos_x = Number(raw.pos_x);
  let pos_y = Number(raw.pos_y);
  let width = Number(raw.width);
  let height = Number(raw.height);
  if (![pos_x, pos_y, width, height].every((n) => Number.isFinite(n))) return null;

  width = Math.max(FIELD_MIN.w, width);
  height = Math.max(FIELD_MIN.h, height);

  // Clamp inside the page if we know its size.
  const size = pageSizes && pageSizes[page - 1];
  if (size) {
    width = Math.min(width, size.w);
    height = Math.min(height, size.h);
    pos_x = Math.min(Math.max(0, pos_x), size.w - width);
    pos_y = Math.min(Math.max(0, pos_y), size.h - height);
  } else {
    pos_x = Math.max(0, pos_x);
    pos_y = Math.max(0, pos_y);
  }

  return {
    role,
    field_type: type,
    label: String(raw.label || FIELD_TYPES[type].name).slice(0, 120),
    required: raw.required !== false,
    page,
    pos_x,
    pos_y,
    width,
    height,
    sort_order: parseInt(raw.sort_order, 10) || 0,
  };
}
