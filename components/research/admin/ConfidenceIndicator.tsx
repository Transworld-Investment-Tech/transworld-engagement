import type { ConfidenceLevel } from '@/lib/research/types';

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel | null | undefined;
}

const config: Record<
  ConfidenceLevel,
  { color: string; bg: string; label: string; tooltip: string }
> = {
  high: {
    color: '#0F5132',
    bg: 'rgba(15, 81, 50, 0.08)',
    label: 'high confidence',
    tooltip: 'Claude extracted this section cleanly. Quick scan recommended.',
  },
  medium: {
    color: '#B08940',
    bg: 'rgba(176, 137, 64, 0.1)',
    label: 'verify',
    tooltip:
      "Claude extracted this section but some fields were ambiguous. Verify before publishing.",
  },
  low: {
    color: '#842029',
    bg: 'rgba(132, 32, 41, 0.08)',
    label: 'review carefully',
    tooltip:
      "Claude couldn't extract this section reliably. Review every field carefully.",
  },
};

export function ConfidenceIndicator({ level }: ConfidenceIndicatorProps) {
  if (!level) return null;

  const c = config[level];

  return (
    <span
      title={c.tooltip}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-xs"
      style={{
        background: c.bg,
        color: c.color,
        letterSpacing: '0.05em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.color,
          display: 'inline-block',
        }}
      />
      {c.label}
    </span>
  );
}
