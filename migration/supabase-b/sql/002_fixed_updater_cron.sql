-- Replace placeholders immediately before applying to Supabase B.
select cron.schedule(
  'league-fixed-schedule-updater',
  '* * * * *',
  $cron$
    select net.http_post(
      url := '__SUPABASE_B_FUNCTIONS_BASE__/league-fixed-updater',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"appKey":"__APP_KEY__"}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);
