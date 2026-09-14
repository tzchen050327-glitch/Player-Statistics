from pathlib import Path
import json, re

p = Path('postseason-history.js')
s = p.read_text(encoding='utf-8')

s = s.replace(
"  const API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/postseason-history';\n",
"  const API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/postseason-history';\n  const DAILY_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';\n",
1)
s = s.replace(
"  const historyInflight = new Map();\n",
"  const historyInflight = new Map();\n  const historyExpiryTimers = new Map();\n  const nextGamePolicyCache = new Map();\n",
1)

old = """  async function readPersistentHistory(key, year) {
    try {
      const db = await openHistoryDb();
      if (!db) return null;
      const row = await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readonly');
        const req = tx.objectStore(HISTORY_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!row || row.schema !== HISTORY_CACHE_SCHEMA || !row.data) return null;
      // Finished seasons are immutable for this UI. Current season stays refreshable.
      if (Number(year) < CURRENT_YEAR) return row.data;
      if (Date.now() - Number(row.at || 0) <= 10 * 60 * 1000) return row.data;
      return null;
    } catch {
      return null;
    }
  }

  async function writePersistentHistory(key, year, data) {
    try {
      const db = await openHistoryDb();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readwrite');
        tx.objectStore(HISTORY_STORE).put({ key, year:Number(year), at:Date.now(), schema:HISTORY_CACHE_SCHEMA, data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {}
  }
"""
new = """  function armHistoryExpiry(key, cacheUntil) {
    const prior = historyExpiryTimers.get(key);
    if (prior) clearTimeout(prior);
    historyExpiryTimers.delete(key);
    if (!Number.isFinite(Number(cacheUntil))) return;
    const delay = Number(cacheUntil) - Date.now();
    if (delay <= 0) {
      historyCache.delete(key);
      return;
    }
    const timer = setTimeout(() => {
      historyCache.delete(key);
      historyExpiryTimers.delete(key);
    }, Math.min(delay + 250, 2147483000));
    historyExpiryTimers.set(key, timer);
  }

  async function readPersistentHistory(key, year) {
    try {
      const db = await openHistoryDb();
      if (!db) return null;
      const row = await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readonly');
        const req = tx.objectStore(HISTORY_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!row || row.schema !== HISTORY_CACHE_SCHEMA || !row.data) return null;
      // Finished seasons never need another official fetch unless the cache schema changes.
      if (Number(year) < CURRENT_YEAR) return { data:row.data, cacheUntil:Infinity };
      // Current-season data stays local until one hour before the next team game.
      const cacheUntil = Date.parse(String(row.cacheUntil || ''));
      if (Number.isFinite(cacheUntil) && cacheUntil > Date.now()) return { data:row.data, cacheUntil };
      return null;
    } catch {
      return null;
    }
  }

  async function writePersistentHistory(key, year, data, policy = {}) {
    try {
      const db = await openHistoryDb();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readwrite');
        tx.objectStore(HISTORY_STORE).put({
          key,
          year:Number(year),
          at:Date.now(),
          schema:HISTORY_CACHE_SCHEMA,
          cacheUntil:policy?.cacheUntil || null,
          nextGameAt:policy?.nextGameAt || null,
          cacheMode:policy?.mode || (Number(year) < CURRENT_YEAR ? 'immutable' : ''),
          data
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {}
  }

  function scheduleTeamName(player, league) {
    if (!player) return '';
    return String(league === 'CPBL' ? (player.cpblTeam || '') : (player.externalTeam || '')).trim();
  }

  function normalizeScheduleTeam(value) {
    let s = String(value || '').normalize('NFKC').replace(/[・･·.\\s]/g, '').toLowerCase();
    const aliases = [
      ['統一7-eleven獅','統一獅'],
      ['福岡ソフトバンクホークス','軟銀鷹'],['福岡軟銀鷹','軟銀鷹'],['ソフトバンク','軟銀鷹'],
      ['千葉ロッテマリーンズ','羅德海洋'],['ロッテ','羅德海洋'],
      ['読売ジャイアンツ','讀賣巨人'],['巨人','讀賣巨人'],
      ['阪神タイガース','阪神虎'],['横浜denaベイスターズ','橫濱dena'],
      ['東京ヤクルトスワローズ','養樂多燕子'],['中日ドラゴンズ','中日龍'],
      ['広島東洋カープ','廣島鯉魚'],['北海道日本ハムファイターズ','日本火腿'],
      ['東北楽天ゴールデンイーグルス','樂天金鷲'],['オリックス・バファローズ','歐力士猛牛'],
      ['埼玉西武ライオンズ','西武獅']
    ];
    for (const [from,to] of aliases) s = s.replace(from,to);
    return s;
  }

  function sameScheduleTeam(a, b) {
    const x = normalizeScheduleTeam(a), y = normalizeScheduleTeam(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  }

  function leagueToday(league) {
    const timeZone = league === 'NPB' ? 'Asia/Tokyo' : 'Asia/Taipei';
    return new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  }

  function addIsoDays(iso, days) {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0,10);
  }

  function gameStartMs(league, date, game) {
    const m = String(game?.time || '').match(/(\\d{1,2}):(\\d{2})/);
    if (!m) return NaN;
    const offset = league === 'NPB' ? '+09:00' : '+08:00';
    return Date.parse(`${date}T${String(m[1]).padStart(2,'0')}:${m[2]}:00${offset}`);
  }

  function policyStorageKey(league, team) {
    return `next-game-cache-v1:${league}:${encodeURIComponent(normalizeScheduleTeam(team))}`;
  }

  function readStoredPolicy(league, team) {
    try {
      const raw = localStorage.getItem(policyStorageKey(league, team));
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || Number(value.recheckAt || 0) <= Date.now()) return null;
      return value;
    } catch { return null; }
  }

  function writeStoredPolicy(league, team, value) {
    try { localStorage.setItem(policyStorageKey(league, team), JSON.stringify(value)); } catch {}
  }

  async function fetchDailySchedule(league, date) {
    const response = await fetch(DAILY_GAMES_API_URL, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ appKey:APP_KEY, action:'daily-games', league, date })
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `schedule HTTP ${response.status}`);
    return Array.isArray(data.games) ? data.games : [];
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
    const today = leagueToday(league);
    let policy = null;
    for (let day = 0; day < 7 && !policy; day += 1) {
      const date = addIsoDays(today, day);
      let games = [];
      try { games = await fetchDailySchedule(league, date); }
      catch (error) { console.warn(`下一場賽程 ${league} ${date} 讀取失敗`, error); continue; }
      const matches = games.filter(game => sameScheduleTeam(game?.away, team) || sameScheduleTeam(game?.home, team));
      for (const game of matches) {
        const status = String(game?.status || '').toLowerCase();
        if (status === 'live' || status === 'suspended') {
          policy = { mode:'supabase-live', cacheUntil:new Date(now).toISOString(), nextGameAt:null, recheckAt:now + 2*60*1000 };
          break;
        }
        if (status === 'final' || status === 'cancelled' || status === 'postponed') continue;
        const start = gameStartMs(league, date, game);
        if (!Number.isFinite(start) || start <= now) continue;
        const takeover = start - 60*60*1000;
        policy = {
          mode: takeover > now ? 'local-until-tminus-1h' : 'supabase-pregame',
          cacheUntil:new Date(Math.max(now, takeover)).toISOString(),
          nextGameAt:new Date(start).toISOString(),
          recheckAt: takeover > now ? takeover : now + 2*60*1000
        };
        break;
      }
    }
    if (!policy) policy = { mode:'no-game-next-7d', cacheUntil:new Date(now+24*60*60*1000).toISOString(), nextGameAt:null, recheckAt:now+24*60*60*1000 };
    nextGamePolicyCache.set(memKey, policy);
    writeStoredPolicy(league, team, policy);
    return policy;
  }
"""
if old not in s:
    raise SystemExit('persistent history block not found')
s = s.replace(old, new, 1)

old_req = """  async function requestHistory(ctx, league, year) {
    const key = historyKey(ctx, league, year);
    if (historyCache.has(key)) return historyCache.get(key);
    if (historyInflight.has(key)) return historyInflight.get(key);

    const player = ctx.player;
    const request = (async () => {
      const stored = await readPersistentHistory(key, year);
      if (stored) {
        historyCache.set(key, stored);
        return stored;
      }

      const response = await fetch(API_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          appKey:APP_KEY,
          action:'player-history',
          league,
          year,
          playerId:playerIdFor(player, league),
          playerName:playerNameFor(player)
        })
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      historyCache.set(key, data);
      void writePersistentHistory(key, year, data);
      return data;
    })().finally(() => historyInflight.delete(key));

    historyInflight.set(key, request);
    return request;
  }
"""
new_req = """  async function requestHistory(ctx, league, year) {
    const key = historyKey(ctx, league, year);
    if (historyCache.has(key)) return historyCache.get(key);
    if (historyInflight.has(key)) return historyInflight.get(key);

    const player = ctx.player;
    const request = (async () => {
      const stored = await readPersistentHistory(key, year);
      if (stored?.data) {
        historyCache.set(key, stored.data);
        armHistoryExpiry(key, stored.cacheUntil);
        return stored.data;
      }

      const response = await fetch(API_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          appKey:APP_KEY,
          action:'player-history',
          league,
          year,
          playerId:playerIdFor(player, league),
          playerName:playerNameFor(player)
        })
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);

      let policy = { mode:'immutable', cacheUntil:null, nextGameAt:null };
      if (Number(year) === CURRENT_YEAR) policy = await currentSeasonCachePolicy(ctx, league);
      historyCache.set(key, data);
      if (Number(year) === CURRENT_YEAR) armHistoryExpiry(key, Date.parse(String(policy.cacheUntil || '')));
      void writePersistentHistory(key, year, data, policy);
      return data;
    })().finally(() => historyInflight.delete(key));

    historyInflight.set(key, request);
    return request;
  }
"""
if old_req not in s:
    raise SystemExit('requestHistory block not found')
s = s.replace(old_req, new_req, 1)

p.write_text(s, encoding='utf-8')

# Version bump is separate from the v2.83 scoreboard correction.
for name in ['app.js','index.html','service-worker.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.83','v2.84').replace('v283','v284')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v284', s)
    p.write_text(s, encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v2.84'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.84 patch applied')
