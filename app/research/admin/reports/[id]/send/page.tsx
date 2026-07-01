import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAdminReportById } from '@/lib/research/reports';
import { fetchActiveRecipients } from '@/lib/research/subscriptions';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { SendCampaignForm } from '@/components/research/admin/SendCampaignForm';

export const dynamic = 'force-dynamic';

interface PriorSend {
  contact_id: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

export default async function SendCampaignPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const data = await fetchAdminReportById(id);
  if (!data) notFound();

  // Only complete, published reports can be sent.
  if (data.report.status !== 'published') redirect(`/research/admin/reports/${id}/edit`);
  if (!data.metrics || !data.outlook) redirect(`/research/admin/reports/${id}/edit`);

  const recipients = await fetchActiveRecipients();

  const supabase = getSupabaseAdmin();
  const { data: priorData } = await supabase
    .from('send_log')
    .select('contact_id, status, sent_at, error_message')
    .eq('report_id', id);
  const priorSends = (priorData ?? []) as PriorSend[];

  return (
    <div>
      <Link
        href={`/research/admin/reports/${id}/edit`}
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Back to editor
      </Link>

      <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #E8DFD0' }}>
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            color: '#B08940',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Research · Send
        </div>
        <h1
          className="font-display mt-2"
          style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}
        >
          {data.report.headline}
        </h1>
        <p className="font-body mt-2" style={{ fontSize: 14, color: '#3A4A6B' }}>
          Emails the weekly report from investment@ to active subscribers. Only active
          subscribers are ever mailed; unsubscribes and bounces are skipped.
        </p>
      </div>

      <SendCampaignForm
        reportId={id}
        slug={data.report.slug}
        defaultSubject={data.report.headline}
        recipients={recipients}
        priorSends={priorSends}
      />
    </div>
  );
}
