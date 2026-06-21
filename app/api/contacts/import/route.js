import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";

// Accepts YYYY-MM-DD or DD/MM/YYYY and returns a normalized ISO date, or null.
function parseDob(raw) {
  const v = (raw || "").trim();
  if (!v) return { value: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { value: v };
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    if (Number(mm) > 12 || Number(dd) > 31) return { error: "bad date" };
    return { value: `${m[3]}-${mm}-${dd}` };
  }
  return { error: "bad date" };
}

function pick(row, keys) {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k);
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

function normalizeRow(row) {
  const first_name = pick(row, ["first_name", "first name", "firstname"]);
  const last_name = pick(row, ["last_name", "last name", "lastname", "surname"]);
  const email = pick(row, ["email", "e-mail", "email address"]).toLowerCase() || null;
  const phone = pick(row, ["phone", "phone number", "mobile", "msisdn"]) || null;
  const title = pick(row, ["title", "salutation"]) || null;
  const dobRaw = pick(row, ["date_of_birth", "dob", "date of birth", "birthday"]);
  const tagsRaw = pick(row, ["tags", "segment", "category"]);

  const errors = [];
  if (!first_name) errors.push("missing first name");
  if (!last_name) errors.push("missing last name");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("invalid email");

  const dob = parseDob(dobRaw);
  if (dob.error) errors.push("invalid date of birth");

  const tags = tagsRaw
    ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    errors,
    value: {
      title,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth: dob.value || null,
      tags,
      status: "active",
    },
  };
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "You do not have permission to import contacts" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ error: "No rows found in the file" }, { status: 400 });
  }

  const valid = [];
  const invalid = [];
  rows.forEach((row, i) => {
    const { errors, value } = normalizeRow(row);
    if (errors.length) {
      invalid.push({ row: i + 2, reason: errors.join(", ") }); // +2: header + 1-index
    } else {
      valid.push(value);
    }
  });

  const supabase = getSupabase();

  // Split into update-by-email vs insert.
  const emails = valid.map((v) => v.email).filter(Boolean);
  let existingByEmail = new Map();
  if (emails.length) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id, email")
      .in("email", emails);
    (existing || []).forEach((c) => existingByEmail.set(c.email, c.id));
  }

  const toInsert = [];
  const toUpdate = [];
  for (const v of valid) {
    if (v.email && existingByEmail.has(v.email)) {
      toUpdate.push({ id: existingByEmail.get(v.email), value: v });
    } else {
      toInsert.push({ ...v, created_by: user.id });
    }
  }

  let created = 0;
  let updated = 0;
  const failures = [];

  if (toInsert.length) {
    const { data, error } = await supabase.from("contacts").insert(toInsert).select("id");
    if (error) failures.push(error.message);
    else created = data.length;
  }

  for (const u of toUpdate) {
    const { error } = await supabase.from("contacts").update(u.value).eq("id", u.id);
    if (error) failures.push(error.message);
    else updated += 1;
  }

  return NextResponse.json({
    created,
    updated,
    skipped: invalid.length,
    invalid: invalid.slice(0, 50),
    failures,
  });
}
