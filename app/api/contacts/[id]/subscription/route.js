import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";

// Per-contact research subscription toggle (Phase 2a). DB only — no email.
// The research roster (app/research/admin/subscribers) is the primary place to
// manage subscribers; this endpoint backs the quick on/off switch on a single
// contact's record. Rules are kept identical to the roster's server actions:
//   subscribe  → upsert { status: 'active', tier, subscribed_by, unsubscribed_at: null }
//   unsubscribe→ soft: { status: 'unsubscribed', unsubscribed_at: now() }
// unsubscribe_token is never in the payload, so a re-subscribe keeps the same
// stable token. Research status is its own channel and never touches Greetings
// or Documents.

export async function GET(_req, { params }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("report_subscriptions")
    .select("tier, status, created_at")
    .eq("contact_id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data || null });
}

export async function PUT(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to manage subscriptions" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const action = body.action;
  const tier = body.tier === "Premium" ? "Premium" : "Standard";
  const supabase = getSupabase();

  if (action === "subscribe") {
    // Upsert also covers tier changes and re-subscribing.
    const { data, error } = await supabase
      .from("report_subscriptions")
      .upsert(
        {
          contact_id: params.id,
          tier,
          status: "active",
          subscribed_by: user.id,
          unsubscribed_at: null,
        },
        { onConflict: "contact_id" }
      )
      .select("tier, status, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data });
  }

  if (action === "unsubscribe") {
    const { data, error } = await supabase
      .from("report_subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("contact_id", params.id)
      .select("tier, status, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data || null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
