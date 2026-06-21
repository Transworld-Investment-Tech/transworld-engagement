export default function Wordmark({ className = "", subtitle = true }) {
  return (
    <div className={className}>
      <div className="font-serif text-lg leading-none tracking-tight text-white">
        Transworld<span className="text-gold">.</span>
      </div>
      {subtitle && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-navy-200">
          Client Engagement
        </div>
      )}
    </div>
  );
}
