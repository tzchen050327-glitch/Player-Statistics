create extension if not exists http with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists public.league_schedule_cache (
  cache_key text primary key,
  league text not null,
  game_date date not null,
  scope text not null default 'ALL',
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  refresh_after timestamptz,
  source text not null default 'official',
  last_error text,
  updated_at timestamptz not null default now()
);
create index if not exists league_schedule_cache_lookup_idx
  on public.league_schedule_cache (league, game_date, scope);

create table if not exists public.league_next_game_cache (
  cache_key text primary key,
  league text not null,
  team_key text not null,
  scope text not null default 'ALL',
  payload jsonb,
  fetched_at timestamptz not null default now(),
  refresh_after timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
create index if not exists league_next_game_cache_lookup_idx
  on public.league_next_game_cache (league, team_key, scope);

create table if not exists public.backend_cache_metrics (
  metric_date date not null,
  metric_key text not null,
  count bigint not null default 0,
  last_at timestamptz not null default now(),
  primary key (metric_date, metric_key)
);

create table if not exists public.league_fixed_refresh_state (
  league text primary key,
  game_date date,
  next_refresh_at timestamptz,
  last_refresh_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_schedule_revision_signal (
  signal_key text primary key,
  league text not null,
  game_date date not null,
  revision bigint not null default 0,
  changed_at timestamptz not null default now()
);
create index if not exists league_schedule_revision_signal_date_idx
  on public.league_schedule_revision_signal (league, game_date);

alter table public.league_schedule_cache enable row level security;
alter table public.league_next_game_cache enable row level security;
alter table public.backend_cache_metrics enable row level security;
alter table public.league_fixed_refresh_state enable row level security;
alter table public.league_schedule_revision_signal enable row level security;

drop policy if exists league_schedule_revision_signal_public_read
  on public.league_schedule_revision_signal;
create policy league_schedule_revision_signal_public_read
  on public.league_schedule_revision_signal
  for select to public using (true);

revoke all on public.league_schedule_cache from anon, authenticated;
revoke all on public.league_next_game_cache from anon, authenticated;
revoke all on public.backend_cache_metrics from anon, authenticated;
revoke all on public.league_fixed_refresh_state from anon, authenticated;
grant select on public.league_schedule_revision_signal to anon, authenticated;
grant all on public.league_schedule_cache to service_role;
grant all on public.league_next_game_cache to service_role;
grant all on public.backend_cache_metrics to service_role;
grant all on public.league_fixed_refresh_state to service_role;
grant all on public.league_schedule_revision_signal to service_role;

create or replace function public.increment_backend_cache_metric(
  p_key text,
  p_amount bigint default 1
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_date date := (now() at time zone 'Asia/Taipei')::date;
  v_count bigint;
begin
  insert into public.backend_cache_metrics(metric_date, metric_key, count, last_at)
  values(v_date, p_key, greatest(0,p_amount), now())
  on conflict(metric_date, metric_key)
  do update set
    count = public.backend_cache_metrics.count + excluded.count,
    last_at = now()
  returning count into v_count;
  return v_count;
end;
$function$;

revoke all on function public.increment_backend_cache_metric(text,bigint) from public, anon, authenticated;
grant execute on function public.increment_backend_cache_metric(text,bigint) to service_role;

create or replace function public.publish_league_schedule_cache(
  p_league text,
  p_game_date date,
  p_payload jsonb,
  p_refresh_after timestamptz default null,
  p_source text default 'official'
) returns table(changed boolean, revision bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key text := upper(p_league) || '|SCHEDULE|' || p_game_date::text || '|ALL';
  v_old jsonb;
  v_rev bigint := 0;
begin
  select payload into v_old
  from public.league_schedule_cache
  where cache_key=v_key
  for update;

  select coalesce(s.revision,0) into v_rev
  from public.league_schedule_revision_signal s
  where s.signal_key=upper(p_league)||'|'||p_game_date::text;
  v_rev := coalesce(v_rev,0);

  if v_old is not null and v_old = p_payload then
    update public.league_schedule_cache
    set fetched_at=now(),
        refresh_after=coalesce(p_refresh_after, refresh_after),
        source=coalesce(nullif(p_source,''),source),
        last_error=null,
        updated_at=now()
    where cache_key=v_key;
    return query select false, v_rev;
    return;
  end if;

  insert into public.league_schedule_cache(
    cache_key,league,game_date,scope,payload,fetched_at,
    refresh_after,source,last_error,updated_at
  )
  values(
    v_key,upper(p_league),p_game_date,'ALL',p_payload,now(),
    p_refresh_after,p_source,null,now()
  )
  on conflict(cache_key) do update set
    league=excluded.league,
    game_date=excluded.game_date,
    scope='ALL',
    payload=excluded.payload,
    fetched_at=excluded.fetched_at,
    refresh_after=excluded.refresh_after,
    source=excluded.source,
    last_error=null,
    updated_at=excluded.updated_at;

  insert into public.league_schedule_revision_signal(
    signal_key,league,game_date,revision,changed_at
  )
  values(
    upper(p_league)||'|'||p_game_date::text,
    upper(p_league),p_game_date,v_rev+1,now()
  )
  on conflict(signal_key) do update set
    league=excluded.league,
    game_date=excluded.game_date,
    revision=public.league_schedule_revision_signal.revision+1,
    changed_at=now()
  returning public.league_schedule_revision_signal.revision into v_rev;

  return query select true, v_rev;
end;
$function$;

revoke all on function public.publish_league_schedule_cache(text,date,jsonb,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.publish_league_schedule_cache(text,date,jsonb,timestamptz,text)
  to service_role;

create or replace function public.baseball_official_http_get(p_url text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_resp extensions.http_response;
  v_headers extensions.http_header[];
  v_ref text := '';
begin
  if p_url is null or not (
    p_url ~* '^https://statsapi\.mlb\.com/'
    or p_url ~* '^https://([a-z0-9-]+\.)*(wbscasia\.org|wbsc\.org)/'
  ) then
    raise exception 'unsupported host' using errcode = '22023';
  end if;

  if p_url ~* '^https://([a-z0-9-]+\.)*(wbscasia\.org|wbsc\.org)/' then
    v_ref := coalesce(
      substring(p_url from '^(https://([a-z0-9-]+\.)*(wbscasia\.org|wbsc\.org)/[a-z]{2}/events/[^/]+)'),
      'https://www.wbsc.org'
    ) || '/schedule-and-results';
    v_headers := array[
      extensions.http_header('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'),
      extensions.http_header('Accept','text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'),
      extensions.http_header('Accept-Language','en-US,en;q=0.9,zh-TW;q=0.8'),
      extensions.http_header('Referer',v_ref),
      extensions.http_header('Cache-Control','no-cache')
    ]::extensions.http_header[];
  else
    v_headers := array[
      extensions.http_header('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'),
      extensions.http_header('Accept','application/json,text/plain,*/*'),
      extensions.http_header('Accept-Language','en-US,en;q=0.9,zh-TW;q=0.8'),
      extensions.http_header('Cache-Control','no-cache')
    ]::extensions.http_header[];
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','20000');

  v_resp := extensions.http((
    'GET',
    p_url,
    v_headers,
    null,
    null
  )::extensions.http_request);

  if v_resp.status < 200 or v_resp.status >= 300 then
    raise exception 'official baseball HTTP %', v_resp.status using errcode = '58000';
  end if;

  return v_resp.content;
end;
$function$;

revoke all on function public.baseball_official_http_get(text) from public;
grant execute on function public.baseball_official_http_get(text)
  to anon, authenticated, service_role;
