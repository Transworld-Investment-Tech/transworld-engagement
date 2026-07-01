import Anthropic from '@anthropic-ai/sdk';
import { ParsedReportSchema, type ParsedReport } from './schema';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an expert equity research data extractor specializing in NGX (Nigerian Exchange) weekly reports from Transworld Investment & Securities Limited.

You will receive a PDF of a weekly market report. Extract structured data and return ONLY valid JSON matching this schema:

{
  "slug": "YYYY-W##",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "outlook_period_start": "YYYY-MM-DD",
  "outlook_period_end": "YYYY-MM-DD",
  "headline": "string",
  "metrics": {
    "asi_value": "string with commas e.g. 242,277.81",
    "asi_change_pct": number or null,
    "mcap_value": "string with currency e.g. ₦155.99T",
    "mcap_change_pct": number or null,
    "volume_shares": "string e.g. 4.84B" or null,
    "volume_change_pct": number or null,
    "value_traded": "string e.g. ₦287.76B" or null,
    "value_change_pct": number or null,
    "deals": "string e.g. 332,453" or null,
    "deals_change_pct": number or null
  },
  "gainers": [{ "rank": 1, "company_name": "...", "open_price": 15.60, "close_price": 21.78, "change_pct": 39.62 }],
  "decliners": [{ "rank": 1, "company_name": "...", "open_price": 55.00, "close_price": 42.75, "change_pct": -22.27 }],
  "recommendations": {
    "buy": [{ "company_name": "...", "note": "..." or null }],
    "hold": [{ "company_name": "...", "note": "..." or null }],
    "sell": [{ "company_name": "...", "note": "..." or null }]
  },
  "outlook": {
    "direction": "string e.g. Bullish but volatile",
    "support": "string e.g. 235,000" or null,
    "resistance": "string e.g. 250,000" or null,
    "outperformers": ["string"],
    "underperformers": ["string"],
    "risks": ["string"],
    "catalysts": ["string"]
  },
  "news": [{ "title": "string", "body": "string" }],
  "confidence": {
    "metadata": "high" | "medium" | "low",
    "metrics": "high" | "medium" | "low",
    "gainers": "high" | "medium" | "low",
    "decliners": "high" | "medium" | "low",
    "recommendations": "high" | "medium" | "low",
    "outlook": "high" | "medium" | "low",
    "news": "high" | "medium" | "low"
  }
}

Critical instructions:

SLUG: Format YYYY-W## using the ISO week number of period_start. Examples: Apr 27–30, 2026 = "2026-W18". Apr 20–24, 2026 = "2026-W17". Apr 13–17, 2026 = "2026-W16".

DATES:
- period_start / period_end: the week being reported on (typically Mon–Fri of the closing week shown in "WHAT HAPPENED" or similar header).
- outlook_period_start / outlook_period_end: the next week's outlook period (the "WHAT'S AHEAD" or similar dates). If the next week contains a public holiday like 1 May Workers' Day, those dates may span only Mon–Thu — use what's stated.
- If outlook dates are not explicitly stated, compute them as the Mon–Fri immediately after period_end.

HEADLINE: Look for a clear editorial headline at the top of the report. If none is present, generate a concise one (max 12 words) that captures the week's core story (e.g. "Bullish breakout — ASI clears 242k as industrials and oil lead").

METRICS:
- asi_value: keep the original formatting with commas and decimals as shown ("242,277.81").
- mcap_value: preserve currency symbol from source ("₦155.99T", "₦155.99 Trillion" → "₦155.99T", standardize to T/B/M).
- All change_pct values are signed numbers without the % symbol. Negative for losses.
- If a metric is genuinely absent from the PDF, use null for change_pct and "" for the value string. Do not invent values.

GAINERS / DECLINERS:
- Extract the top 10 of each. If the PDF shows fewer (e.g. only top 5), return what's available.
- open_price and close_price are weekly OPEN and CLOSE numbers. If only % change is shown without prices, set both to 0 (the user will correct manually).
- change_pct: signed. Positive for gainers, negative for decliners.
- rank: 1-indexed in order of magnitude (rank 1 = biggest gainer/decliner).

RECOMMENDATIONS:
- Look for sections labeled "Stock Recommendations", "Top Stock Recommendations", "Our Stock Recommendations", "Stock Picks" — ANY headline that lists Buy / Hold / Sell columns.
- Notes are optional context like "Rights Issue Risk" or "High Dilution Risk". Use null if no note is present, never an empty string.

OUTLOOK:
- direction: short qualitative phrase from the "Market Direction" or similar field (e.g. "Bullish but volatile", "Cautiously bullish").
- support / resistance: index level strings, format as shown in source ("235,000"). Use null if absent.
- outperformers / underperformers: items from "Sectors to Watch" or similar.
- risks: items from "Key Risks" section.
- catalysts: items from "What Could Move The Market" or "Key Drivers" section.

NEWS:
- Each "Key Market News" item with title and brief body (1–2 sentences from the source).

CONFIDENCE: Rate each section honestly:
- "high": data was clearly present and unambiguous in the source.
- "medium": data was present but required interpretation, OR some fields within the section were missing.
- "low": data was largely missing or required heavy guessing/extrapolation.

Return ONLY the JSON object. No prose. No markdown code fences. No explanation. Start your response with { and end with }.`;

/**
 * Parse a PDF using Claude's PDF capabilities.
 * Returns validated structured data.
 */
export async function parseReportPdf(pdfBase64: string): Promise<ParsedReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract structured data from this weekly market report PDF. Return only the JSON object.',
            },
          ],
        },
      ],
    });
  } catch (err) {
    const e = err as Error;
    throw new Error(`Claude API call failed: ${e.message}`);
  }

  // Extract text content from response
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text.trim()) {
    throw new Error('Claude returned an empty response');
  }

  // Strip code fences if Claude added them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  // Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    const e = err as Error;
    // Log a snippet for debugging
    console.error(
      '[parser] Failed to parse Claude response as JSON. First 500 chars:',
      cleaned.slice(0, 500)
    );
    throw new Error(
      `Claude returned non-JSON response: ${e.message.split('\n')[0]}`
    );
  }

  // Validate against schema
  const result = ParsedReportSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error(
      '[parser] Schema validation failed:',
      result.error.issues.slice(0, 5)
    );
    const issuesSummary = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(
      `Parsed JSON didn't match expected schema. Issues: ${issuesSummary}`
    );
  }

  return result.data;
}
