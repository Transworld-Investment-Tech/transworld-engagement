-- ============================================================================
-- Transworld Client Engagement — v1.8 migration: research module (Phase 0)
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Brings the (retired) Research Portal's data model into the Engagement
-- project. The whole point of the merge is ONE client directory, so:
--   • the portal's `clients` table is NOT recreated — a research subscriber is
--     just a `contacts` row with a thin `report_subscriptions` record;
--   • the portal's `admins` table is NOT recreated — research admin access is
--     an ordinary Engagement staff session (app_users), gated by role.
--
-- Adds:
--   • reports (+ report_metrics, report_movers, report_recommendations,
--     report_outlook, report_news) — the weekly research report and its parts.
--   • send_log       — per-send delivery/open/click/bounce facts.
--   • send_jobs      — scheduled-broadcast queue (dispatched in Phase 2).
--   • report_subscriptions — per-contact research status (tier, subscription
--     state, unsubscribe token). Independent of Greetings/Documents, so a
--     research unsubscribe or bounce never silences a birthday or a signing
--     link (per-channel status).
--   • the two private Storage buckets: report-pdfs (analyst source PDFs) and
--     report-pdfs-rendered (downloadable-PDF cache).
--   • claim_due_send_jobs(p_limit) — atomic FOR UPDATE SKIP LOCKED claim used
--     by the scheduled-send worker in Phase 2.
--
-- No code in Phase 0 reads any of this yet — schema lands ahead of the ported
-- research code (Phases 1–2). Nothing here touches the live Greetings /
-- Documents tables.
-- ============================================================================

-- pgcrypto is already enabled (gen_random_uuid / gen_random_bytes); assert it.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. reports — the weekly report envelope
-- ----------------------------------------------------------------------------
create table if not exists reports (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  period_start          date not null,
  period_end            date not null,
  outlook_period_start  date not null,
  outlook_period_end    date not null,
  headline              text not null,
  status                text not null default 'draft'
                          check (status in ('draft','published')),
  source_pdf_url        text,                 -- path in the report-pdfs bucket
  parse_confidence      jsonb,                -- per-section Claude parse confidence
  published_at          timestamptz,
  created_by            uuid references app_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_reports_status on reports (status);
create index if not exists idx_reports_published_at on reports (published_at desc);

-- ----------------------------------------------------------------------------
-- 2. report_metrics — one row per report (the top-line index numbers)
-- ----------------------------------------------------------------------------
create table if not exists report_metrics (
  report_id           uuid primary key references reports(id) on delete cascade,
  asi_value           text not null,
  asi_change_pct      double precision,
  mcap_value          text not null,
  mcap_change_pct     double precision,
  volume_shares       text,
  volume_change_pct   double precision,
  value_traded        text,
  value_change_pct    double precision,
  deals               text,
  deals_change_pct    double precision
);

-- ----------------------------------------------------------------------------
-- 3. report_movers — top gainers / decliners
--    open_price/close_price default 0 (the "not given" sentinel — no real NGX
--    stock is exactly 0/0; the % is authoritative and a missing price is
--    back-computed from it at render time).
-- ----------------------------------------------------------------------------
create table if not exists report_movers (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  kind          text not null check (kind in ('gainer','decliner')),
  rank          int not null,
  company_name  text not null,
  open_price    double precision not null default 0,
  close_price   double precision not null default 0,
  change_pct    double precision not null
);

create index if not exists idx_report_movers_report on report_movers (report_id);

-- ----------------------------------------------------------------------------
-- 4. report_recommendations — buy / hold / sell calls
-- ----------------------------------------------------------------------------
create table if not exists report_recommendations (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  kind          text not null check (kind in ('buy','hold','sell')),
  company_name  text not null,
  note          text,
  display_order int not null default 0
);

create index if not exists idx_report_recs_report on report_recommendations (report_id);

-- ----------------------------------------------------------------------------
-- 5. report_outlook — one row per report (forward view + string arrays)
-- ----------------------------------------------------------------------------
create table if not exists report_outlook (
  report_id       uuid primary key references reports(id) on delete cascade,
  direction       text not null,
  support         text,
  resistance      text,
  outperformers   text[] not null default '{}',
  underperformers text[] not null default '{}',
  risks           text[] not null default '{}',
  catalysts       text[] not null default '{}'
);

-- ----------------------------------------------------------------------------
-- 6. report_news — market news items
-- ----------------------------------------------------------------------------
create table if not exists report_news (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  title         text not null,
  body          text not null,
  display_order int not null default 0
);

create index if not exists idx_report_news_report on report_news (report_id);

-- ----------------------------------------------------------------------------
-- 7. report_subscriptions — per-contact research status (the merge point)
--    A subscriber is a contact + this row. Status here is research-only and
--    does NOT affect Greetings or Documents. One subscription per contact.
-- ----------------------------------------------------------------------------
create table if not exists report_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null unique references contacts(id) on delete cascade,
  tier              text not null default 'Standard'
                      check (tier in ('Standard','Premium')),
  status            text not null default 'active'
                      check (status in ('active','pending','unsubscribed','bounced')),
  unsubscribe_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_report_subs_status on report_subscriptions (status);

-- ----------------------------------------------------------------------------
-- 8. send_log — per-send facts (one row per report x contact send)
--    contact_id references the shared directory (was clients.id in the portal).
-- ----------------------------------------------------------------------------
create table if not exists send_log (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  status        text not null default 'queued'
                  check (status in ('queued','sent','delivered','failed','bounced','complained')),
  resend_id     text,
  scheduled_for timestamptz,
  subject       text,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  opened_at     timestamptz,
  clicked_at    timestamptz,
  bounced_at    timestamptz,
  complained_at timestamptz,
  error_message text
);

create index if not exists idx_send_log_report on send_log (report_id);
create index if not exists idx_send_log_contact on send_log (contact_id);
create index if not exists idx_send_log_status on send_log (status);
create index if not exists idx_send_log_resend on send_log (resend_id);

-- ----------------------------------------------------------------------------
-- 9. send_jobs — scheduled broadcast queue (dispatched by the Phase 2 worker)
--    selected_contact_ids references the shared directory (was
--    selected_client_ids in the portal).
-- ----------------------------------------------------------------------------
create table if not exists send_jobs (
  id                    uuid primary key default gen_random_uuid(),
  report_id             uuid not null references reports(id) on delete cascade,
  scheduled_for         timestamptz not null,
  status                text not null default 'scheduled'
                          check (status in ('scheduled','processing','completed','failed','cancelled')),
  selected_contact_ids  uuid[] not null default '{}',
  subject               text not null,
  created_by            uuid references app_users(id) on delete set null,
  processing_started_at timestamptz,
  completed_at          timestamptz,
  error_message         text,
  recipient_count       int not null default 0,
  success_count         int not null default 0,
  failure_count         int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_send_jobs_due on send_jobs (status, scheduled_for);
create index if not exists idx_send_jobs_report on send_jobs (report_id);

-- ----------------------------------------------------------------------------
-- 10. claim_due_send_jobs(p_limit) — atomic claim for the scheduled worker
--     FOR UPDATE SKIP LOCKED so two concurrent cron runs can't grab the same
--     job. Pure-SQL (LANGUAGE sql) per house preference; returns full rows.
--     NOTE: reconstructed from the portal worker's call contract (it lived in
--     the portal DB, not the repo). It is not exercised until Phase 2 — dump
--     the original with pg_get_functiondef on the portal DB and diff before
--     relying on scheduled sends.
-- ----------------------------------------------------------------------------
create or replace function claim_due_send_jobs(p_limit int)
returns setof send_jobs
language sql
as $$
  update send_jobs
     set status = 'processing',
         processing_started_at = now(),
         updated_at = now()
   where id in (
     select id
       from send_jobs
      where status = 'scheduled'
        and scheduled_for <= now()
      order by scheduled_for
      limit p_limit
      for update skip locked
   )
  returning *;
$$;

-- ----------------------------------------------------------------------------
-- 11. updated_at triggers for the new parent tables
--     (children — metrics/movers/recs/outlook/news — are rewritten on save and
--     carry no updated_at, matching the portal's row shapes.)
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['reports','send_jobs','report_subscriptions']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 12. Storage buckets (both private — every read is a signed URL or a
--     token-gated proxy, minted server-side). Mirrors the portal.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('report-pdfs-rendered', 'report-pdfs-rendered', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Verify (optional): list the new tables, the function, and the buckets.
-- ----------------------------------------------------------------------------
-- select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('reports','report_metrics','report_movers',
--       'report_recommendations','report_outlook','report_news',
--       'report_subscriptions','send_log','send_jobs')
--   order by table_name;
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'claim_due_send_jobs';
-- select id from storage.buckets where id in ('report-pdfs','report-pdfs-rendered');
