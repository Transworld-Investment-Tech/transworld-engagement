import { z } from 'zod';

const ConfidenceEnum = z.enum(['high', 'medium', 'low']);

const MoverSchema = z.object({
  rank: z.number().int().min(1),
  company_name: z.string().min(1),
  open_price: z.number(),
  close_price: z.number(),
  change_pct: z.number(),
});

const RecSchema = z.object({
  company_name: z.string().min(1),
  note: z.string().nullable(),
});

const NewsItemSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const ParsedReportSchema = z.object({
  slug: z.string().min(1),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outlook_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outlook_period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  headline: z.string().min(1),

  metrics: z.object({
    asi_value: z.string(),
    asi_change_pct: z.number().nullable(),
    mcap_value: z.string(),
    mcap_change_pct: z.number().nullable(),
    volume_shares: z.string().nullable(),
    volume_change_pct: z.number().nullable(),
    value_traded: z.string().nullable(),
    value_change_pct: z.number().nullable(),
    deals: z.string().nullable(),
    deals_change_pct: z.number().nullable(),
  }),

  gainers: z.array(MoverSchema),
  decliners: z.array(MoverSchema),

  recommendations: z.object({
    buy: z.array(RecSchema),
    hold: z.array(RecSchema),
    sell: z.array(RecSchema),
  }),

  outlook: z.object({
    direction: z.string(),
    support: z.string().nullable(),
    resistance: z.string().nullable(),
    outperformers: z.array(z.string()),
    underperformers: z.array(z.string()),
    risks: z.array(z.string()),
    catalysts: z.array(z.string()),
  }),

  news: z.array(NewsItemSchema),

  confidence: z.object({
    metadata: ConfidenceEnum,
    metrics: ConfidenceEnum,
    gainers: ConfidenceEnum,
    decliners: ConfidenceEnum,
    recommendations: ConfidenceEnum,
    outlook: ConfidenceEnum,
    news: ConfidenceEnum,
  }),
});

export type ParsedReport = z.infer<typeof ParsedReportSchema>;
