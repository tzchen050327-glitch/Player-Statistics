-- Supabase A: kjndnsztbcpmkhictjkr
-- Applied in production as baseball_offseason_cron_throttling_20261029.
-- Only five CPBL/NPB polling jobs are throttled; notification, umpire,
-- matchmaking, and backend APIs are deliberately left alone.
CREATE SCHEMA IF NOT EXISTS baseball_ops;
REVOKE ALL ON SCHEMA baseball_ops FROM PUBLIC;
REVOKE ALL ON SCHEMA baseball_ops FROM anon, authenticated;

CREATE OR REPLACE FUNCTION baseball_ops.league_is_offseason(p_league text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
WITH d AS (
  SELECT CASE
    WHEN p_league = 'NPB' THEN (now() AT TIME ZONE 'Asia/Tokyo')::date
    WHEN p_league = 'CPBL' THEN (now() AT TIME ZONE 'Asia/Taipei')::date
    ELSE NULL::date
  END AS local_date
), candidate AS (
  SELECT CASE WHEN extract(month from local_date) <= 2
      THEN extract(year from local_date)::int - 1
      ELSE extract(year from local_date)::int END AS season_year,
    local_date
  FROM d
)
SELECT COALESCE((
  SELECT TRUE
  FROM candidate y
  JOIN public.league_schedule_cache c
    ON c.cache_key = p_league || '|CHAMPION|' || y.season_year::text
   AND c.scope = 'CHAMPION'
  WHERE y.local_date IS NOT NULL
    AND nullif(c.payload->'champion'->>'team','') IS NOT NULL
    AND (c.payload->'champion'->>'decidedOn') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (c.payload->'champion'->>'expiresOn') ~ '^\d{4}-\d{2}-\d{2}$'
    AND y.local_date >= (c.payload->'champion'->>'decidedOn')::date
    AND y.local_date <= (c.payload->'champion'->>'expiresOn')::date
  LIMIT 1
), FALSE);
$$;

CREATE OR REPLACE FUNCTION baseball_ops.reconcile_seasonal_cron()
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, cron, baseball_ops
AS $$
DECLARE
  npb_off boolean := baseball_ops.league_is_offseason('NPB');
  cpbl_off boolean := baseball_ops.league_is_offseason('CPBL');
  item record;
  job record;
  wanted text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('npb-pitch-count-hydrator'::text, 'NPB'::text, '45 seconds'::text, '*/30 * * * *'::text),
      ('npb-standings-final-retry', 'NPB', '* * * * *', '*/30 * * * *'),
      ('cpbl-standings-final-retry', 'CPBL', '* * * * *', '*/30 * * * *'),
      ('npb-live-updater-minute', 'NPB', '*/30 * * * *', '0 */6 * * *'),
      ('cpbl-live-updater-minute', 'CPBL', '*/30 * * * *', '0 */6 * * *')
    ) AS v(job_name, league, regular_frequency, offseason_frequency)
  LOOP
    wanted := CASE WHEN (item.league = 'NPB' AND npb_off)
       OR (item.league = 'CPBL' AND cpbl_off)
       THEN item.offseason_frequency ELSE item.regular_frequency END;
    SELECT j.jobid, j.schedule, j.active INTO job
      FROM cron.job j WHERE j.jobname = item.job_name;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Required baseball cron job missing: %', item.job_name;
    END IF;
    IF NOT job.active THEN CONTINUE; END IF;
    IF job.schedule IS DISTINCT FROM wanted THEN
      PERFORM cron.alter_job(job_id => job.jobid, schedule => wanted);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION baseball_ops.league_is_offseason(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION baseball_ops.reconcile_seasonal_cron() FROM PUBLIC, anon, authenticated;

-- Hourly guard re-enables in-season rates when the previous champion's
-- expiresOn date has passed; no manual version change or intervention.
SELECT cron.schedule(
 'baseball-seasonal-cron-reconcile',
 '7 * * * *',
 'select baseball_ops.reconcile_seasonal_cron();'
);
SELECT baseball_ops.reconcile_seasonal_cron();
