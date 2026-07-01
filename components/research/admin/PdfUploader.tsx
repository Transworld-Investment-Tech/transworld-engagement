'use client';

import { useState, useRef, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';

type UploadStatus = 'idle' | 'parsing' | 'error';

export function PdfUploader() {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('File must be a PDF.');
      setStatus('error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('PDF must be under 20 MB.');
      setStatus('error');
      return;
    }

    setError(null);
    setFilename(file.name);
    setStatus('parsing');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/research/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = (await res.json()) as {
        ok: boolean;
        reportId?: string;
        error?: string;
      };

      if (!res.ok || !result.ok) {
        setError(result.error ?? `Request failed (${res.status})`);
        setStatus('error');
        return;
      }

      router.push(`/research/admin/reports/${result.reportId}/edit`);
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Network error');
      setStatus('error');
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (status === 'parsing') return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClick = () => {
    if (status === 'parsing') return;
    inputRef.current?.click();
  };

  const handleReset = () => {
    setStatus('idle');
    setError(null);
    setFilename(null);
  };

  // ───────── Parsing state ─────────
  if (status === 'parsing') {
    return (
      <div
        className="p-8 text-center"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8DFD0',
          borderRadius: 4,
        }}
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: '#B08940', margin: '0 auto 16px' }}
        />
        <h3
          className="font-display"
          style={{ fontSize: 18, fontWeight: 600, color: '#0A1F44' }}
        >
          Reading the PDF
        </h3>
        <p
          className="font-body text-sm mt-2"
          style={{ color: '#3A4A6B' }}
        >
          {filename}
        </p>
        <div
          className="mt-4 font-mono text-xs"
          style={{ color: '#B08940', letterSpacing: '0.1em' }}
        >
          This usually takes 15–25 seconds.
        </div>
      </div>
    );
  }

  // ───────── Error state ─────────
  if (status === 'error') {
    return (
      <div
        className="p-6"
        style={{
          background: '#F8D7DA',
          border: '1px solid #f1aeb5',
          borderRadius: 4,
        }}
      >
        <div className="flex items-start gap-3">
          <AlertCircle size={18} style={{ color: '#842029', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <h3
              className="font-display"
              style={{ fontSize: 16, fontWeight: 600, color: '#842029' }}
            >
              Couldn&apos;t parse this PDF
            </h3>
            <p
              className="font-body text-sm mt-1"
              style={{ color: '#842029' }}
            >
              {error}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-full font-body text-sm transition hover:opacity-90"
                style={{ background: '#842029', color: '#FAF7F2' }}
              >
                Try a different PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────── Idle (drop zone) ─────────
  return (
    <div
      onClick={handleClick}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      className="p-10 text-center cursor-pointer transition"
      style={{
        background: isDragging ? 'rgba(176, 137, 64, 0.08)' : '#FFFFFF',
        border: `1px dashed ${isDragging ? '#B08940' : '#E8DFD0'}`,
        borderRadius: 4,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Upload
        size={28}
        style={{ color: '#B08940', margin: '0 auto 12px' }}
      />
      <h3
        className="font-display"
        style={{ fontSize: 18, fontWeight: 600, color: '#0A1F44' }}
      >
        Drop your weekly PDF here
      </h3>
      <p
        className="font-body text-sm mt-2"
        style={{ color: '#3A4A6B' }}
      >
        Or click to browse. Claude will extract the structured data into a
        new draft report.
      </p>
      <div
        className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs"
        style={{ color: '#3A4A6B' }}
      >
        <FileText size={11} />
        PDF · max 20 MB · ~15 seconds to parse
      </div>
    </div>
  );
}
