-- Supabase B fixed updater:
-- pg_cron checks every 2 minutes, but the Edge Function is invoked only when
-- KBO or MLB is actually due, or when the league-local date rolls over.
select cron.schedule(
  'league-fixed-schedule-updater',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := '__SUPABASE_B_FUNCTIONS_BASE__/league-fixed-updater',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"appKey":"__APP_KEY__"}'::jsonb,
      timeout_milliseconds := 55000
    )
    where
      not exists (
        select 1
        from public.league_fixed_refresh_state
        where league in ('KBO','MLB')
      )
      or exists (
        select 1
        from public.league_fixed_refresh_state s
        where
          (s.league='KBO' and (
            s.game_date is distinct from (now() at time zone 'Asia/Seoul')::date
            or s.next_refresh_at is null
            or s.next_refresh_at <= now()
          ))
          or
          (s.league='MLB' and (
            s.game_date is distinct from (now() at time zone 'America/New_York')::date
            or s.next_refresh_at is null
            or s.next_refresh_at <= now()
          ))
      );
  $cron$
);
