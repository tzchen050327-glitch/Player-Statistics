from pathlib import Path
import re

# 1) Internal version + endpoint config
p = Path('js/00-core-config.js')
s = p.read_text(encoding='utf-8')
s = s.replace("const APP_VERSION = 'v2.40';", "const APP_VERSION = 'v2.41';", 1)
s = s.replace("./assets/default-hitter.jpg?v=v2.40", "./assets/default-hitter.jpg?v=v2.41")
s = s.replace("./assets/default-pitcher.jpg?v=v2.40", "./assets/default-pitcher.jpg?v=v2.41")
needle = "const NPB_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-live-games';\n"
if "NPB_PREGAME_STARTERS_API_URL" not in s:
    assert needle in s
    s = s.replace(needle, needle + "    const NPB_PREGAME_STARTERS_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-pregame-starters';\n", 1)
p.write_text(s, encoding='utf-8')

# 2) NPB pregame uses the dedicated, corrected parser
p = Path('js/11-home-international.js')
s = p.read_text(encoding='utf-8')
old = """    async function pregameStarterRequest(league, date, game) {
      const endpoint = new URL(LEAGUE_GAME_DETAIL_API_URL);
      endpoint.pathname = endpoint.pathname.replace(/\\/[^/]+$/, '/pregame-starters');
      const response = await fetch(endpoint.toString(), {
"""
new = """    async function pregameStarterRequest(league, date, game) {
      const endpoint = league === 'NPB'
        ? NPB_PREGAME_STARTERS_API_URL
        : (() => {
            const url = new URL(LEAGUE_GAME_DETAIL_API_URL);
            url.pathname = url.pathname.replace(/\\/[^/]+$/, '/pregame-starters');
            return url.toString();
          })();
      const response = await fetch(endpoint, {
"""
assert old in s, 'pregameStarterRequest pattern missing'
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 3) Pregame starter layout: always left/right, stats flow vertically downward
p = Path('game-detail-enhancement.css')
s = p.read_text(encoding='utf-8')
start = s.index('/* ===== PREGAME STARTER CARDS ===== */')
end_marker = '/* ===== PREGAME STARTER CARDS END ===== */'
end = s.index(end_marker, start) + len(end_marker)
block = r'''/* ===== PREGAME STARTER CARDS ===== */
.game-detail-pregame-section{margin-top:16px;}
.game-detail-pregame-title{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.game-detail-pregame-title>div{display:flex;align-items:baseline;gap:8px;min-width:0;}
.game-detail-pregame-title span{color:#7a8898;font-size:12px;font-weight:700;white-space:nowrap;}
.game-detail-pregame-refresh{border:1px solid #d4dee8;border-radius:999px;background:#fff;color:#28547f;padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer;}
.game-detail-pregame-refresh:disabled{opacity:.55;cursor:default;}
.game-detail-starter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;align-items:stretch;}
.game-detail-starter-card{min-width:0;padding:14px;border:1px solid #dce5ee;border-radius:16px;background:linear-gradient(180deg,#fff,#f8fbfe);box-shadow:0 8px 22px rgba(28,53,87,.05);}
.game-detail-starter-card.is-empty{display:flex;min-height:210px;flex-direction:column;justify-content:center;align-items:center;text-align:center;}
.game-detail-starter-team{color:#60758a;font-size:12px;font-weight:900;letter-spacing:.02em;line-height:1.35;min-height:32px;}
.game-detail-starter-name{margin-top:4px;color:#133f69;font-size:21px;font-weight:900;line-height:1.25;word-break:keep-all;overflow-wrap:anywhere;}
.game-detail-starter-meta{margin-top:5px;color:#8190a0;font-size:11px;font-weight:700;min-height:16px;}
.game-detail-starter-stats{display:grid;grid-template-columns:1fr;gap:5px;margin-top:12px;}
.game-detail-starter-stats>div{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border:1px solid #e2e9f0;border-radius:9px;background:#fff;text-align:left;}
.game-detail-starter-stats span{display:block;color:#8290a0;font-size:10px;font-weight:800;white-space:nowrap;}
.game-detail-starter-stats strong{display:block;margin:0;color:#153e65;font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;}
.game-detail-starter-empty{margin-top:6px;color:#8593a2;font-size:14px;font-weight:800;}
.game-detail-starter-no-stats{margin-top:14px;color:#8996a5;font-size:12px;font-weight:700;}
.game-detail-pregame-note{margin-top:9px;color:#8290a0;font-size:12px;line-height:1.5;text-align:center;}
.game-detail-pregame-note.error{color:#b44b4b;}
@media(max-width:640px){
  .game-detail-starter-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
  .game-detail-starter-card{padding:10px 8px;border-radius:13px;}
  .game-detail-starter-team{font-size:10px;min-height:28px;}
  .game-detail-starter-name{font-size:17px;}
  .game-detail-starter-meta{font-size:9px;}
  .game-detail-starter-stats{gap:4px;margin-top:9px;}
  .game-detail-starter-stats>div{padding:6px 7px;gap:5px;}
  .game-detail-starter-stats span{font-size:9px;}
  .game-detail-starter-stats strong{font-size:12px;}
  .game-detail-pregame-title>div{display:block;}
  .game-detail-pregame-title span{display:block;margin-top:2px;}
  .game-detail-pregame-refresh{padding:5px 9px;font-size:11px;}
}
/* ===== PREGAME STARTER CARDS END ===== */'''
s = s[:start] + block + s[end:]
p.write_text(s, encoding='utf-8')

# 4) External/visible version + asset cache busting
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('content="v2.40"', 'content="v2.41"', 1)
s = s.replace('>v2.40</button>', '>v2.41</button>', 1)
s = re.sub(r'v2\.40-ui\d+', 'v2.41-ui1', s)
p.write_text(s, encoding='utf-8')

p = Path('service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"baseball-player-card-pwa-v240-stable-\d+", 'baseball-player-card-pwa-v241-stable-1', s)
s = re.sub(r'v2\.40-ui\d+', 'v2.41-ui1', s)
p.write_text(s, encoding='utf-8')
