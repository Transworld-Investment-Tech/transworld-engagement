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
  page            int  not null default 1,
  pos_x           double precision not null,   -- PDF point coordinates
  pos_y           double precision not null,
  width           double precision not null,
  height          double precision not null,
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
