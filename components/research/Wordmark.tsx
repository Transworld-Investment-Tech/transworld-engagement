interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
}

export function Wordmark({ size = 'md', inverted = false }: WordmarkProps) {
  const px = size === 'lg' ? 22 : size === 'sm' ? 13 : 16;
  const color = inverted ? '#FAF7F2' : '#0A1F44';
  const goldish = inverted ? '#D4B570' : '#B08940';

  return (
    <div className="flex items-center gap-3" style={{ color }}>
      <svg
        width={px * 1.6}
        height={px * 1.6}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1.5" />
        <path
          d="M11 24 L20 11 L29 24 M14 20 L26 20"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="leading-none">
        <div
          className="font-display"
          style={{ fontSize: px, letterSpacing: '0.02em', fontWeight: 700 }}
        >
          TRANSWORLD
        </div>
        <div
          className="font-body"
          style={{
            fontSize: px * 0.45,
            letterSpacing: '0.32em',
            marginTop: 3,
            color: goldish,
          }}
        >
          INVESTMENT &amp; SECURITIES
        </div>
      </div>
    </div>
  );
}
