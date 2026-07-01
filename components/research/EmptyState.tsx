import { FileText } from 'lucide-react';

export function EmptyState() {
  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <FileText
          size={48}
          color="#B08940"
          style={{ margin: '0 auto 24px' }}
        />
        <h1
          className="font-display"
          style={{
            fontSize: 32,
            color: '#0A1F44',
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          No published reports yet.
        </h1>
        <p
          className="font-body"
          style={{ color: '#3A4A6B', lineHeight: 1.6 }}
        >
          Once the first weekly market report is published, it will appear
          here automatically.
        </p>
      </div>
    </main>
  );
}
