CREATE TABLE IF NOT EXISTS public.cpbl_team_pitching_matchup_game_cache (
 full_game_id text PRIMARY KEY,
 game_year integer NOT NULL CHECK (game_year BETWEEN 1990 AND 2100),
 kind_code text NOT NULL DEFAULT 'A',
 game_date date,
 away_code text NOT NULL,
 home_code text NOT NULL,
 game_status text NOT NULL,
 pitching_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cpbl_team_pitching_matchup_game_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpbl_team_pitching_matchup_game_cache FROM anon, authenticated;
