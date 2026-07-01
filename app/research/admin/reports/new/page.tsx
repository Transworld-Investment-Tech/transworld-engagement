import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { CreateBlankDraftButton } from '@/components/research/admin/CreateBlankDraftButton';
import { PdfUploader } from '@/components/research/admin/PdfUploader';

export default function NewReportPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/research/admin/reports"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Back to reports
      </Link>

      <div className="mb-10">
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            color: '#B08940',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Research · New Report
        </div>
        <h1
          className="font-display mt-2"
          style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}
        >
          Start a new weekly report
        </h1>
        <p
          className="font-body mt-3"
          style={{ fontSize: 16, lineHeight: 1.6, color: '#3A4A6B', maxWidth: 540 }}
        >
          Upload your weekly PDF and Claude will extract the structured data into
          a new draft, ready for your review. Or start from a blank draft and
          fill it in manually.
        </p>
      </div>

      {/* Primary action: PDF upload */}
      <div className="mb-6">
        <PdfUploader />
      </div>

      {/* Secondary: blank draft */}
      <div
        className="p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'rgba(255,255,255,0.5)',
          border: '1px solid #E8DFD0',
          borderRadius: 4,
        }}
      >
        <div className="flex items-start gap-3">
          <FileText size={18} style={{ color: '#3A4A6B', marginTop: 2 }} />
          <div>
            <div className="font-display" style={{ fontSize: 16, color: '#0A1F44', fontWeight: 600 }}>
              No PDF? Start from scratch.
            </div>
            <div className="font-body text-sm" style={{ color: '#3A4A6B' }}>
              Create an empty draft and type everything in by hand.
            </div>
          </div>
        </div>
        <CreateBlankDraftButton />
      </div>
    </div>
  );
}
