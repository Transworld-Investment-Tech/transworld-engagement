import { fetchAdminReportSummaries } from '@/lib/research/reports';
import { ReportsTable } from '@/components/research/admin/ReportsTable';
import { CreateBlankDraftButton } from '@/components/research/admin/CreateBlankDraftButton';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const summaries = await fetchAdminReportSummaries();

  return (
    <div>
      <div
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 pb-6"
        style={{ borderBottom: '1px solid #E8DFD0' }}
      >
        <div>
          <div className="eyebrow">Research · Content</div>
          <h1 className="mt-1 font-serif text-3xl text-navy">Weekly reports</h1>
          <p className="mt-2 text-sm text-muted">
            Drafts are not visible on the public research site until published.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateBlankDraftButton />
        </div>
      </div>

      <ReportsTable summaries={summaries} />
    </div>
  );
}
