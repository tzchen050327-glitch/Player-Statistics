from pathlib import Path
import json, re

# --- app.js: shared daily cache + D game detail ---
p = Path('app.js')
s = p.read_text(encoding='utf-8')

anchor = "    const CPBL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-client';\n"
insert = anchor + "    const CPBL_DAILY_CACHE_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-daily-cache';\n"
if 'CPBL_DAILY_CACHE_API_URL' not in s:
    if anchor not in s: raise SystemExit('CPBL_API_URL anchor missing')
    s = s.replace(anchor, insert, 1)

anchor = "    const CPBL_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-game-detail';\n"
insert = anchor + "    const CPBL_MINOR_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-minor-game-detail';\n"
if 'CPBL_MINOR_GAME_DETAIL_API_URL' not in s:
    if anchor not in s: raise SystemExit('CPBL_GAME_DETAIL_API_URL anchor missing')
    s = s.replace(anchor, insert, 1)

old = """      const requestKindCode = String(payload?.kindCode || '').toUpperCase();
      const requestUrl = action === 'daily' && ['E','C'].includes(requestKindCode)
        ? CPBL_POSTSEASON_DAILY_API_URL
        : CPBL_API_URL;
"""
new = """      const requestKindCode = String(payload?.kindCode || 'A').toUpperCase();
      const requestUrl = action === 'daily' && ['E','C'].includes(requestKindCode)
        ? CPBL_POSTSEASON_DAILY_API_URL
        : action === 'daily' && ['A','D'].includes(requestKindCode)
          ? CPBL_DAILY_CACHE_API_URL
          : CPBL_API_URL;
"""
if old not in s: raise SystemExit('cpblRequest routing anchor missing')
s = s.replace(old, new, 1)

old = """      const detailApiUrl = league === 'CPBL'
        ? (cpblKindCode === 'E' || cpblKindCode === 'C' ? CPBL_POSTSEASON_DETAIL_API_URL : CPBL_GAME_DETAIL_API_URL)
        : league === 'NPB'
"""
new = """      const detailApiUrl = league === 'CPBL'
        ? (cpblKindCode === 'D'
            ? CPBL_MINOR_GAME_DETAIL_API_URL
            : (cpblKindCode === 'E' || cpblKindCode === 'C' ? CPBL_POSTSEASON_DETAIL_API_URL : CPBL_GAME_DETAIL_API_URL))
        : league === 'NPB'
"""
if old not in s: raise SystemExit('leagueGameDetailRequest routing anchor missing')
s = s.replace(old, new, 1)

# --- postseason-history.js: current team, candidate signature, one next-game request ---
p2 = Path('postseason-history.js')
h = p2.read_text(encoding='utf-8')
if 'validYearsSignatureCache' not in h:
    h = h.replace('  const validYearsCache = new Map();\n', '  const validYearsCache = new Map();\n  const validYearsSignatureCache = new Map();\n', 1)

old = """  function scheduleTeamName(player, league) {
    if (!player) return '';
    return String(league === 'CPBL' ? (player.cpblTeam || '') : (player.externalTeam || '')).trim();
  }
"""
new = """  function scheduleTeamName(player, league) {
    if (!player) return '';
    return String(league === 'CPBL'
      ? (player.cpblTeam || '')
      : (player.externalCurrentTeam || player.externalTeam || '')).trim();
  }
"""
if old not in h: raise SystemExit('scheduleTeamName anchor missing')
h = h.replace(old, new, 1)

# Replace daily scanning helper with a single backend next-game lookup.
pattern = re.compile(r"  async function fetchDailySchedule\(league, date\) \{.*?\n  \}\n\n  async function currentSeasonCachePolicy\(ctx, league\) \{.*?\n  \}\n\n  const esc =", re.S)
replacement = """  async function fetchNextGameSchedule(league, team) {
    const response = await fetch(DAILY_GAMES_API_URL, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        appKey:APP_KEY,
        action:'next-game',
        league,
        team,
        ...(league === 'CPBL' ? { kindCodes:['A','E','C'] } : {})
      })
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `next-game HTTP ${response.status}`);
    return data?.nextGame || null;
  }

  async function currentSeasonCachePolicy(ctx, league) {
    const team = scheduleTeamName(ctx?.player, league);
    if (!team) return { mode:'schedule-unknown', cacheUntil:new Date(Date.now()+6*60*60*1000).toISOString(), nextGameAt:null };
    const memKey = `${league}|${normalizeScheduleTeam(team)}`;
    const mem = nextGamePolicyCache.get(memKey);
    if (mem && Number(mem.recheckAt || 0) > Date.now()) return mem;
    const stored = readStoredPolicy(league, team);
    if (stored) {
      nextGamePolicyCache.set(memKey, stored);
      return stored;
    }

    const now = Date.now();
    let game = null;
    try { game = await fetchNextGameSchedule(league, team); }
    catch (error) { console.warn(`下一場賽程 ${league} ${team} 讀取失敗`, error); }

    let policy = null;
    if (game) {
      const status = String(game?.status || '').toLowerCase();
      if (status === 'live' || status === 'suspended') {
        policy = { mode:'supabase-live', cacheUntil:new Date(now).toISOString(), nextGameAt:game?.nextGameAt || null, recheckAt:now + 2*60*1000 };
      } else if (!['final','cancelled','postponed'].includes(status)) {
        let start = Date.parse(String(game?.nextGameAt || ''));
        if (!Number.isFinite(start)) start = gameStartMs(league, String(game?.date || leagueToday(league)), game);
        if (Number.isFinite(start) && start > now) {
          const takeover = start - 60*60*1000;
          policy = {
            mode: takeover > now ? 'local-until-tminus-1h' : 'supabase-pregame',
            cacheUntil:new Date(Math.max(now, takeover)).toISOString(),
            nextGameAt:new Date(start).toISOString(),
            recheckAt: takeover > now ? takeover : now + 2*60*1000
          };
        }
      }
    }
    if (!policy) policy = { mode:'no-upcoming-game', cacheUntil:new Date(now+24*60*60*1000).toISOString(), nextGameAt:null, recheckAt:now+24*60*60*1000 };
    nextGamePolicyCache.set(memKey, policy);
    writeStoredPolicy(league, team, policy);
    return policy;
  }

  const esc ="""
h2, count = pattern.subn(replacement, h, count=1)
if count != 1: raise SystemExit('next-game policy block replacement failed')
h = h2

# Candidate signature invalidates postseason-year cache when career years expand.
needle = """    if (!candidates.length) {
      if (!background) applyYearOptions(ctx, league, []);
      return { year:0, failures:[] };
    }

    if (validYearsCache.has(key)) {
"""
repl = """    if (!candidates.length) {
      if (!background) applyYearOptions(ctx, league, []);
      return { year:0, failures:[] };
    }

    const candidateSignature = candidates.join(',');
    if (validYearsCache.has(key) && validYearsSignatureCache.get(key) !== candidateSignature) {
      validYearsCache.delete(key);
      validYearsSignatureCache.delete(key);
      scanPromises.delete(key);
    }

    if (validYearsCache.has(key)) {
"""
if needle not in h: raise SystemExit('validYears read anchor missing')
h = h.replace(needle, repl, 1)

needle = """          validYearsCache.set(key, result.years);
          return result;
"""
repl = """          validYearsCache.set(key, result.years);
          validYearsSignatureCache.set(key, candidateSignature);
          return result;
"""
if needle not in h: raise SystemExit('validYears write anchor missing')
h = h.replace(needle, repl, 1)

needle = """          validYearsCache.delete(key);
          scanPromises.delete(key);
"""
repl = """          validYearsCache.delete(key);
          validYearsSignatureCache.delete(key);
          scanPromises.delete(key);
"""
if needle not in h: raise SystemExit('validYears retry anchor missing')
h = h.replace(needle, repl, 1)

p2.write_text(h, encoding='utf-8')

# Version bump all web shell references.
s = s.replace("const APP_VERSION = 'v2.87';", "const APP_VERSION = 'v2.88';", 1)
s = s.replace('v2.87','v2.88').replace('v287','v288')
Path('app.js').write_text(s, encoding='utf-8')

for name in ['index.html','service-worker.js']:
    q = Path(name)
    x = q.read_text(encoding='utf-8').replace('v2.87','v2.88').replace('v287','v288')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v288', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.88'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.88 patch applied')
