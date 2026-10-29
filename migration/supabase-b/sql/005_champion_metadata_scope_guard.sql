-- Prevent MLB/KBO champion metadata from being mistaken for unfinished schedules.
-- Deploys to the primary Supabase project (kjndnsztbcpmkhictjkr).
CREATE OR REPLACE FUNCTION public.normalize_historical_league_schedule_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF new.game_date < (now() AT TIME ZONE 'Asia/Taipei')::date
     AND public.schedule_payload_all_terminal(new.payload) THEN
    new.refresh_after := 'infinity'::timestamptz;
  ELSIF upper(coalesce(new.league,'')) IN ('MLB','KBO')
     AND new.scope = 'ALL'
     AND jsonb_typeof(new.payload->'games') = 'array'
     AND NOT public.schedule_payload_all_terminal(new.payload)
     AND (new.refresh_after IS NULL
          OR new.refresh_after = 'infinity'::timestamptz) THEN
    new.refresh_after := now() - INTERVAL '1 second';
  END IF;
  RETURN new;
END;
$function$;
