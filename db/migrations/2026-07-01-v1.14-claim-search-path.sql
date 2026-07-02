-- ============================================================================
-- v1.14 — Research Phase 2d: harden claim_due_send_jobs
--
-- The scheduled-send worker (app/api/cron/process-sends) is the first code to
-- call claim_due_send_jobs. Before exercising it, pin the function's
-- search_path — the open hardening item Supabase's linter flags
-- (function_search_path_mutable). This is a behavior-preserving change: the
-- body below is byte-identical to the live function (LANGUAGE sql, invoker
-- rights; the worker already calls it with the service-role key), with only
-- `set search_path = public, pg_temp` added. Idempotent via create or replace.
-- ============================================================================

create or replace function claim_due_send_jobs(p_limit int)
returns setof send_jobs
language sql
set search_path = public, pg_temp
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
