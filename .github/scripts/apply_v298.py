from pathlib import Path
import json, re


def sub_once(text, pattern, repl, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    return out

# --- NPB base occupancy + runner-name reconstruction in the shared game-detail enhancer ---
p = Path('game-detail-enhancement.js')
s = p.read_text(encoding='utf-8')

normalize_new = r'''  function normalizeBaseState(value) {
    if (Array.isArray(value)) return { first: !!value[0], second: !!value[1], third: !!value[2] };
    if (value && typeof value === 'object') return {
      first: !!(value.first ?? value[1] ?? value.base1),
      second: !!(value.second ?? value[2] ?? value.base2),
      third: !!(value.third ?? value[3] ?? value.base3)
    };
    const raw = String(value || '').normalize('NFKC');
    const loaded = /滿壘|満塁|bases\s*loaded/i.test(raw);
    const numbered = n => new RegExp(`(?:^|[^0-9])${n}(?=[^0-9]|$)`).test(raw);
    return {
      first: loaded || /一壘|一塁|first/i.test(raw) || numbered(1),
      second: loaded || /二壘|二塁|second/i.test(raw) || numbered(2),
      third: loaded || /三壘|三塁|third/i.test(raw) || numbered(3)
    };
  }'''
s = sub_once(
    s,
    r"  function normalizeBaseState\(value\) \{.*?\n  \}",
    normalize_new,
    'normalizeBaseState',
    re.S,
)

current_base_new = r'''  function currentBaseState(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    const status = String(detail?.status || '').toLowerCase();
    if (status === 'final' || inferredOutsAfterPlay(last) >= 3) return [false,false,false];
    if (String(detail?.league || '').toUpperCase() === 'NPB') {
      const inferred = inferRunnerNames(detail);
      if (inferred.first || inferred.second || inferred.third) {
        return [!!inferred.first, !!inferred.second, !!inferred.third];
      }
      if (detail?.current?.bases !== undefined && detail?.current?.bases !== null) return detail.current.bases;
    }
    if (detail?.current?.baseState) return detail.current.baseState;
    if (detail?.current?.bases) return detail.current.bases;
    return last?.baseState || last?.basesAfter || last?.bases || '';
  }'''
s = sub_once(
    s,
    r"  function currentBaseState\(detail\) \{.*?\n  \}",
    current_base_new,
    'currentBaseState',
    re.S,
)

infer_new = r'''  function inferRunnerNames(detail) {
    const offense=currentOffenseSide(detail), wantedHalf=offense==='away'?'top':'bottom';
    const gameInning=Number(String(detail?.game?.inningLabel||'').match(/(\d+)/)?.[1]||0);
    const plays=(Array.isArray(detail?.plays)?detail.plays:[]).filter(p=>p?.half===wantedHalf&&(!gameInning||Number(p?.inning)===gameInning));
    let runners={first:'',second:'',third:''};
    const keys=['first','second','third'];
    const rank={first:1,second:2,third:3};
    const keyOf=base=>base==='一壘'?'first':base==='二壘'?'second':'third';
    const destOf=text=>/一壘/.test(text)?'first':/二壘/.test(text)?'second':/三壘/.test(text)?'third':'';
    const stateForPlay=play=>normalizeBaseState(
      play?.baseStateBefore ?? play?.basesBefore ?? play?.baseState ?? play?.bases ?? ''
    );
    const reconcileBefore=state=>{
      for(const key of keys) if(!state[key]) runners[key]='';
    };
    const destination=(result,desc)=>{
      const text=`${result||''} ${desc||''}`;
      if(/全壘打|全塁打|ホームラン|home\s*run/i.test(text)) return 'home';
      if(/三壘安打|三塁打|スリーベース|triple/i.test(text)) return 'third';
      if(/二壘安打|二塁打|ツーベース|double/i.test(text)) return 'second';
      if(/一壘安打|安打|ヒット|四壞|四球|フォアボール|故意四壞|敬遠|觸身|死球|デッドボール|失誤上壘|野手選擇/i.test(text) || /趁傳上壘|打者[^。]*上壘/.test(desc||'')) return 'first';
      return '';
    };
    const heuristicAfter=(before,dest,result,play)=>{
      let after={first:!!before.first,second:!!before.second,third:!!before.third};
      if(inferredOutsAfterPlay(play)>=3 || dest==='home') return {first:false,second:false,third:false};
      if(dest==='third') return {first:false,second:false,third:true};
      if(dest==='second') return {first:false,second:true,third:!!before.first};
      if(dest==='first') {
        const walk=/四壞|四球|フォアボール|故意四壞|敬遠|觸身|死球|デッドボール/i.test(result||'');
        if(walk){
          if(before.first){
            if(before.second) after.third=true;
            after.second=true;
          }
          after.first=true;
          return after;
        }
        return {first:true,second:!!before.first,third:!!before.second};
      }
      if(/犧牲短打|犠打|sacrifice\s*bunt/i.test(result||'')) {
        return {first:false,second:!!before.first,third:!!before.second || !!before.third};
      }
      return after;
    };
    const assignToState=(after,batter,dest)=>{
      const old={...runners};
      const next={first:'',second:'',third:''};
      if(dest==='home'){ runners=next; return; }
      if(dest && after[dest] && batter) next[dest]=batter;
      const oldRunners=[['third',old.third],['second',old.second],['first',old.first]].filter(([,name])=>!!name);
      for(const [from,name] of oldRunners){
        const candidates=keys
          .filter(key=>after[key]&&!next[key]&&rank[key]>=rank[from])
          .sort((a,b)=>rank[b]-rank[a]);
        if(candidates.length) next[candidates[0]]=name;
      }
      runners=next;
    };
    for(let i=0;i<plays.length;i++){
      const play=plays[i];
      const desc=compactName(play?.description||'');
      const batter=compactName(play?.batter||play?.hitter||'');
      const result=`${play?.result||''} ${play?.raw||''}`;
      const before=stateForPlay(play);
      reconcileBefore(before);

      for(const m of desc.matchAll(/更換代跑[:：]\s*([^=〉>。]+?)\s*(?:=>|→|〉)\s*([^，。\s]+)/g)){
        const from=compactName(m[1]),to=compactName(m[2]);
        for(const k of keys) if(runners[k]===from) runners[k]=to;
      }
      for(const m of desc.matchAll(/(一壘|二壘|三壘)跑者\s*([^\s，。-]+?)\s*(上(?:一壘|二壘|三壘)|回本壘(?:得分)?|出局)/g)){
        const from=keyOf(m[1]),name=compactName(m[2]),action=m[3];
        if(runners[from]===name||!runners[from]) runners[from]='';
        if(/^上/.test(action)){
          const to=destOf(action);
          if(to) runners[to]=name;
        }
      }

      const nextPlay=plays[i+1];
      const sameHalf=nextPlay&&Number(nextPlay?.inning)===Number(play?.inning)&&nextPlay?.half===play?.half;
      const league=String(detail?.league||'').toUpperCase();
      const officialAfter=league==='CPBL' && (play?.baseState!==undefined || play?.basesAfter!==undefined)
        ? normalizeBaseState(play?.baseState ?? play?.basesAfter ?? '')
        : sameHalf ? stateForPlay(nextPlay) : null;
      const dest=destination(result,desc);
      const after=officialAfter || heuristicAfter(before,dest,result,play);
      assignToState(after,batter,dest);

      if(inferredOutsAfterPlay(play)>=3) runners={first:'',second:'',third:''};
    }
    return runners;
  }'''
s = sub_once(
    s,
    r"  function inferRunnerNames\(detail\) \{.*?\n  \}\n\n  function currentRunnerNames",
    infer_new + "\n\n  function currentRunnerNames",
    'inferRunnerNames',
    re.S,
)

# Make base-only changes part of the enhancement stamp so a same-batter update still repaints.
s = s.replace(
    "JSON.stringify(detail?.current?.runners||{}),last?.inning,last?.half,last?.batter,last?.pitcher,last?.result,last?.bases,last?.rbi]",
    "JSON.stringify(detail?.current?.runners||{}),JSON.stringify(detail?.current?.baseState||{}),detail?.current?.bases,last?.inning,last?.half,last?.batter,last?.pitcher,last?.result,last?.bases,last?.rbi]",
    1,
)
p.write_text(s, encoding='utf-8')

# --- Realtime watchdogs: keep push, but verify the published revision every 12s. ---
def patch_realtime(path, league):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    s = re.sub(r"const VERSION = 'v[^']+';", "const VERSION = 'v2.98';", s, count=1)
    if 'let watchdogTimer = 0;' not in s:
        s = s.replace('  let loader = null;\n', '  let loader = null;\n  let watchdogTimer = 0;\n', 1)

    marker = f'  window.__{league.lower()}RealtimeReadPublished = readPublished;\n'
    if marker not in s:
        raise SystemExit(f'{path}: readPublished marker missing')

    if league == 'NPB':
        watchdog = r'''

  async function readRevision(date, gameId) {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return null;
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      select:'game_date,game_id,status,published_revision,published_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/npb_live_game_cache?${query}`, {
      headers:{ apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function stopWatchdog() {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = 0;
  }

  function startWatchdog() {
    stopWatchdog();
    watchdogTimer = setInterval(async () => {
      const current = watch ? { ...watch } : null;
      if (!current || document.visibilityState !== 'visible') return;
      try {
        const meta = await readRevision(current.date, current.gameId);
        if (!meta || !watch || watch.date !== current.date || watch.gameId !== current.gameId) return;
        const revision = Number(meta.published_revision ?? -1);
        if (!Number.isFinite(revision) || revision <= lastRevision) return;
        const published = await readPublished(current.date, current.gameId);
        if (published?.row && watch && watch.date === current.date && watch.gameId === current.gameId) acceptRow(published.row);
      } catch {}
    }, 12000);
  }'''
    else:
        watchdog = r'''

  async function readRevision(date, gameId, kindCode = 'A') {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    const kind = String(kindCode || 'A').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return null;
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      kind_code:`eq.${kind}`,
      select:'game_date,game_id,kind_code,status,published_revision,published_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cpbl_live_game_cache?${query}`, {
      headers:{ apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function stopWatchdog() {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = 0;
  }

  function startWatchdog() {
    stopWatchdog();
    watchdogTimer = setInterval(async () => {
      const current = watch ? { ...watch } : null;
      if (!current || document.visibilityState !== 'visible') return;
      try {
        const meta = await readRevision(current.date, current.gameId, current.kindCode);
        if (!meta || !watch || watch.date !== current.date || watch.gameId !== current.gameId || watch.kindCode !== current.kindCode) return;
        const revision = Number(meta.published_revision ?? -1);
        if (!Number.isFinite(revision) || revision <= lastRevision) return;
        const published = await readPublished(current.date, current.gameId, current.kindCode);
        if (published?.row && watch && watch.date === current.date && watch.gameId === current.gameId && watch.kindCode === current.kindCode) acceptRow(published.row);
      } catch {}
    }, 12000);
  }'''

    if 'async function readRevision(' not in s:
        s = s.replace(marker, marker + watchdog + '\n', 1)

    s = s.replace(
        "  async function stopWatch(emit = true) {\n    const old = channel;",
        "  async function stopWatch(emit = true) {\n    stopWatchdog();\n    const old = channel;",
        1,
    )
    if league == 'NPB':
        anchor = "      const initial = await readPublished(date, gameId);\n      if (initial?.row) acceptRow(initial.row);"
    else:
        anchor = "      const initial = await readPublished(date, gameId, kindCode);\n      if (initial?.row) acceptRow(initial.row);"
    if anchor not in s:
        raise SystemExit(f'{path}: startWatch anchor missing')
    s = s.replace(anchor, anchor + "\n      if (watch) startWatchdog();", 1)
    p.write_text(s, encoding='utf-8')

patch_realtime('npb-realtime.js', 'NPB')
patch_realtime('cpbl-realtime.js', 'CPBL')

# Formal v2.98 release/cache bump.
for name in [
    'app.js', 'index.html', 'styles.css', 'cpbl-realtime.js', 'npb-realtime.js',
    'service-worker.js', 'diagnostics.html', 'game-detail-enhancement.js',
    'game-detail-enhancement.css', 'report-layout.js', 'report-layout.css',
    'postseason-history.js', 'landscape-state.js', 'landscape-state.css',
    'cpbl-cache-router.js', 'live-static-update.js'
]:
    q = Path(name)
    if not q.exists():
        continue
    x = q.read_text(encoding='utf-8').replace('v2.97', 'v2.98').replace('v297', 'v298')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v298', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(
    json.dumps({'version': 'v2.98'}, ensure_ascii=False, separators=(',', ':')) + '\n',
    encoding='utf-8'
)

# Keep only current + immediately previous formal release artifacts.
for old_path in [
    '.github/scripts/apply_v296.py',
    '.github/scripts/smoke_v296.mjs',
    '.github/workflows/apply-v296.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v2.98 NPB runner/base fixes + CPBL/NPB realtime watchdog patch applied')
