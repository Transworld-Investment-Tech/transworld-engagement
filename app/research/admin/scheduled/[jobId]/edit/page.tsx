import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getJob } from '@/lib/research/jobs';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { fetchActiveRecipients } from '@/lib/research/subscriptions';
import { ScheduledJobEditForm } from '@/components/research/admin/ScheduledJobEditForm';

export const dynamic = 'force-dynamic';

// Access is enforced by the research admin layout (manager+). A job can only be
// edited while it is still `scheduled`; anything else bounces back to the list.
export default async function EditScheduledSendPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { jobId } = params;
  const job = await getJob(jobId);
  if (!job) notFound();
  if (job.status !== 'scheduled') redirect('/research/admin/scheduled');

  const supabase = getSupabaseAdmin();
  const { data: report } = await supabase
    .from('reports')
    .select('id, slug, headline, status')
    .eq('id', job.report_id)
    .maybeSingle();
  if (!report) notFound();

  const recipients = await fetchActiveRecipients();

  return (
    <div>
      <Link
        href="/research/admin/scheduled"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Scheduled sends
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
          Research · Edit scheduled send
        </div>
        <h1 className="font-display mt-2" style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}>
          {report.headline as string}
        </h1>
        <p className="font-body mt-2" style={{ fontSize: 14, color: '#3A4A6B' }}>
          Change the time, subject, or recipients before this send fires. Recipients who have since
          unsubscribed or bounced no longer appear and won&apos;t be mailed.
        </p>
      </div>

      <ScheduledJobEditForm
        jobId={job.id}
        slug={report.slug as string}
        initialSubject={job.subject}
        initialScheduledForIso={job.scheduled_for}
        recipients={recipients}
        initialSelectedIds={job.selected_contact_ids}
      />
    </div>
  );
}
