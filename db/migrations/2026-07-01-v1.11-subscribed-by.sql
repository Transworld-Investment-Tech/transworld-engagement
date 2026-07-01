-- v1.11 — Research subscription provenance (Phase 2a)
--
-- Adds `subscribed_by` to report_subscriptions so the roster records WHICH
-- staff member subscribed a client, alongside the created_at it already keeps.
-- For a deliberate-opt-in model at a regulated firm this is the audit answer to
-- "this client got signed up for research — by whom, and when?".
--
-- Additive and idempotent. `on delete set null` mirrors every other provenance
-- column in the schema (created_by, sent_by): disabling/removing a staff account
-- never erases the subscription history it created.

alter table report_subscriptions
  add column if not exists subscribed_by uuid references app_users(id) on delete set null;
