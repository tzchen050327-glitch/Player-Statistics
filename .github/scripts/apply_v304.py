from pathlib import Path
import json, re

p=Path('game-detail-enhancement.js')
s=p.read_text(encoding='utf-8')

# 1) A real half-inning switch is authoritative: reset outs immediately.
old="""    const sameHalf=playMatchesCurrentHalf(detail,last);
    if(!sameHalf) return direct===null?0:Math.min(2,direct);

    const after=inferredOutsAfterPlay(last);
"""
new="""    const sameHalf=playMatchesCurrentHalf(detail,last);
    // Once the scoreboard has switched half-innings, the new half always starts at 0 outs.
    // Do not carry a lagging CPBL current.outs value across the side change.
    if(!sameHalf) return 0;

    const after=inferredOutsAfterPlay(last);
"""
if old not in s: raise SystemExit('currentOuts half-switch anchor missing')
s=s.replace(old,new,1)

# 2) Reset bases immediately on a CPBL half-inning switch.
old="""    const league=String(detail?.league || '').toUpperCase();
    if (league === 'CPBL' && shouldUseCpblLastAfter(detail,last)) {
"""
new="""    const league=String(detail?.league || '').toUpperCase();
    if (league === 'CPBL' && last && !playMatchesCurrentHalf(detail,last)) return [false,false,false];
    if (league === 'CPBL' && shouldUseCpblLastAfter(detail,last)) {
"""
if old not in s: raise SystemExit('currentBaseState half-switch anchor missing')
s=s.replace(old,new,1)

# 3) Reset runner identities immediately on a CPBL half-inning switch.
old="""    if (String(detail?.status || '').toLowerCase() === 'final' || inferredOutsAfterPlay(last) >= 3) {
      return {first:'',second:'',third:''};
    }
    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
"""
new="""    if (String(detail?.status || '').toLowerCase() === 'final' || inferredOutsAfterPlay(last) >= 3) {
      return {first:'',second:'',third:''};
    }
    if (String(detail?.league||'').toUpperCase()==='CPBL' && last && !playMatchesCurrentHalf(detail,last)) {
      return {first:'',second:'',third:''};
    }
    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
"""
if old not in s: raise SystemExit('currentRunnerNames half-switch anchor missing')
s=s.replace(old,new,1)

# 4) Completed PA -> infer the next batter from the latest lineup / batting order.
anchor="""  function positionKey(value) {
"""
helpers=r"""  function completedPlateAppearance(play) {
    if(!play) return false;
    const result=compactName(`${play?.result||''} ${play?.raw||''}`);
    const desc=compactName(play?.description||'');
    if(!result && !desc) return false;
    return /全壘打|三壘安打|二壘安打|一壘安打|安打|三振|四壞|保送|故意四壞|觸身|死球|失誤上壘|野手選擇|趁傳|雙殺|併殺|三殺|犧牲|犠牲|犠打|犧飛|滾地|ゴロ|飛球|界飛|邪飛|平飛|ライナー|アウト|出局|[一二三游遊左中右投捕](?:飛|直|滾)/i.test(result)
      || /打者[^。]*(?:出局|上壘)|[0-3]\s*人出局|四壞|保送|觸身|死球|安打|全壘打/i.test(desc);
  }

  function currentHalfInfo(detail) {
    const label=String(detail?.game?.inningLabel||'');
    const m=label.match(/(\d+)\s*局?\s*([上下])/);
    if(!m) return null;
    return {inning:Number(m[1]),half:m[2]==='上'?'top':'bottom'};
  }

  function cpblExpectedBatter(detail) {
    if(String(detail?.league||'').toUpperCase()!=='CPBL') return null;
    const info=currentHalfInfo(detail);
    if(!info) return null;
    const side=info.half==='top'?'away':'home';
    const roster=lineupEntries(detail,side);
    if(!roster.length) return null;
    const plays=Array.isArray(detail?.plays)?detail.plays:[];
    const inHalf=plays.filter(p=>Number(p?.inning)===info.inning&&String(p?.half||'')===info.half);
    let anchorPlay=inHalf.at(-1)||null;

    if(anchorPlay){
      if(!completedPlateAppearance(anchorPlay)) return null;
      // Three outs end this offense's half. Do not advance to the same team's next batter.
      if(inferredOutsAfterPlay(anchorPlay)>=3) return null;
    } else {
      // New half-inning: continue this offense's batting order from its previous half-inning.
      anchorPlay=[...plays].reverse().find(p=>String(p?.half||'')===info.half&&Number(p?.inning)<info.inning&&completedPlateAppearance(p))||null;
    }

    let previousOrder=Number(anchorPlay?.battingOrder||0);
    if(!(previousOrder>=1&&previousOrder<=9) && anchorPlay){
      const acnt=String(anchorPlay?.batterAcnt||'').trim();
      const name=compactName(anchorPlay?.batter?.fullName||anchorPlay?.batter?.name||anchorPlay?.batter||anchorPlay?.hitter||'');
      const matched=roster.find(entry=>
        (acnt&&String(entry?.acnt||'').trim()===acnt) || (name&&samePlayerName(entry?.name,name))
      );
      previousOrder=Number(matched?.order||0);
    }
    const nextOrder=previousOrder>=1&&previousOrder<=9 ? (previousOrder%9)+1 : 1;
    const entry=roster.find(player=>Number(player?.order)===nextOrder) || roster[nextOrder-1] || null;
    return entry ? {...entry,inferredFromCompletedPa:true} : null;
  }

  function effectiveCurrentBatter(detail) {
    const official=detail?.current?.batter||{};
    if(String(detail?.league||'').toUpperCase()!=='CPBL') return official;
    const expected=cpblExpectedBatter(detail);
    if(!expected) return official;

    const officialName=compactName(official?.fullName||official?.name||official?.playerName||'');
    if(!officialName) return expected;
    const plays=Array.isArray(detail?.plays)?detail.plays:[];
    const last=plays.at(-1)||null;
    const sameHalf=playMatchesCurrentHalf(detail,last);

    if(sameHalf && completedPlateAppearance(last)){
      const lastName=compactName(last?.batter?.fullName||last?.batter?.name||last?.batter||last?.hitter||'');
      // A completed PA is stronger evidence than a current.batter field that still points at that hitter.
      if(lastName&&samePlayerName(officialName,lastName)) return expected;
      return official;
    }

    if(!sameHalf){
      const offense=currentOffenseSide(detail), defense=offense==='away'?'home':'away';
      const offenseRoster=lineupEntries(detail,offense), defenseRoster=lineupEntries(detail,defense);
      const officialOffense=offenseRoster.find(p=>samePlayerName(p?.name,officialName));
      const officialDefense=defenseRoster.find(p=>samePlayerName(p?.name,officialName));
      if(officialDefense) return expected;
      if(officialOffense){
        return Number(officialOffense?.order)===Number(expected?.order) ? official : expected;
      }
      // Unknown names may be a just-announced pinch hitter not yet reflected in lineup cache.
      return official;
    }
    return official;
  }

"""
if anchor not in s: raise SystemExit('positionKey anchor missing')
s=s.replace(anchor,helpers+anchor,1)

# 5) All current-batter UI paths use the effective (PA-driven) batter.
old="""    const batter=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name)||'等待下一位打者';
"""
new="""    const currentBatter=effectiveCurrentBatter(detail);
    const batter=compactName(currentBatter?.fullName||currentBatter?.name||currentBatter?.playerName)||'等待下一位打者';
"""
if old not in s: raise SystemExit('renderLiveSituation batter anchor missing')
s=s.replace(old,new,1)

old="""    const entries=lineupEntries(detail,side), current=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name||'');
"""
new="""    const effective=effectiveCurrentBatter(detail);
    const entries=lineupEntries(detail,side), current=compactName(effective?.fullName||effective?.name||effective?.playerName||'');
"""
if old not in s: raise SystemExit('renderLineupPanel batter anchor missing')
s=s.replace(old,new,1)

old="""    const current=detail?.current?.batter||{};
    const name=compactName(current.fullName||current.name||current.playerName||'');
"""
new="""    const current=effectiveCurrentBatter(detail);
    const name=compactName(current?.fullName||current?.name||current?.playerName||'');
"""
if old not in s: raise SystemExit('currentBatterPaSummary anchor missing')
s=s.replace(old,new,1)

# Include inferred visual state in the repaint stamp so the UI cannot stay frozen on a stale hitter.
old="""      JSON.stringify(last?.baseStateAfter||{}),JSON.stringify(last?.runnersAfter||{})].map(v=>String(v??'')).join('|');
"""
new="""      JSON.stringify(last?.baseStateAfter||{}),JSON.stringify(last?.runnersAfter||{}),
      effectiveCurrentBatter(detail)?.name||effectiveCurrentBatter(detail)?.fullName||'',currentOuts(detail)].map(v=>String(v??'')).join('|');
"""
if old not in s: raise SystemExit('detailStamp effective-state anchor missing')
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
    x=q.read_text(encoding='utf-8').replace('v3.03','v3.04').replace('v303','v304')
    if name=='service-worker.js': x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v304',x)
    q.write_text(x,encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v3.04'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

for old_path in [
    '.github/scripts/apply_v302.py',
    '.github/scripts/smoke_v302.mjs',
    '.github/workflows/apply-v302.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.04 PA-driven half-inning state and next-batter inference applied')
