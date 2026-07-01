import { render } from '@react-email/render';
import { ReportEmail } from './template';
import type { FullReport } from '@/lib/research/types';

interface RenderArgs {
  report: FullReport;
  portalUrl: string;
  unsubscribeUrl: string;
  preheader?: string;
}

/**
 * Renders the report email to HTML + plain-text strings.
 *
 * NOTE: when sending to many recipients, render once with a placeholder
 * (e.g. {{UNSUBSCRIBE_URL}}) then string-replace per client. Direct rendering
 * per recipient is fine for tests and small batches.
 */
export async function renderReportEmail(args: RenderArgs): Promise<{
  html: string;
  text: string;
}> {
  const element = (
    <ReportEmail
      report={args.report}
      portalUrl={args.portalUrl}
      unsubscribeUrl={args.unsubscribeUrl}
      preheader={args.preheader}
    />
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
