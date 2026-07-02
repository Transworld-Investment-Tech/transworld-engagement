import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listScheduledJobs } from '@/lib/research/jobs';
import { ScheduledJobsList } from '@/components/research/admin/ScheduledJobsList';

export const dynamic = 'force-dynamic';

// Access is enforced by the research admin layout (manager+); this page just
// reads the queue.
export default async function ScheduledSendsPage() {
  const jobs = await listScheduledJobs();

  return (
    <div>
      <Link
        href="/research/admin"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Research admin
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
          Research · Scheduled
        </div>
        <h1 className="font-display mt-2" style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}>
          Scheduled sends
        </h1>
        <p className="font-body mt-2" style={{ fontSize: 14, color: '#3A4A6B', maxWidth: 640, lineHeight: 1.6 }}>
          Broadcasts waiting to fire. Each goes out at its scheduled time to the recipients you
          picked, skipping anyone who has since unsubscribed or bounced. You can edit or cancel a
          send up until it starts.
        </p>
      </div>

      <ScheduledJobsList jobs={jobs} />
    </div>
  );
}
