from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version/config
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.18';" not in s:
    raise SystemExit('expected v2.18')
s = s.replace("const APP_VERSION = 'v2.18';", "const APP_VERSION = 'v2.19';", 1)
s = s.replace('?v=v2.18', '?v=v2.19')
p.write_text(s, encoding='utf-8')

# Do not show the CPBL pre-game 0:0 placeholders as real scores.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = """          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const awayScore = homeDailyGameScore(game?.awayScore);
          const homeScore = homeDailyGameScore(game?.homeScore);
"""
new = """          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const showScore = status === 'live' || status === 'final';
          const awayScore = showScore ? homeDailyGameScore(game?.awayScore) : '—';
          const homeScore = showScore ? homeDailyGameScore(game?.homeScore) : '—';
"""
if s.count(old) != 1:
    raise SystemExit('score rendering anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Compact the scoreboard substantially, especially on phone widths.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
compact = r'''

/* v2.19 compact homepage daily games */
.home-daily-games{margin:10px 0 12px}
.home-daily-games-shell{border-radius:16px;padding:10px 11px 8px}
.home-daily-games-head{gap:9px;margin-bottom:7px}
.home-daily-games-title{gap:7px}
.home-daily-games-title strong{font-size:17px}
.home-daily-games-title span{font-size:11px}
.home-daily-games-meta{gap:7px;font-size:11px}
.home-games-scroller{grid-auto-columns:minmax(176px,205px);gap:8px;padding:1px 1px 5px}
.home-games-scroller.is-mlb{grid-auto-columns:minmax(174px,198px)}
.home-game-card{min-height:101px;border-radius:13px;padding:8px 10px 7px}
.home-game-card-top{min-height:20px;margin-bottom:2px}
.home-game-status{min-height:20px;padding:0 7px;font-size:10px}
.home-game-time{font-size:10px}
.home-game-team{gap:7px;padding:2px 0}
.home-game-team-name{font-size:12px}
.home-game-score{min-width:23px;font-size:19px}
.home-game-venue{margin-top:3px;padding-top:5px;font-size:10px}
.home-games-state{min-height:58px;padding:12px;font-size:12px}

@media (max-width:600px){
  .home-daily-games{margin:8px 0 10px}
  .home-daily-games-shell{padding:9px 9px 7px;border-radius:15px}
  .home-daily-games-head{margin-bottom:6px}
  .home-daily-games-title strong{font-size:16px}
  .home-daily-games-title span{font-size:10px}
  .home-daily-games-meta{font-size:10px;gap:6px}
  .home-games-scroller,.home-games-scroller.is-mlb{grid-auto-columns:minmax(170px,188px);gap:7px;padding-bottom:4px}
  .home-game-card{min-height:94px;padding:7px 9px 6px}
  .home-game-card-top{min-height:18px;margin-bottom:1px}
  .home-game-status{min-height:18px;padding:0 6px;font-size:9px}
  .home-game-team{padding:1px 0}
  .home-game-team-name{font-size:12px}
  .home-game-score{font-size:18px}
  .home-game-venue{padding-top:4px;font-size:9px}
}
'''
if '/* v2.19 compact homepage daily games */' not in s:
    s += compact
p.write_text(s, encoding='utf-8')

# HTML / archive
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.18', 'v2.19')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.19.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.17.html'
if old_archive.exists():
    old_archive.unlink()

# service worker cache bust
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v135", "baseball-player-card-pwa-v136", 1)
s = s.replace('v2.18', 'v2.19')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.19 compact daily games patch applied')
