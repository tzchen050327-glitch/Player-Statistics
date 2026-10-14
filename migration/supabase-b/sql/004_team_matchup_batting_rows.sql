ALTER TABLE public.cpbl_team_pitching_matchup_game_cache
  ADD COLUMN IF NOT EXISTS batting_rows jsonb;
COMMENT ON COLUMN public.cpbl_team_pitching_matchup_game_cache.batting_rows
  IS 'Official final-game hitting lines for team-vs-team yearly splits; NULL if uncached';
