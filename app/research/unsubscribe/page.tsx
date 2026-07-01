import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { UnsubscribeConfirm } from '@/components/research/UnsubscribeConfirm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
}

async function lookupSubscriber(token: string | undefined) {
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: sub } = await supabase
    .from('report_subscriptions')
    .select('contact_id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle();
  if (!sub) return null;

  const { data: contact } = await supabase
    .from('contacts')
    .select('title, first_name, last_name, email')
    .eq('id', sub.contact_id)
    .maybeSingle();

  const name = contact
    ? [contact.title, contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : '';
  return { status: sub.status as string, name, email: (contact?.email as string) ?? '' };
}

export default async function ResearchUnsubscribePage({ searchParams }: PageProps) {
  const token = searchParams.token;
  const subscriber = await lookupSubscriber(token);

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8DFD0',
    borderRadius: 4,
  } as const;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: '#FAF7F2' }}
    >
      <div className="max-w-md w-full">
        <Link
          href="/research"
          className="inline-block mb-8 font-mono text-xs"
          style={{ color: '#B08940', letterSpacing: '0.22em', textDecoration: 'none' }}
        >
          TRANSWORLD INVESTMENT &amp; SECURITIES
        </Link>

        {!token || !subscriber ? (
          <div className="p-8" style={cardStyle}>
            <h1
              className="font-display"
              style={{ fontSize: 24, fontWeight: 600, color: '#0A1F44', lineHeight: 1.2 }}
            >
              Link not recognized
            </h1>
            <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
              The unsubscribe link you used isn&apos;t recognized. It may have expired, or the
              subscription may already have been removed. If you&apos;re still receiving emails and
              want to be removed, contact us directly.
            </p>
            <a
              href="mailto:investment@transworldltd.com.ng?subject=Unsubscribe"
              className="mt-5 inline-block font-mono text-xs underline"
              style={{ color: '#B08940' }}
            >
              investment@transworldltd.com.ng
            </a>
          </div>
        ) : subscriber.status === 'unsubscribed' ? (
          <div className="p-8" style={cardStyle}>
            <h1
              className="font-display"
              style={{ fontSize: 24, fontWeight: 600, color: '#0A1F44', lineHeight: 1.2 }}
            >
              You&apos;re already unsubscribed.
            </h1>
            <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
              <strong>{subscriber.email}</strong> is no longer on the weekly research distribution
              list. You won&apos;t receive any further reports.
            </p>
            <p className="font-body mt-3 text-sm" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
              To be re-added in the future, contact us at{' '}
              <a href="mailto:investment@transworldltd.com.ng" style={{ color: '#B08940' }}>
                investment@transworldltd.com.ng
              </a>
              .
            </p>
          </div>
        ) : (
          <UnsubscribeConfirm
            token={token}
            subscriberName={subscriber.name}
            subscriberEmail={subscriber.email}
          />
        )}
      </div>
    </main>
  );
}
