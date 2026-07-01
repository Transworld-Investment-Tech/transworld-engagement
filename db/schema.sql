-- ============================================================================
-- Transworld Client Engagement — full schema (v1.0)
-- Postgres / Supabase
-- Run in the Supabase SQL editor.
-- ============================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. APP USERS  (internal TISL staff who log in to the tool)
--    Clients/customers are NOT users — they live in `contacts` and receive
--    emails / token links, they never log in.
-- ----------------------------------------------------------------------------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'user'
                  check (role in ('admin', 'manager', 'user')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. CONTACTS  (the customers — shared foundation for BOTH modules)
-- ----------------------------------------------------------------------------
create table if not exists contacts (
  id            uuid primary key default gen_random_uuid(),
  title         text,                       -- Mr / Mrs / Ms / Dr / Chief ...
  first_name    text not null,
  last_name     text not null,
  email         text,
  phone         text,                       -- store E.164 (+234...) for future WhatsApp
  date_of_birth date,
  status        text not null default 'active'
                  check (status in ('active', 'inactive')),
  tags          text[] not null default '{}',  -- segmentation: 'HNW', 'pod3', 'newsletter'...
  notes         text,
  created_by    uuid references app_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_contacts_email on contacts (lower(email));
create index if not exists idx_contacts_status on contacts (status);
-- Birthday lookups by month/day (ignores year):
create index if not exists idx_contacts_dob_md
  on contacts (extract(month from date_of_birth), extract(day from date_of_birth));

-- ----------------------------------------------------------------------------
-- 3. GREETINGS MODULE
-- ----------------------------------------------------------------------------
create table if not exists greeting_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'custom'
                check (type in ('birthday', 'holiday', 'custom')),
  subject     text not null,
  html_body   text not null,               -- supports merge tags: {{title}} {{first_name}} {{last_name}}
  is_active   boolean not null default true,
  created_by  uuid references app_users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists greeting_logs (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references contacts(id) on delete set null,
  template_id uuid references greeting_templates(id) on delete set null,
  type        text not null,               -- snapshot of template type at send time
  channel     text not null default 'email'
                check (channel in ('email', 'whatsapp')),  -- whatsapp reserved for later
  subject     text,
  status      text not null default 'sent'
                check (status in ('sent', 'failed', 'skipped')),
  resend_id   text,                        -- Resend message id
  error       text,
  sent_by     uuid references app_users(id),  -- null = automated (cron)
  sent_at     timestamptz not null default now()
);

create index if not exists idx_greeting_logs_contact on greeting_logs (contact_id);
create index if not exists idx_greeting_logs_sent_at on greeting_logs (sent_at);

-- ----------------------------------------------------------------------------
-- 4. SIGNING MODULE
--    A document has an ORDERED list of signatories. Single-signer = 1 row;
--    countersigned (the common case) = client at sign_order 1, TISL officer at
--    sign_order 2. The document completes only when all signatories have signed.
-- ----------------------------------------------------------------------------
create table if not exists documents (
  id                        uuid primary key default gen_random_uuid(),
  title                     text not null,
  original_filename         text,
  storage_path              text,          -- Supabase storage path to the uploaded PDF
  signed_storage_path       text,          -- final, stamped PDF
  status                    text not null default 'draft'
                              check (status in ('draft','sent','partially_signed','completed','voided','expired')),
  contact_id                uuid references contacts(id) on delete set null,  -- the client signer
  requires_countersignature boolean not null default true,  -- most documents = true
  kind                      text not null default 'signature'
                              check (kind in ('signature','acceptance')),  -- proposal acceptance vs signing
  sha256_hash               text,          -- hash of the final signed PDF (tamper-evidence)
  created_by                uuid references app_users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  completed_at              timestamptz,
  expires_at                timestamptz
);

create index if not exists idx_documents_status on documents (status);
create index if not exists idx_documents_contact on documents (contact_id);

create table if not exists signatories (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  role            text not null check (role in ('client', 'officer')),
  sign_order      int  not null default 1,            -- client = 1, officer = 2
  name            text not null,
  email           text not null,
  contact_id      uuid references contacts(id),       -- set for client
  app_user_id     uuid references app_users(id),      -- set for officer
  sign_token      text unique,                        -- one-time signing link token
  token_expires_at timestamptz,
  status          text not null default 'pending'
                    check (status in ('pending','viewed','signed','declined')),
  signature_type  text check (signature_type in ('drawn','typed')),
  signature_data  text,                               -- base64 PNG (drawn) or typed name
  consent_given   boolean not null default false,
  signer_ip       text,
  signer_user_agent text,
  signed_at       timestamptz,
  -- OTP second factor for the client signing link (v1.2). Hash only, never
  -- plaintext: sha256(code + ':' + sign_token). Officer signs in-app, no OTP.
  otp_code_hash   text,
  otp_expires_at  timestamptz,
  otp_sent_at     timestamptz,
  otp_attempts    int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_signatories_document on signatories (document_id);
create index if not exists idx_signatories_token on signatories (sign_token);

create table if not exists signature_fields (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  signatory_role  text not null check (signatory_role in ('client','officer')),
  field_type      text not null default 'signature'
                    check (field_type in ('signature','date','initial','text')),
  label           text,                        -- prompt shown to the signer / on the box
  required        boolean not null default false,
  value           text,                        -- the entered text/date value (not for signatures)
  sort_order      int not null default 0,
  page            int  not null default 1,
  pos_x           double precision,            -- PDF point coordinates, bottom-left origin
  pos_y           double precision,            -- (nullable: a future computed-only field has none)
  width           double precision,
  height          double precision,
  created_at      timestamptz not null default now()
);

create index if not exists idx_signature_fields_document on signature_fields (document_id);

-- Immutable audit trail. This table is what discharges the burden-of-proof
-- requirement under the Evidence Act: who did what, when, from where.
create table if not exists signature_events (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  signatory_id  uuid references signatories(id) on delete set null,
  event_type    text not null,   -- created|sent|viewed|signed|countersigned|completed|downloaded|voided
  actor         text,            -- email of actor, or 'system'
  ip            text,
  user_agent    text,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists idx_signature_events_document on signature_events (document_id);

-- Private Storage bucket for PDFs (originals/ and signed/). Private: every fetch
-- is a short-lived signed URL minted server-side. (v1.2)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers
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
  foreach t in array array['app_users','contacts','greeting_templates','documents']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- 6. Research module (v1.8) — reports, sends, subscriptions, buckets.
--    A research subscriber is a `contacts` row + a `report_subscriptions` row;
--    research admin access is an ordinary app_users session. See
--    db/migrations/2026-07-01-v1.8-research-schema.sql for full rationale.
-- ============================================================================
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
  -- Which staff member subscribed this contact (provenance for the opt-in).
  -- on delete set null: removing a staff account never erases subscription history.
  subscribed_by     uuid references app_users(id) on delete set null,
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
