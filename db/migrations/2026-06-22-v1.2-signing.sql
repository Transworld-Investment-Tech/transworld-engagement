-- ============================================================================
-- v1.2 (Documents / signing) — migration against the live v1.1 database.
--
-- The four signing tables (documents, signatories, signature_fields,
-- signature_events) were already deployed with the v1.0 schema, so the ONLY
-- table change v1.2 needs is the OTP second factor on `signatories`
-- (Decision 1: email one-time code before the client can sign).
--
-- Run this whole file once in the Supabase SQL editor.
-- It is idempotent — safe to re-run.
-- ============================================================================

-- 1. OTP second factor for the client signing link ---------------------------
--    We store a HASH of the code (sha256 of code + ':' + sign_token), never the
--    plaintext, plus an expiry, a sent-at for throttling, and an attempt counter
--    so a link can be locked after repeated wrong codes.
alter table signatories
  add column if not exists otp_code_hash  text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_sent_at    timestamptz,
  add column if not exists otp_attempts   int not null default 0;

-- 2. Private Storage bucket for PDFs ------------------------------------------
--    Holds both uploaded originals (originals/<id>.pdf) and final stamped files
--    (signed/<id>.pdf). PRIVATE — every fetch is a short-lived signed URL minted
--    server-side with the service-role key. No public read.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
