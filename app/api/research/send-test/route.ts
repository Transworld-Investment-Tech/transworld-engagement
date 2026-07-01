import { NextResponse } from 'next/server';
import { getCurrentUser, hasRole } from '@/lib/session';
import { fetchAdminReportById } from '@/lib/research/reports';
import { renderReportEmail } from '@/lib/research/email/render';
import { sendOne } from '@/lib/research/email/resend';
import {
  buildReportUrl,
  buildUnsubscribeUrl,
  buildListUnsubscribeHeader,
} from '@/lib/research/email/tokens';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Send the rendered report email to the signed-in staff member only. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!hasRole(user, 'manager')) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }
  if (!user.email) {
    return NextResponse.json(
      { ok: false, error: 'Your account has no email address on file.' },
      { status: 400 }
    );
  }

  let body: { reportId?: string; subject?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reportId, subject } = body;
  if (!reportId || !subject) {
    return NextResponse.json(
      { ok: false, error: 'reportId and subject are required' },
      { status: 400 }
    );
  }

  const adminReport = await fetchAdminReportById(reportId);
  if (!adminReport) {
    return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });
  }
  if (!adminReport.metrics || !adminReport.outlook) {
    return NextResponse.json(
      { ok: false, error: 'Report is missing required sections (metrics, outlook).' },
      { status: 400 }
    );
  }

  const fullReport = {
    report: adminReport.report,
    metrics: adminReport.metrics,
    gainers: adminReport.gainers,
    decliners: adminReport.decliners,
    recommendations: adminReport.recommendations,
    outlook: adminReport.outlook,
    news: adminReport.news,
  };

  // Dummy token for the test so the footer link renders without being live.
  const dummyToken = 'test-send-dummy-token';
  const portalUrl = buildReportUrl(adminReport.report.slug);
  const unsubscribeUrl = buildUnsubscribeUrl(dummyToken);

  let html: string;
  let text: string;
  try {
    const rendered = await renderReportEmail({
      report: fullReport,
      portalUrl,
      unsubscribeUrl,
      preheader: `[TEST] ${adminReport.report.headline}`,
    });
    html = rendered.html;
    text = rendered.text;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Render failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const result = await sendOne({
    to: user.email as string,
    subject: `[TEST] ${subject}`,
    html,
    text,
    listUnsubscribeHeader: buildListUnsubscribeHeader(dummyToken),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: user.email, resendId: result.resendId });
}
