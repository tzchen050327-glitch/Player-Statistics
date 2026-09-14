from pathlib import Path
import json, re

# --- Scoreboard display rules: do not pre-fill active/future half-innings with zero. ---
p=Path('game-detail-enhancement.js')
s=p.read_text(encoding='utf-8')

anchor="""  function normalizedBoard(detail) {
"""
helper=r"""  function visibleInningCells(detail, values, side, innings, totalRuns) {
    const raw=innings.map((_,i)=>values?.[i] ?? '');
    const status=String(detail?.status||'').toLowerCase();
    if(status==='final') return raw;
    const info=currentHalfInfo(detail);
    if(!info) return raw;

    const last=Array.isArray(detail?.plays)?detail.plays.at(-1):null;
    const currentHalfComplete=!!(last && playMatchesCurrentHalf(detail,last) && inferredOutsAfterPlay(last)>=3);
    const sideHalf=side==='away'?'top':'bottom';
    const numericTotal=Number(totalRuns);
    const priorRuns=raw.reduce((sum,value,index)=>{
      const label=String(innings[index]??index+1);
      const inningNo=Number(label.match(/\d+/)?.[0]||index+1);
      const cell=Number(safeCell(value));
      return inningNo<info.inning && Number.isFinite(cell) ? sum+cell : sum;
    },0);
    const inferredCurrentRuns=Number.isFinite(numericTotal)?Math.max(0,numericTotal-priorRuns):0;

    return raw.map((value,index)=>{
      const label=String(innings[index]??index+1);
      const inningNo=Number(label.match(/\d+/)?.[0]||index+1);
      if(inningNo>info.inning) return '';
      if(inningNo<info.inning) return value;

      // In the current inning, the side that has not batted yet stays blank.
      if(info.half==='top' && sideHalf==='bottom') return '';
      // Once the top half is over and the bottom has begun, the away cell is final.
      if(info.half==='bottom' && sideHalf==='top') return value;

      // Active half-inning: show a score immediately if runs have been recorded,
      // otherwise keep the cell blank until three outs make the zero official.
      const cell=Number(safeCell(value));
      if(Number.isFinite(cell) && cell>0) return value;
      if(inferredCurrentRuns>0) return inferredCurrentRuns;
      return currentHalfComplete ? 0 : '';
    });
  }

"""
if anchor not in s: raise SystemExit('normalizedBoard anchor missing')
s=s.replace(anchor,helper+anchor,1)

old=r"""    const awayRuns = pick(source?.awayTotals?.R, pick(game.awayScore, sum(away) ?? ''));
    const homeRuns = pick(source?.homeTotals?.R, pick(game.homeScore, sum(home) ?? ''));
    return {
      innings, away, home,
      awayTotals:{R:awayRuns,H:pick(source?.awayTotals?.H,''),E:pick(source?.awayTotals?.E,'')},
      homeTotals:{R:homeRuns,H:pick(source?.homeTotals?.H,''),E:pick(source?.homeTotals?.E,'')}
    };
"""
new=r"""    const awayRuns = pick(source?.awayTotals?.R, pick(game.awayScore, sum(away) ?? ''));
    const homeRuns = pick(source?.homeTotals?.R, pick(game.homeScore, sum(home) ?? ''));
    const visibleAway=visibleInningCells(detail,away,'away',innings,awayRuns);
    const visibleHome=visibleInningCells(detail,home,'home',innings,homeRuns);
    return {
      innings, away:visibleAway, home:visibleHome,
      awayTotals:{R:awayRuns,H:pick(source?.awayTotals?.H,''),E:pick(source?.awayTotals?.E,'')},
      homeTotals:{R:homeRuns,H:pick(source?.homeTotals?.H,''),E:pick(source?.homeTotals?.E,'')}
    };
"""
if old not in s: raise SystemExit('normalizedBoard return anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# --- Realtime: treat postgres_changes as the push signal and immediately read the newest published revision. ---
p=Path('cpbl-realtime.js')
s=p.read_text(encoding='utf-8')
s=s.replace("  let watchdogTimer = 0;\n", "  let watchdogTimer = 0;\n  let realtimeSignalSerial = 0;\n",1)

anchor="""  function acceptDayRow(row) {
"""
helper=r"""  async function refreshFromRealtimeSignal(row) {
    const current=watch?{...watch}:null;
    if(!current || !row) return;
    if(String(row.game_id||'')!==current.gameId || String(row.game_date||'')!==current.date) return;
    if(String(row.kind_code||'A').toUpperCase()!==current.kindCode) return;
    const signaledRevision=Number(row.published_revision??-1);
    if(Number.isFinite(signaledRevision) && signaledRevision>=0 && signaledRevision<=lastRevision) return;

    const serial=++realtimeSignalSerial;
    try{
      // The DB UPDATE is the push notification. Read the canonical published row immediately
      // so the UI always receives the newest complete payload for that revision.
      const published=await readPublished(current.date,current.gameId,current.kindCode);
      if(serial!==realtimeSignalSerial || !watch) return;
      if(watch.date!==current.date || watch.gameId!==current.gameId || watch.kindCode!==current.kindCode) return;
      if(published?.row) acceptRow(published.row);
    }catch{}
  }

"""
if anchor not in s: raise SystemExit('acceptDayRow anchor missing')
s=s.replace(anchor,helper+anchor,1)

old="""        }, payload => acceptRow(payload?.new))
"""
new="""        }, payload => { void refreshFromRealtimeSignal(payload?.new); })
"""
if old not in s: raise SystemExit('realtime callback anchor missing')
s=s.replace(old,new,1)

# Reset signal serial whenever a watch is stopped so stale async reads cannot repaint a new game.
s=s.replace("    lastRevision = -1;\n", "    lastRevision = -1;\n    realtimeSignalSerial += 1;\n",1)
p.write_text(s,encoding='utf-8')

# --- Version bump and release retention. ---
for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    q=Path(name)
    if not q.exists(): continue
    x=q.read_text(encoding='utf-8').replace('v3.05','v3.06').replace('v305','v306')
    if name=='service-worker.js': x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v306',x)
    q.write_text(x,encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v3.06'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

for old_path in [
    '.github/scripts/apply_v304.py',
    '.github/scripts/smoke_v304.mjs',
    '.github/workflows/apply-v304.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.06 realtime push refresh and scoreboard zero timing applied')
