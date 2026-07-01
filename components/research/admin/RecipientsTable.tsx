'use client';

import { useMemo, useState } from 'react';
import type { CampaignRecipient } from '@/lib/research/analytics';

type Filter = 'all' | 'opened' | 'clicked' | 'didnt_open' | 'bounced' | 'failed';

function formatLagosShort(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
    hour12: false,
  }).format(new Date(iso));
}

export function RecipientsTable({ recipients }: { recipients: CampaignRecipient[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    let opened = 0;
    let clicked = 0;
    let didnt = 0;
    let bounced = 0;
    let failed = 0;
    for (const r of recipients) {
      if (r.opened_at) opened++;
      if (r.clicked_at) clicked++;
      if (r.bounced_at) bounced++;
      if (r.status === 'failed') failed++;
      if (!r.opened_at && !r.bounced_at && r.status !== 'failed') didnt++;
    }
    return { all: recipients.length, opened, clicked, didnt, bounced, failed };
  }, [recipients]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (filter === 'opened' && !r.opened_at) return false;
      if (filter === 'clicked' && !r.clicked_at) return false;
      if (filter === 'didnt_open' && (r.opened_at || r.bounced_at || r.status === 'failed')) return false;
      if (filter === 'bounced' && !r.bounced_at) return false;
      if (filter === 'failed' && r.status !== 'failed') return false;
      if (s && !`${r.contact_name} ${r.contact_email}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [recipients, filter, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip current={filter} value="all" onClick={setFilter}>
          All ({counts.all})
        </FilterChip>
        <FilterChip current={filter} value="opened" onClick={setFilter}>
          Opened ({counts.opened})
        </FilterChip>
        <FilterChip current={filter} value="clicked" onClick={setFilter}>
          Clicked ({counts.clicked})
        </FilterChip>
        <FilterChip current={filter} value="didnt_open" onClick={setFilter}>
          Didn&apos;t open ({counts.didnt})
        </FilterChip>
        <FilterChip current={filter} value="bounced" onClick={setFilter}>
          Bounced ({counts.bounced})
        </FilterChip>
        <FilterChip current={filter} value="failed" onClick={setFilter}>
          Failed ({counts.failed})
        </FilterChip>
        <input
          type="text"
          placeholder="Filter by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded font-body text-sm focus:outline-none"
          style={{ border: '1px solid #E8DFD0', background: '#FAF7F2', color: '#0A1F44' }}
        />
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E8DFD0', borderRadius: 4, overflow: 'hidden' }}>
        <div
          className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 font-body uppercase text-xs"
          style={{ color: '#3A4A6B', letterSpacing: '0.18em', borderBottom: '1px solid #E8DFD0' }}
        >
          <div className="col-span-4">Recipient</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Opened</div>
          <div className="col-span-2">Clicked</div>
          <div className="col-span-2">Note</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-8 text-center font-body text-sm" style={{ color: '#3A4A6B' }}>
            No recipients match this filter.
          </div>
        ) : (
          filtered.map((r, i) => (
            <div
              key={`${r.contact_id ?? 'x'}-${i}`}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center"
              style={{ borderTop: i === 0 ? 'none' : '1px solid #E8DFD0' }}
            >
              <div className="md:col-span-4">
                <div className="font-display text-sm" style={{ color: '#0A1F44', fontWeight: 600 }}>
                  {r.contact_name}
                </div>
                <div className="font-mono text-xs break-all" style={{ color: '#3A4A6B' }}>
                  {r.contact_email}
                </div>
              </div>
              <div className="md:col-span-2">
                <StatusPill r={r} />
              </div>
              <div className="md:col-span-2 font-mono text-xs" style={{ color: '#3A4A6B' }}>
                {formatLagosShort(r.opened_at)}
              </div>
              <div className="md:col-span-2 font-mono text-xs" style={{ color: '#3A4A6B' }}>
                {formatLagosShort(r.clicked_at)}
              </div>
              <div className="md:col-span-2 font-mono text-xs break-words" style={{ color: '#842029' }}>
                {r.error_message ?? ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  current,
  value,
  onClick,
  children,
}: {
  current: Filter;
  value: Filter;
  onClick: (v: Filter) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className="font-mono text-xs px-3 py-1.5 rounded transition"
      style={{
        border: `1px solid ${active ? '#0A1F44' : '#E8DFD0'}`,
        background: active ? '#0A1F44' : '#FAF7F2',
        color: active ? '#FAF7F2' : '#3A4A6B',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </button>
  );
}

function StatusPill({ r }: { r: CampaignRecipient }) {
  let label: string;
  let bg: string;
  let fg: string;
  if (r.bounced_at) {
    label = 'BOUNCED';
    bg = '#F8D7DA';
    fg = '#842029';
  } else if (r.status === 'failed') {
    label = 'FAILED';
    bg = '#F8D7DA';
    fg = '#842029';
  } else if (r.complained_at) {
    label = 'COMPLAINED';
    bg = '#F8D7DA';
    fg = '#842029';
  } else if (r.clicked_at) {
    label = 'CLICKED';
    bg = '#FFF3CD';
    fg = '#664D03';
  } else if (r.opened_at) {
    label = 'OPENED';
    bg = '#D1E7DD';
    fg = '#0F5132';
  } else if (r.delivered_at) {
    label = 'DELIVERED';
    bg = '#FAF7F2';
    fg = '#3A4A6B';
  } else {
    label = r.status.toUpperCase();
    bg = '#FAF7F2';
    fg = '#3A4A6B';
  }
  return (
    <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: bg, color: fg, letterSpacing: '0.1em' }}>
      {label}
    </span>
  );
}
