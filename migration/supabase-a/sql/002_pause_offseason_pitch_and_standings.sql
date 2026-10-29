-- Supabase baseball A: kjndnsztbcpmkhictjkr
-- Deployed in production as pause_offseason_pitch_counts_and_standings_20261029.
-- Skip all CPBL/NPB regular-season standings retries and NPB pitch hydrator
-- after a confirmed championship. Resume only jobs paused by this controller
-- when the existing hourly season reconciler exits offseason.
CREATE SCHEMA IF NOT EXISTS baseball_ops;
REVOKE ALL ON SCHEMA baseball_ops FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS baseball_ops.seasonal_paused_jobs (
  job_name text PRIMARY KEY,
  job_id bigint NOT NULL,
  paused_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE baseball_ops.seasonal_paused_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE baseball_ops.seasonal_paused_jobs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION baseball_ops.reconcile_seasonal_cron()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'cron', 'baseball_ops'
AS $function$
DECLARE
  npb_off boolean := baseball_ops.league_is_offseason('NPB');
  cpbl_off boolean := baseball_ops.league_is_offseason('CPBL');
  item record;
  job record;
  owned_pause record;
  off boolean;
  wanted text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('npb-pitch-count-hydrator'::text, 'NPB'::text, '45 seconds'::text, true),
      ('npb-standings-final-retry', 'NPB', '* * * * *', true),
      ('cpbl-standings-final-retry', 'CPBL', '* * * * *', true),
      ('npb-live-updater-minute', 'NPB', '*/30 * * * *', false),
      ('cpbl-live-updater-minute', 'CPBL', '*/30 * * * *', false)
    ) AS v(job_name, league, regular_frequency, stop_when_offseason)
  LOOP
    off := CASE WHEN item.league = 'NPB' THEN npb_off ELSE cpbl_off END;
    wanted := CASE WHEN off THEN
      CASE WHEN item.stop_when_offseason THEN item.regular_frequency
           ELSE '0 */6 * * *' END
      ELSE item.regular_frequency END;
    SELECT j.jobid, j.schedule, j.active INTO job
      FROM cron.job j WHERE j.jobname = item.job_name;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Required baseball cron job missing: %', item.job_name;
    END IF;

    SELECT p.job_id INTO owned_pause
      FROM baseball_ops.seasonal_paused_jobs p WHERE p.job_name = item.job_name;
    IF FOUND AND owned_pause.job_id <> job.jobid THEN
      RAISE EXCEPTION 'Cron job identity changed while seasonally paused: %', item.job_name;
    END IF;

    IF off AND item.stop_when_offseason THEN
      IF job.active THEN
        PERFORM cron.alter_job(job_id => job.jobid, active => false);
        INSERT INTO baseball_ops.seasonal_paused_jobs(job_name, job_id)
          VALUES(item.job_name,job.jobid)
          ON CONFLICT (job_name) DO UPDATE
            SET job_id=excluded.job_id,paused_at=now();
      END IF;
      -- Never start a derived job during confirmed offseason.
      CONTINUE;
    END IF;

    IF NOT off AND item.stop_when_offseason AND owned_pause.job_id IS NOT NULL THEN
      -- Re-enable only jobs our own controller previously disabled.
      PERFORM cron.alter_job(job_id => job.jobid, schedule => wanted, active => true);
      DELETE FROM baseball_ops.seasonal_paused_jobs p WHERE p.job_name = item.job_name;
      CONTINUE;
    END IF;

    IF NOT job.active THEN
      -- Someone intentionally disabled this job; leave it untouched.
      CONTINUE;
    END IF;
    IF job.schedule IS DISTINCT FROM wanted THEN
      PERFORM cron.alter_job(job_id => job.jobid, schedule => wanted);
    END IF;
  END LOOP;
END;
$function$
;
REVOKE ALL ON FUNCTION baseball_ops.reconcile_seasonal_cron()
  FROM PUBLIC, anon, authenticated;

SELECT baseball_ops.reconcile_seasonal_cron();
