'use client';

import { useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createBlankDraftAction } from '@/app/research/admin/reports/actions';

export function CreateBlankDraftButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await createBlankDraftAction();
        })
      }
      className="px-4 py-2 rounded-full font-body text-sm flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
      style={{ background: '#0A1F44', color: '#FAF7F2', fontWeight: 500 }}
    >
      <Plus size={14} />
      {pending ? 'Creating…' : 'New blank draft'}
    </button>
  );
}
