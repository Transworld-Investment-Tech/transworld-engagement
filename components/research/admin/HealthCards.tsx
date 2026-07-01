import type { ListHealth } from '@/lib/research/analytics';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function HealthCards({ health }: { health: ListHealth }) {
  const totalList =
    health.total_active + health.total_pending + health.total_unsubscribed + health.total_bounced;

  return (
    <div className="space-y-8">
      <section>
        <div className="font-body uppercase text-xs mb-3" style={{ color: '#B08940', letterSpacing: '0.22em' }}>
          List composition · {totalList} total
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Active" value={health.total_active} accent="#0F5132" />
          <Card label="Pending" value={health.total_pending} accent="#664D03" />
          <Card label="Unsubscribed" value={health.total_unsubscribed} accent="#3A4A6B" />
          <Card label="Bounced" value={health.total_bounced} accent="#842029" />
        </div>
      </section>

      <section>
        <div className="font-body uppercase text-xs mb-3" style={{ color: '#B08940', letterSpacing: '0.22em' }}>
          Last 30 days · {health.campaigns_30d} campaign{health.campaigns_30d === 1 ? '' : 's'}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Open rate" value={pct(health.open_rate_30d)} accent="#0A1F44" />
          <Card label="Click rate" value={pct(health.click_rate_30d)} accent="#B08940" />
          <Card label="Bounce rate" value={pct(health.bounce_rate_30d)} accent="#842029" />
          <Card label="Unsubscribe rate" value={pct(health.unsubscribe_rate_30d)} accent="#3A4A6B" />
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="p-5" style={{ background: '#FFFFFF', border: '1px solid #E8DFD0', borderRadius: 4 }}>
      <div className="font-body uppercase text-xs mb-2" style={{ color: accent, letterSpacing: '0.18em' }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 32, fontWeight: 600, color: '#0A1F44', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}
