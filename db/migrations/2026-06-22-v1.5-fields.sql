-- ============================================================================
-- Transworld Client Engagement — v1.5 migration: in-document field placement
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Adds:
--   • documents.kind — 'signature' (existing behavior) or 'acceptance'
--     (a TISL-prepared proposal the client accepts; client-only).
--   • signature_fields becomes the real field registry: a label, a required
--     flag, the entered value, a sort order, and nullable placement positions
--     (PDF points, bottom-left origin) so staff-placed fields and their values
--     live here and flow straight into PDF assembly.
-- ============================================================================

-- 1) documents.kind --------------------------------------------------------
alter table documents
  add column if not exists kind text not null default 'signature';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_kind_check'
  ) then
    alter table documents
      add constraint documents_kind_check check (kind in ('signature','acceptance'));
  end if;
end $$;

-- 2) signature_fields: value-bearing + placement ---------------------------
alter table signature_fields
  add column if not exists label      text,
  add column if not exists required   boolean not null default false,
  add column if not exists value      text,
  add column if not exists sort_order int not null default 0;

-- Positions become nullable (a field may be defined before placement, and the
-- generated execution-page fallback has no authored position).
alter table signature_fields alter column pos_x  drop not null;
alter table signature_fields alter column pos_y  drop not null;
alter table signature_fields alter column width  drop not null;
alter table signature_fields alter column height drop not null;
