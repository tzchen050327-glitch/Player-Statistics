from pathlib import Path
import json, re

p=Path('game-detail-enhancement.js')
s=p.read_text(encoding='utf-8')

old=r"""  function rawRoster(detail, side) {
    const raw = detail?.lineups?.[side];
    const list = Array.isArray(raw?.batters) ? raw.batters : Array.isArray(raw?.order) ? raw.order : Array.isArray(raw) ? raw : [];
    return list.map((entry,index)=>({
      order:Number(entry?.order)||index+1,
      number:safeCell(entry?.number||entry?.uniformNumber||entry?.jersey||''),
      name:compactName(entry?.name||entry?.fullName||entry?.playerName||''),
      position:compactName(entry?.position||entry?.pos||''),
      acnt:safeCell(entry?.acnt||entry?.playerId||entry?.id||''),
      avg:safeCell(entry?.avg??entry?.average??entry?.battingAverage??''),
      hits:Number(entry?.hits??entry?.h??0)||0,
      homeRuns:Number(entry?.homeRuns??entry?.hr??0)||0,
      rbi:Number(entry?.rbi??entry?.rbis??0)||0
    })).filter(x=>x.name);
  }
"""
new=r"""  function numericOrNull(value) {
    if(value===null||value===undefined||value==='') return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  function formatAverage(hits,ab,fallback='') {
    if(Number.isFinite(hits)&&Number.isFinite(ab)&&ab>0) return (hits/ab).toFixed(3).replace(/^0/, '');
    return safeCell(fallback);
  }

  function reconciledBattingStats(detail,entry) {
    const directAb=numericOrNull(entry?.ab??entry?.atBats);
    const directHits=numericOrNull(entry?.hits??entry?.h);
    const directHr=numericOrNull(entry?.homeRuns??entry?.hr);
    const directRbi=numericOrNull(entry?.rbi??entry?.rbis);
    const sourceAvg=safeCell(entry?.avg??entry?.average??entry?.battingAverage??'');

    const isCpbl=String(detail?.league||'').toUpperCase()==='CPBL';
    const isFinal=String(detail?.status||'').toLowerCase()==='final';
    if(!isCpbl||!isFinal){
      return {
        ab:directAb,
        avg:sourceAvg,
        hits:directHits??0,
        homeRuns:directHr??0,
        rbi:directRbi??0,
        finalStatsReconciled:false
      };
    }

    const gameAb=numericOrNull(entry?.gameAb);
    const gameHits=numericOrNull(entry?.gameHits);
    const gameHr=numericOrNull(entry?.gameHomeRuns);
    const gameRbi=numericOrNull(entry?.gameRbi);
    const pregameAb=numericOrNull(entry?.pregameAb);

    // CPBL final payloads can revert season totals to the pregame snapshot while
    // preserving gameAb/gameHits/gameHomeRuns/gameRbi. Re-apply the game line so
    // the landscape lineup does not lose statistics after the game becomes final.
    // If explicit pregameAb exists and the season AB is already beyond it, assume
    // the source already incorporated the game and do not double-add.
    const shouldAddGame = gameAb!==null && (pregameAb===null || directAb===null || directAb<=pregameAb);
    if(!shouldAddGame){
      return {
        ab:directAb,
        avg:sourceAvg,
        hits:directHits??0,
        homeRuns:directHr??0,
        rbi:directRbi??0,
        finalStatsReconciled:false
      };
    }

    const ab=(directAb??0)+(gameAb??0);
    const hits=(directHits??0)+(gameHits??0);
    const homeRuns=(directHr??0)+(gameHr??0);
    const rbi=(directRbi??0)+(gameRbi??0);
    return {
      ab,
      avg:formatAverage(hits,ab,sourceAvg),
      hits,
      homeRuns,
      rbi,
      finalStatsReconciled:true
    };
  }

  function rawRoster(detail, side) {
    const raw = detail?.lineups?.[side];
    const list = Array.isArray(raw?.batters) ? raw.batters : Array.isArray(raw?.order) ? raw.order : Array.isArray(raw) ? raw : [];
    return list.map((entry,index)=>{
      const stats=reconciledBattingStats(detail,entry);
      return {
        order:Number(entry?.order)||index+1,
        number:safeCell(entry?.number||entry?.uniformNumber||entry?.jersey||''),
        name:compactName(entry?.name||entry?.fullName||entry?.playerName||''),
        position:compactName(entry?.position||entry?.pos||''),
        acnt:safeCell(entry?.acnt||entry?.playerId||entry?.id||''),
        ab:stats.ab,
        avg:stats.avg,
        hits:stats.hits,
        homeRuns:stats.homeRuns,
        rbi:stats.rbi,
        finalStatsReconciled:stats.finalStatsReconciled
      };
    }).filter(x=>x.name);
  }
"""
if old not in s: raise SystemExit('rawRoster anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    q=Path(name)
    if not q.exists(): continue
    x=q.read_text(encoding='utf-8').replace('v3.06','v3.07').replace('v306','v307')
    if name=='service-worker.js': x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v307',x)
    q.write_text(x,encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v3.07'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

for old_path in [
    '.github/scripts/apply_v305.py',
    '.github/scripts/smoke_v305.mjs',
    '.github/workflows/apply-v305.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.07 CPBL final batting totals reconciliation applied')
