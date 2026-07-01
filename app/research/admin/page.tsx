import Link from 'next/link';
import {
  FileText,
  Pencil,
  Users,
  Send,
  Plus,
  ArrowRight,
  CalendarClock,
  BarChart3,
} from 'lucide-react';
import { fetchAdminReportSummaries } from '@/lib/research/reports';

export const dynamic = 'force-dynamic';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';
const CARD = '#FFFFFF';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

export default async function ResearchDashboardPage() {
  const summaries = await fetchAdminReportSummaries();
  const published = summaries.filter((s) => s.report.status === 'published');
  const drafts = summaries.filter((s) => s.report.status === 'draft');

  const latest = [...published].sort((a, b) => {
    const ax = new Date(a.report.published_at ?? a.report.updated_at).getTime();
    const bx = new Date(b.report.published_at ?? b.report.updated_at).getTime();
    return bx - ax;
  })[0];

  return (
    <div>
      {/* Masthead */}
      <div className="mb-10">
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            color: GOLD,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Research · Dashboard
        </div>
        <h1
          className="font-display mt-2"
          style={{ fontSize: 40, lineHeight: 1.05, color: INK, fontWeight: 600 }}
        >
          Welcome back.
        </h1>
        <p
          className="font-body mt-3"
          style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, maxWidth: 560 }}
        >
          The state of the research desk. Create, edit, and publish the weekly NGX
          market report — sending to subscribers arrives in Phase&nbsp;2.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <StatCard
          label="Published reports"
          value={String(published.length)}
          sub={latest ? `Latest: ${latest.report.slug}` : 'None yet'}
          icon={<FileText size={16} />}
        />
        <StatCard
          label="Drafts"
          value={String(drafts.length)}
          sub={drafts.length === 1 ? '1 in progress' : `${drafts.length} in progress`}
          icon={<Pencil size={16} />}
        />
        <StatCard
          label="Subscribers"
          value="—"
          sub="Coming in Phase 2"
          icon={<Users size={16} />}
          soon
        />
        <StatCard
          label="Last campaign"
          value="—"
          sub="Coming in Phase 2"
          icon={<Send size={16} />}
          soon
        />
      </div>

      {/* Quick actions */}
      <h2
        className="font-display mb-4"
        style={{ fontSize: 22, color: INK, fontWeight: 600 }}
      >
        Quick actions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionCard
          href="/research/admin/reports/new"
          title="Add new report"
          desc="Upload a PDF to auto-fill, or start a blank draft."
          icon={<Plus size={18} />}
        />
        <ActionCard
          href="/research/admin/reports"
          title="Manage reports"
          desc="Edit drafts, preview, publish, and archive."
          icon={<ArrowRight size={18} />}
        />
        <ActionCard
          title="Manage subscribers"
          desc="Reader list and CSV import."
          icon={<Users size={18} />}
          soon
        />
        <ActionCard
          title="Scheduled sends"
          desc="Queue, edit, or cancel campaigns waiting to fire."
          icon={<CalendarClock size={18} />}
          soon
        />
        <ActionCard
          title="Email analytics"
          desc="Open rates, click rates, and list health."
          icon={<BarChart3 size={18} />}
          soon
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  soon = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  soon?: boolean;
}) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: '18px 20px',
        opacity: soon ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: GOLD,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span style={{ color: GOLD }}>{icon}</span>
      </div>
      <div
        className="font-display num mt-2"
        style={{ fontSize: 34, color: INK, fontWeight: 600, lineHeight: 1 }}
      >
        {value}
      </div>
      <div
        className="font-mono mt-2"
        style={{ fontSize: 11, color: MUTED, letterSpacing: '0.04em' }}
      >
        {sub}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  desc,
  icon,
  soon = false,
}: {
  href?: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  soon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className="font-display"
          style={{ fontSize: 18, color: INK, fontWeight: 600 }}
        >
          {title}
        </div>
        <span style={{ color: soon ? MUTED : INK, flexShrink: 0 }}>{icon}</span>
      </div>
      <div
        className="font-body mt-1.5"
        style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}
      >
        {desc}
      </div>
      {soon && (
        <span
          className="font-mono inline-block mt-3"
          style={{
            fontSize: 9,
            color: MUTED,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: '#EFEAE0',
            borderRadius: 3,
            padding: '3px 7px',
          }}
        >
          Coming in Phase 2
        </span>
      )}
    </>
  );

  const boxStyle: React.CSSProperties = {
    background: CARD,
    border: `1px solid ${LINE}`,
    borderRadius: 4,
    padding: '20px',
    display: 'block',
    opacity: soon ? 0.55 : 1,
  };

  if (soon || !href) {
    return <div style={{ ...boxStyle, cursor: 'default' }}>{inner}</div>;
  }
  return (
    <Link
      href={href}
      className="transition hover:shadow-sm"
      style={{ ...boxStyle, textDecoration: 'none' }}
    >
      {inner}
    </Link>
  );
}
