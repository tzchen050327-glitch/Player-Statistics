from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

# Current CPBL roster level comes from the dedicated stats-player-page resolver.
anchor = "    const CPBL_DAILY_CACHE_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-daily-cache';\n"
insert = anchor + "    const CPBL_CURRENT_ROSTER_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-current-roster';\n"
if 'CPBL_CURRENT_ROSTER_API_URL' not in s:
    if anchor not in s:
        raise SystemExit('CPBL daily URL anchor missing')
    s = s.replace(anchor, insert, 1)

old = """      const requestUrl = action === 'daily' && ['A','D','E','C'].includes(requestKindCode)
        ? CPBL_DAILY_CACHE_API_URL
        : CPBL_API_URL;
"""
new = """      const requestUrl = ['current-roster','current-rosters'].includes(action)
        ? CPBL_CURRENT_ROSTER_API_URL
        : action === 'daily' && ['A','D','E','C'].includes(requestKindCode)
          ? CPBL_DAILY_CACHE_API_URL
          : CPBL_API_URL;
"""
if old not in s:
    raise SystemExit('cpblRequest routing anchor missing')
s = s.replace(old, new, 1)

# Never show CPBL second-team games in the home-page daily game strip.
old = """        let games = await leagueDailyGamesRequest(league, date);

        // Outer cards use only the daily schedule feed. Single-game detail is fetched only after the user opens a game.
"""
new = """        let games = await leagueDailyGamesRequest(league, date);
        if (league === 'CPBL') {
          games = (Array.isArray(games) ? games : []).filter(game => String(game?.kindCode || 'A').toUpperCase() !== 'D');
        }

        // Outer cards use only the daily schedule feed. Single-game detail is fetched only after the user opens a game.
"""
if old not in s:
    raise SystemExit('daily game load anchor missing')
s = s.replace(old, new, 1)

# Do not default an unverified CPBL player to first team.
s = s.replace("          cpblCurrentLevel: 'A',", "          cpblCurrentLevel: '',", 1)

# Only overwrite a saved current level when the roster resolver actually returned A/D.
s = s.replace(
    "          player.cpblCurrentLevel = current.level === 'D' ? 'D' : 'A';",
    "          if (['A','D'].includes(String(current.level || '').toUpperCase())) player.cpblCurrentLevel = String(current.level).toUpperCase();"
)
s = s.replace(
    "            player.cpblCurrentLevel = roster.player.level === 'D' ? 'D' : 'A';",
    "            if (['A','D'].includes(String(roster.player.level || '').toUpperCase())) player.cpblCurrentLevel = String(roster.player.level).toUpperCase();"
)

# When a CPBL player currently belongs to D, open D first if that profile exists.
old = """        selectedLevel = majorYears.length ? 'A' : (minorYears.length ? 'D' : 'A');
        const preferredYears = selectedLevel === 'D' ? minorYears : majorYears;
"""
new = """        const currentLevel = String(player.cpblCurrentLevel || '').toUpperCase();
        selectedLevel = currentLevel === 'D' && minorYears.length
          ? 'D'
          : currentLevel === 'A' && majorYears.length
            ? 'A'
            : (majorYears.length ? 'A' : (minorYears.length ? 'D' : 'A'));
        const preferredYears = selectedLevel === 'D' ? minorYears : majorYears;
"""
if old not in s:
    raise SystemExit('CPBL preferred level anchor missing')
s = s.replace(old, new, 1)

s = s.replace("const APP_VERSION = 'v2.93';", "const APP_VERSION = 'v2.94';", 1)
s = s.replace('v2.93','v2.94').replace('v293','v294')
p.write_text(s, encoding='utf-8')

for name in ['index.html','styles.css','cpbl-realtime.js','service-worker.js','diagnostics.html']:
    q = Path(name)
    if not q.exists():
        continue
    x = q.read_text(encoding='utf-8').replace('v2.93','v2.94').replace('v293','v294')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v294', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.94'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')

# Keep only current + immediately previous formal release artifacts.
for old_path in ['.github/scripts/apply_v292.py', '.github/workflows/apply-v292.yml']:
    Path(old_path).unlink(missing_ok=True)

print('v2.94 historical final, first-team level and home schedule regressions fixed')
