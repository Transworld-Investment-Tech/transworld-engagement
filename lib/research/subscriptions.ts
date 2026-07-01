import { getSupabaseAdmin } from '@/lib/research/supabase';
import type { ClientTier, ClientStatus } from '@/lib/research/types';

/**
 * Read helpers for research subscriptions (Phase 2a).
 *
 * A research subscriber is a `contacts` row + a `report_subscriptions` row —
 * the portal's `clients` table was deliberately not recreated. `status` here is
 * research-only (active / pending / unsubscribed / bounced) and never affects
 * Greetings or Documents.
 *
 * These helpers only READ. Writes live in the server actions
 * (app/research/admin/subscribers/actions.ts) and the per-contact toggle route
 * (app/api/contacts/[id]/subscription/route.js). Following reports.ts, joins are
 * done as explicit follow-up queries + a Map stitch rather than PostgREST
 * embedding, so nothing depends on an auto-generated FK constraint name.
 */

/** A subscription joined to its contact and the staff member who subscribed it. */
export interface Subscriber {
  id: string;
  contact_id: string;
  tier: ClientTier;
  status: ClientStatus;
  unsubscribed_at: string | null;
  created_at: string;
  subscribed_by: string | null;
  // Resolved display fields:
  subscribed_by_name: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  contact_status: 'active' | 'inactive';
}

export interface SubscriberStats {
  total: number;
  active: number;
  pending: number;
  unsubscribed: number;
  bounced: number;
}

/** The subscription state of a single contact (for the per-record toggle). */
export interface ContactSubscription {
  tier: ClientTier;
  status: ClientStatus;
  subscribed_at: string;
}

interface SubRow {
  id: string;
  contact_id: string;
  tier: ClientTier;
  status: ClientStatus;
  unsubscribed_at: string | null;
  created_at: string;
  subscribed_by: string | null;
}

interface ContactRow {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  status: 'active' | 'inactive';
}

interface UserRow {
  id: string;
  name: string;
}

/** Every subscription, newest first, joined to contact + subscriber name. */
export async function fetchSubscribers(): Promise<Subscriber[]> {
  const supabase = getSupabaseAdmin();

  const subsRes = await supabase
    .from('report_subscriptions')
    .select(
      'id, contact_id, tier, status, unsubscribed_at, created_at, subscribed_by'
    )
    .order('created_at', { ascending: false });

  if (subsRes.error || !subsRes.data || subsRes.data.length === 0) return [];
  const subs = subsRes.data as SubRow[];

  const contactIds = Array.from(new Set(subs.map((s) => s.contact_id)));
  const userIds = Array.from(
    new Set(subs.map((s) => s.subscribed_by).filter((v): v is string => !!v))
  );

  const [contactsRes, usersRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, title, first_name, last_name, email, status')
      .in('id', contactIds),
    userIds.length
      ? supabase.from('app_users').select('id, name').in('id', userIds)
      : Promise.resolve({ data: [] as UserRow[], error: null }),
  ]);

  const contactMap = new Map<string, ContactRow>();
  for (const c of (contactsRes.data ?? []) as ContactRow[]) {
    contactMap.set(c.id, c);
  }
  const userMap = new Map<string, string>();
  for (const u of (usersRes.data ?? []) as UserRow[]) {
    userMap.set(u.id, u.name);
  }

  return subs.map((s) => {
    const c = contactMap.get(s.contact_id);
    return {
      id: s.id,
      contact_id: s.contact_id,
      tier: s.tier,
      status: s.status,
      unsubscribed_at: s.unsubscribed_at,
      created_at: s.created_at,
      subscribed_by: s.subscribed_by,
      subscribed_by_name: s.subscribed_by
        ? userMap.get(s.subscribed_by) ?? null
        : null,
      title: c?.title ?? null,
      first_name: c?.first_name ?? '(deleted contact)',
      last_name: c?.last_name ?? '',
      email: c?.email ?? null,
      contact_status: c?.status ?? 'inactive',
    };
  });
}

/** Roll a subscriber list up into per-status counts. */
export function computeStats(subs: Subscriber[]): SubscriberStats {
  const stats: SubscriberStats = {
    total: subs.length,
    active: 0,
    pending: 0,
    unsubscribed: 0,
    bounced: 0,
  };
  for (const s of subs) stats[s.status] += 1;
  return stats;
}

/** The set of contact ids that already have a subscription row (any status). */
export function subscribedContactIdSet(subs: Subscriber[]): Set<string> {
  return new Set(subs.map((s) => s.contact_id));
}

/** Lightweight active count for the dashboard stat card. */
export async function countActiveSubscribers(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('report_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) return 0;
  return count ?? 0;
}

/** A mailable active subscriber (for the send page's recipient list). */
export interface Recipient {
  contactId: string;
  name: string;
  email: string;
  tier: ClientTier;
}

/**
 * Active subscribers that can actually be emailed (non-null email), for the
 * campaign send page. Dispatch re-resolves recipients itself at send time, so
 * this is display/selection only.
 */
export async function fetchActiveRecipients(): Promise<Recipient[]> {
  const supabase = getSupabaseAdmin();

  const subsRes = await supabase
    .from('report_subscriptions')
    .select('contact_id, tier, status')
    .eq('status', 'active');
  if (subsRes.error || !subsRes.data || subsRes.data.length === 0) return [];
  const subs = subsRes.data as Array<{
    contact_id: string;
    tier: ClientTier;
  }>;

  const ids = subs.map((s) => s.contact_id);
  const contactsRes = await supabase
    .from('contacts')
    .select('id, title, first_name, last_name, email')
    .in('id', ids);

  const contactMap = new Map<string, ContactRow>();
  for (const c of (contactsRes.data ?? []) as ContactRow[]) {
    contactMap.set(c.id, c);
  }

  const out: Recipient[] = [];
  for (const s of subs) {
    const c = contactMap.get(s.contact_id);
    if (!c || !c.email) continue; // can't email without an address
    out.push({
      contactId: s.contact_id,
      name: [c.title, c.first_name, c.last_name].filter(Boolean).join(' '),
      email: c.email,
      tier: s.tier,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** One contact's subscription state, or null if never subscribed. */
export async function fetchContactSubscription(
  contactId: string
): Promise<ContactSubscription | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('report_subscriptions')
    .select('tier, status, created_at')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    tier: data.tier as ClientTier,
    status: data.status as ClientStatus,
    subscribed_at: data.created_at as string,
  };
}
