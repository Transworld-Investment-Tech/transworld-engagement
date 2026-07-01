'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';

interface Props {
  token: string;
  subscriberName: string;
  subscriberEmail: string;
}

export function UnsubscribeConfirm({ token, subscriberName, subscriberEmail }: Props) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleUnsubscribe = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/research/unsubscribe?token=${encodeURIComponent(token)}`,
          { method: 'POST' }
        );
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setError(result.error ?? 'Failed to unsubscribe');
          return;
        }
        setDone(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8DFD0',
    borderRadius: 4,
  } as const;

  if (done) {
    return (
      <div className="p-8" style={cardStyle}>
        <Check size={40} color="#0F5132" style={{ marginBottom: 16 }} />
        <h1
          className="font-display"
          style={{ fontSize: 24, fontWeight: 600, color: '#0A1F44', lineHeight: 1.2 }}
        >
          You&apos;ve been unsubscribed.
        </h1>
        <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
          <strong>{subscriberEmail}</strong> has been removed from the Transworld Investment &amp;
          Securities weekly research distribution list.
        </p>
        <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
          If this was a mistake or you change your mind, contact{' '}
          <a href="mailto:investment@transworldltd.com.ng" style={{ color: '#B08940' }}>
            investment@transworldltd.com.ng
          </a>{' '}
          and we&apos;ll add you back.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8" style={cardStyle}>
      <h1
        className="font-display"
        style={{ fontSize: 24, fontWeight: 600, color: '#0A1F44', lineHeight: 1.2 }}
      >
        Unsubscribe from weekly reports?
      </h1>
      <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
        We&apos;ll stop sending Transworld Investment &amp; Securities weekly market reports to{' '}
        <strong>{subscriberEmail}</strong>
        {subscriberName && ` (${subscriberName})`}. This only affects research — it won&apos;t
        change any other messages you receive from us.
      </p>

      {error && (
        <div
          className="mt-4 p-3 rounded font-body text-sm"
          style={{ background: '#F8D7DA', color: '#842029', border: '1px solid #f1aeb5' }}
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={pending}
          className="flex-1 px-4 py-3 rounded-full font-body text-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: '#842029', color: '#FAF7F2', fontWeight: 500 }}
        >
          {pending ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
        </button>
        <a
          href="/research"
          className="flex-1 px-4 py-3 rounded-full font-body text-sm transition hover:bg-stone-50 text-center"
          style={{
            border: '1px solid #E8DFD0',
            color: '#0A1F44',
            background: '#FFFFFF',
            textDecoration: 'none',
          }}
        >
          Cancel — keep me subscribed
        </a>
      </div>
    </div>
  );
}
