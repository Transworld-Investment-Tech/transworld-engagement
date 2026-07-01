import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listCampaigns, getListHealth, getTrendData } from '@/lib/research/analytics';
import { CampaignsTable } from '@/components/research/admin/CampaignsTable';
import { TrendsChart } from '@/components/research/admin/TrendsChart';
import { HealthCards } from '@/components/research/admin/HealthCards';

export const dynamic = 'force-dynamic';

type TabKey = 'campaigns' | 'trends' | 'health';

export default async function ResearchAnalyticsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab: TabKey =
    searchParams.tab === 'trends' || searchParams.tab === 'health'
      ? searchParams.tab
      : 'campaigns';

  const [campaigns, health, trend] = await Promise.all([
    listCampaigns(),
    getListHealth(),
    getTrendData(12),
  ]);

  return (
    <div>
      <Link
        href="/research/admin"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Research dashboard
      </Link>

      <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #E8DFD0' }}>
        <div
          className="font-mono"
          style={{ fontSize: 11, color: '#B08940', letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          Research · Analytics
        </div>
        <h1 className="font-display mt-2" style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}>
          Email performance
        </h1>
        <p className="font-body mt-2" style={{ fontSize: 14, color: '#3A4A6B' }}>
          Per-campaign delivery, open and click rates. Updated as Resend webhooks arrive.
        </p>
      </div>

      <div className="flex gap-6 mb-8" style={{ borderBottom: '1px solid #E8DFD0' }}>
        <Tab href="/research/admin/analytics?tab=campaigns" active={tab === 'campaigns'}>
          Campaigns ({campaigns.length})
        </Tab>
        <Tab href="/research/admin/analytics?tab=trends" active={tab === 'trends'}>
          Trends
        </Tab>
        <Tab href="/research/admin/analytics?tab=health" active={tab === 'health'}>
          List health
        </Tab>
      </div>

      {tab === 'campaigns' && <CampaignsTable campaigns={campaigns} />}
      {tab === 'trends' && <TrendsChart data={trend} />}
      {tab === 'health' && <HealthCards health={health} />}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="pb-3 -mb-px font-body uppercase text-xs transition"
      style={{
        color: active ? '#0A1F44' : '#3A4A6B',
        borderBottom: `2px solid ${active ? '#0A1F44' : 'transparent'}`,
        letterSpacing: '0.18em',
        fontWeight: active ? 600 : 400,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}
