'use server';

import { revalidatePath } from 'next/cache';
import { requireResearchManager } from '@/lib/research/auth';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { getCurrentUser, hasRole } from '@/lib/session';
import type { ClientTier } from '@/lib/research/types';

// Subscription writes (Phase 2a). DB + UI only — no email is sent here. Rules
// kept deliberately identical to the per-contact toggle route
// (app/api/contacts/[id]/subscription/route.js) so the two entry points behave
// the same:
//   subscribe  → upsert { status: 'active', tier, subscribed_by, unsubscribed_at: null }
//   unsubscribe→ soft: { status: 'unsubscribed', unsubscribed_at: now() } (row kept)
//   remove     → hard delete (admin only; matches the app's "admin can delete" rule)
// unsubscribe_token is never included in an upsert payload, so re-subscribing a
// contact preserves its stable one-click-unsubscribe token.

export interface ActionResult {
  ok: boolean;
  error: string | null;
  count?: number;
  contactId?: string;
}

function normalizeTier(input: unknown): ClientTier {
  return input === 'Premium' ? 'Premium' : 'Standard';
}

function revalidate(): void {
  revalidatePath('/research/admin/subscribers');
  revalidatePath('/research/admin');
}

/** Subscribe one or more existing contacts. Upsert = safe to re-run / re-subscribe. */
export async function subscribeContactsAction(
  contactIds: string[],
  tier: unknown
): Promise<ActionResult> {
  let userId: string;
  try {
    ({ userId } = await requireResearchManager());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const ids = Array.from(new Set((contactIds ?? []).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: 'No contacts selected.' };

  const supabase = getSupabaseAdmin();
  const rows = ids.map((contact_id) => ({
    contact_id,
    tier: normalizeTier(tier),
    status: 'active' as const,
    subscribed_by: userId,
    unsubscribed_at: null,
  }));

  const { error } = await supabase
    .from('report_subscriptions')
    .upsert(rows, { onConflict: 'contact_id' });

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true, error: null, count: ids.length };
}

/** Change a subscriber's tier. */
export async function setTierAction(
  contactId: string,
  tier: unknown
): Promise<ActionResult> {
  try {
    await requireResearchManager();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('report_subscriptions')
    .update({ tier: normalizeTier(tier) })
    .eq('contact_id', contactId);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

/** Soft unsubscribe — keeps the row (and its history) for the audit trail. */
export async function unsubscribeContactAction(
  contactId: string
): Promise<ActionResult> {
  try {
    await requireResearchManager();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('report_subscriptions')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('contact_id', contactId);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

/** Re-activate a previously unsubscribed (or bounced) subscriber. */
export async function resubscribeContactAction(
  contactId: string
): Promise<ActionResult> {
  let userId: string;
  try {
    ({ userId } = await requireResearchManager());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('report_subscriptions')
    .update({
      status: 'active',
      unsubscribed_at: null,
      subscribed_by: userId,
    })
    .eq('contact_id', contactId);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

/** Hard-remove a subscription row entirely. Admin only (delete = admin). */
export async function removeSubscriptionAction(
  contactId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  if (!hasRole(user, 'admin')) {
    return { ok: false, error: 'Only an admin can remove a subscription.' };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('report_subscriptions')
    .delete()
    .eq('contact_id', contactId);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

export interface NewContactInput {
  title?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  tags?: string;
}

/**
 * Add a person who isn't in Contacts yet, then subscribe them — every
 * subscriber is a contact. If the email already belongs to a contact, we
 * subscribe that existing contact instead of creating a duplicate (single
 * source of truth over convenience).
 */
export async function createContactAndSubscribeAction(
  input: NewContactInput,
  tier: unknown
): Promise<ActionResult> {
  let userId: string;
  try {
    ({ userId } = await requireResearchManager());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const first_name = (input.first_name ?? '').trim();
  const last_name = (input.last_name ?? '').trim();
  if (!first_name) return { ok: false, error: 'First name is required.' };
  if (!last_name) return { ok: false, error: 'Last name is required.' };

  const email = ((input.email ?? '').trim().toLowerCase() || null) as
    | string
    | null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Email is not valid.' };
  }

  const dob = (input.date_of_birth ?? '').trim() || null;
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return { ok: false, error: 'Date of birth must be YYYY-MM-DD.' };
  }

  const tags = (input.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = getSupabaseAdmin();

  // Reuse an existing contact if this email already matches one — no duplicates.
  let contactId: string | null = null;
  if (email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existing) contactId = existing.id as string;
  }

  if (!contactId) {
    const { data: created, error: insErr } = await supabase
      .from('contacts')
      .insert({
        title: (input.title ?? '').trim() || null,
        first_name,
        last_name,
        email,
        phone: (input.phone ?? '').trim() || null,
        date_of_birth: dob,
        status: 'active',
        tags,
        notes: null,
        created_by: userId,
      })
      .select('id')
      .single();
    if (insErr || !created) {
      return { ok: false, error: `Could not add contact: ${insErr?.message ?? 'unknown'}` };
    }
    contactId = created.id as string;
  }

  const { error: subErr } = await supabase
    .from('report_subscriptions')
    .upsert(
      {
        contact_id: contactId,
        tier: normalizeTier(tier),
        status: 'active' as const,
        subscribed_by: userId,
        unsubscribed_at: null,
      },
      { onConflict: 'contact_id' }
    );
  if (subErr) return { ok: false, error: subErr.message };

  revalidate();
  return { ok: true, error: null, contactId };
}
