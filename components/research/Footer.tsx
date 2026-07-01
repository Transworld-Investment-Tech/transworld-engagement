import { Phone, Globe } from 'lucide-react';
import { Wordmark } from './Wordmark';

export function Footer() {
  // The public research site chrome. Rendered only by the research (site)
  // layout, so it never appears on internal, admin, or print routes.
  return (
    <footer
      style={{ background: '#0A1F44', color: '#FAF7F2', marginTop: 80 }}
    >
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <Wordmark size="md" inverted />
          <p
            className="font-body text-sm mt-4"
            style={{ color: '#D4B570', lineHeight: 1.6, maxWidth: 280 }}
          >
            Positioning you ahead. Independent equity research and execution
            on the Nigerian Exchange.
          </p>
        </div>
        <div>
          <div
            className="font-body uppercase text-xs mb-4"
            style={{ color: '#D4B570', letterSpacing: '0.22em' }}
          >
            Contact
          </div>
          <div className="font-mono text-sm" style={{ opacity: 0.85 }}>
            <div className="flex items-center gap-2 mb-2">
              <Phone size={13} /> 09016723923 · 08077353777
            </div>
            <div className="flex items-center gap-2">
              <Globe size={13} /> www.transworldsecurities.com
            </div>
          </div>
        </div>
        <div>
          <div
            className="font-body uppercase text-xs mb-4"
            style={{ color: '#D4B570', letterSpacing: '0.22em' }}
          >
            Disclosure
          </div>
          <p
            className="font-body text-xs"
            style={{ opacity: 0.7, lineHeight: 1.6 }}
          >
            Research is provided for informational purposes and does not
            constitute investment advice. Past performance is not indicative
            of future results.
          </p>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(212,181,112,0.2)' }}>
        <div
          className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between font-mono text-xs gap-2"
          style={{ color: '#D4B570' }}
        >
          <div>
            © {new Date().getFullYear()} Transworld Investment &amp;
            Securities Limited
          </div>
          <div>RC 285743 · Member, Nigerian Exchange</div>
        </div>
      </div>
    </footer>
  );
}
