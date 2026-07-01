import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getResearchUser } from '@/lib/research/auth';
import {
  fetchSubscribers,
  computeStats,
  subscribedContactIdSet,
} from '@/lib/research/subscriptions';
import { SubscribersManager } from '@/components/research/admin/SubscribersManager';

export const dynamic = 'force-dynamic';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';

export default async function SubscribersPage() {
  const user = await getResearchUser();
  const canDelete = user?.role === 'admin';

  const subscribers = await fetchSubscribers();
  const stats = computeStats(subscribers);
  const subscribedIds = Array.from(subscribedContactIdSet(subscribers));

  return (
    <div>
      <Link
        href="/research/admin"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: MUTED, textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Back to dashboard
      </Link>

      <div
        className="mb-8 pb-6"
        style={{ borderBottom: `1px solid ${LINE}` }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            color: GOLD,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Research · Audience
        </div>
        <h1
          className="font-display mt-2"
          style={{ fontSize: 34, color: INK, fontWeight: 600 }}
        >
          Subscribers
        </h1>
        <p
          className="font-body mt-2"
          style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, maxWidth: 620 }}
        >
          Everyone here receives the weekly research report. Subscription is its
          own channel — adding or removing a client here does not touch their
          birthday greetings or signing links, and the reverse holds too.
          Subscribing is a deliberate opt-in; there is no bulk “subscribe
          everyone.”
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat label="Active" value={stats.active} tone="active" />
        <Stat label="Pending" value={stats.pending} tone="pending" />
        <Stat label="Unsubscribed" value={stats.unsubscribed} tone="muted" />
        <Stat label="Bounced" value={stats.bounced} tone="bounced" />
      </div>

      <SubscribersManager
        subscribers={subscribers}
        subscribedIds={subscribedIds}
        canDelete={canDelete}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'active' | 'pending' | 'muted' | 'bounced';
}) {
  const color =
    tone === 'active'
      ? '#0F5132'
      : tone === 'bounced'
      ? '#842029'
      : tone === 'pending'
      ? '#664D03'
      : MUTED;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: '16px 18px',
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: GOLD,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className="font-display num mt-2"
        style={{ fontSize: 30, color, fontWeight: 600, lineHeight: 1 }}
      >
        {value}
      </div>
    </div>
  );
}
