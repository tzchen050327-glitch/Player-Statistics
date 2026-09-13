from pathlib import Path
import re

runtime = [
    'app.js','index.html','styles.css','game-detail-enhancement.css',
    'game-detail-enhancement.js','live-static-update.js',
    'cpbl-cache-router.js','service-worker.js','rescue.html',
    'report-layout.css','report-layout.js','cpbl-realtime.js'
]

for name in runtime:
    p = Path(name)
    if not p.exists():
        continue
    s = p.read_text(encoding='utf-8')
    s = s.replace('v2.54','v2.55').replace('v254','v255').replace('V254','V255')
    p.write_text(s, encoding='utf-8')

p = Path('game-detail-enhancement.js')
s = p.read_text(encoding='utf-8')

# CPBL batting order: LiveLogJson.BattingOrder restarts inside innings, so rebuild
# the fixed 1-9 batting slots from each team's full plate-appearance sequence.
pat = r"  function lineupEntries\(detail, side\) \{.*?\n  \}\n\n  function positionKey"
replacement = r'''  function lineupEntries(detail, side) {
    const raw = detail?.lineups?.[side] || {};
    const source = [
      ...(Array.isArray(raw?.roster) ? raw.roster : []),
      ...(Array.isArray(raw?.batters) ? raw.batters : [])
    ];
    const normalize = (entry, index=0) => ({
      order:Number(entry?.order)||index+1,
      number:safeCell(entry?.number||entry?.uniformNumber||entry?.jersey||''),
      name:compactName(entry?.name||entry?.fullName||entry?.playerName||''),
      position:compactName(entry?.position||entry?.pos||''),
      acnt:safeCell(entry?.acnt||entry?.playerId||entry?.id||''),
      avg:safeCell(entry?.avg??entry?.average??entry?.battingAverage??''),
      hits:Number(entry?.hits??entry?.h??0)||0,
      homeRuns:Number(entry?.homeRuns??entry?.hr??0)||0,
      rbi:Number(entry?.rbi??entry?.rbis??0)||0
    });
    const byId = new Map(), byName = new Map();
    source.forEach((entry,index) => {
      const p = normalize(entry,index), id = String(p.acnt||''), name = compactName(p.name);
      if (id) byId.set(id, { ...(byId.get(id)||{}), ...p });
      if (name) byName.set(normName(name), { ...(byName.get(normName(name))||{}), ...p });
    });
    const player = (name, acnt='') => {
      const n = compactName(name), id = String(acnt||'');
      return { ...((id && byId.get(id)) || byName.get(normName(n)) || {}), acnt:id || ((id && byId.get(id))?.acnt||''), name:n || ((id && byId.get(id))?.name||'') };
    };
    const realPA = play => {
      const d = String(play?.description||'');
      if (!d) return !!String(play?.result||play?.raw||'').trim();
      const hasChange = /更換(?:代打|代跑|選手|守備|投手)/.test(d);
      const hasAction = /(好球|壞球|揮棒|擊出|打者出局|安打|四壞|故意四壞|觸身|死球|三振|雙殺|三殺|犧牲|犧短|犧飛|失誤|趁傳|全壘打|野手選擇|飛球|滾地球)/.test(d);
      return !(hasChange && !hasAction);
    };
    const cleanSubName = value => {
      let text = compactName(value).replace(/[()（）]/g,'');
      const role = '(?:投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|指定打擊|DH|代打|代跑)';
      text = text.replace(new RegExp(`^${role}[-：:]?`),'').replace(new RegExp(`[-：:]?${role}$`),'');
      return text.replace(/^-+|-+$/g,'').trim();
    };
    const parseSubs = value => {
      const out = [], re = /更換(?:代打|代跑|選手)：([^。]+?)=>([^。]+)/g, text = String(value||'');
      let m;
      while ((m = re.exec(text))) {
        const from = cleanSubName(m[1]), to = cleanSubName(m[2]);
        if (from && to && from !== to) out.push({from,to});
      }
      return out;
    };

    const wantedHalf = side === 'away' ? 'top' : 'bottom';
    const plays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(play => play?.half === wantedHalf);
    const slots = new Map(), nameToSlot = new Map();
    let nextSlot = 1;

    for (const play of plays) {
      for (const change of parseSubs(play?.description)) {
        const slot = nameToSlot.get(normName(change.from));
        if (!slot) continue;
        const repl = player(change.to);
        repl.order = slot;
        slots.set(slot, repl);
        nameToSlot.set(normName(change.to), slot);
      }
      if (!realPA(play)) continue;
      const slot = nextSlot;
      nextSlot = slot === 9 ? 1 : slot + 1;
      const p = player(play?.batter || play?.hitter || '', play?.batterAcnt || '');
      p.order = slot;
      slots.set(slot, p);
      if (p.name) nameToSlot.set(normName(p.name), slot);
    }

    const fallback = rawRoster(detail,side).sort((a,b)=>(Number(a.order)||99)-(Number(b.order)||99));
    const used = new Set([...slots.values()].map(p=>String(p.acnt||'') || `N:${normName(p.name)}`));
    for (const p of fallback) {
      const key = String(p.acnt||'') || `N:${normName(p.name)}`;
      if (used.has(key)) continue;
      let slot = 0;
      for (let i=1;i<=9;i++) if (!slots.has(i)) { slot=i; break; }
      if (!slot) break;
      slots.set(slot, {...p, order:slot});
      used.add(key);
    }
    return Array.from({length:9},(_,i)=>slots.get(i+1)).filter(Boolean);
  }

  function positionKey'''
s, n = re.subn(pat, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('lineupEntries patch failed')

old = '''    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    const isCpbl=String(detail?.league||'').toUpperCase()==='CPBL';
    if (!isCpbl) {
      document.body.classList.remove('gdx-cpbl-landscape');
      body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
      if (body) delete body.dataset.gdxStamp;
      return;
    }
    document.body.classList.add('gdx-cpbl-landscape');
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
'''
new = '''    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    const league=String(detail?.league||'').toUpperCase(), isCpbl=league==='CPBL', isNpb=league==='NPB';
    if (!isCpbl && !isNpb) {
      document.body.classList.remove('gdx-cpbl-landscape');
      body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
      return;
    }
    document.body.classList.toggle('gdx-cpbl-landscape',isCpbl);
    if (!isCpbl) body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
'''
if old not in s:
    raise SystemExit('enhance league gate target not found')
s = s.replace(old,new,1)

old = '''    const portrait=body.querySelector('.game-detail-content');
    const landscapeHtml=renderLandscapeBoard(detail,board);
    if (body.querySelector('[data-gdx="landscape"]')) patchOrReplace(body,'[data-gdx="landscape"]',landscapeHtml,detail);
    else if (portrait) portrait.insertAdjacentHTML('beforebegin',landscapeHtml);

    const status=String(detail.status||'').toLowerCase();
    let live=body.querySelector('[data-gdx="live"]');
    if (status==='live') {
      const liveHtml=renderLiveSituation(detail);
      if (live) patchOrReplace(body,'[data-gdx="live"]',liveHtml,detail);
      else scoreCard.insertAdjacentHTML('afterend',liveHtml);
    } else if (live) live.remove();
'''
new = '''    const portrait=body.querySelector('.game-detail-content');
    if (isCpbl) {
      const landscapeHtml=renderLandscapeBoard(detail,board);
      if (body.querySelector('[data-gdx="landscape"]')) patchOrReplace(body,'[data-gdx="landscape"]',landscapeHtml,detail);
      else if (portrait) portrait.insertAdjacentHTML('beforebegin',landscapeHtml);
    } else {
      body.querySelector('[data-gdx="landscape"]')?.remove();
    }

    const status=String(detail.status||'').toLowerCase();
    let live=body.querySelector('[data-gdx="live"]');
    if (isCpbl && status==='live') {
      const liveHtml=renderLiveSituation(detail);
      if (live) patchOrReplace(body,'[data-gdx="live"]',liveHtml,detail);
      else scoreCard.insertAdjacentHTML('afterend',liveHtml);
    } else if (live) live.remove();
'''
if old not in s:
    raise SystemExit('landscape/live block target not found')
s = s.replace(old,new,1)

p.write_text(s, encoding='utf-8')

# v2.55 guardrails
for name in runtime:
    p = Path(name)
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8')
    if 'v2.54' in text or 'v254' in text or 'V254' in text:
        raise SystemExit(f'old version token remains: {name}')

if "const APP_VERSION = 'v2.55';" not in Path('app.js').read_text(encoding='utf-8'):
    raise SystemExit('APP_VERSION is not v2.55')
if 'cpbl-realtime.js?v=v2.55' not in Path('index.html').read_text(encoding='utf-8'):
    raise SystemExit('index resources are not v2.55')
