from pathlib import Path
import json, re

p=Path('game-detail-enhancement.js')
s=p.read_text(encoding='utf-8')

old=r"""    let previousOrder=Number(anchorPlay?.battingOrder||0);
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
"""
new=r"""    if(!anchorPlay) return roster.find(player=>Number(player?.order)===1) || roster[0] || null;

    // IMPORTANT: CPBL play.battingOrder is the ordinal PA number inside the current
    // half-inning, not the player's fixed lineup slot. Never use it to advance the lineup.
    const acnt=String(anchorPlay?.batterAcnt||'').trim();
    const name=compactName(anchorPlay?.batter?.fullName||anchorPlay?.batter?.name||anchorPlay?.batter||anchorPlay?.hitter||'');
    const matched=roster.find(entry=>
      (acnt&&String(entry?.acnt||'').trim()===acnt) || (name&&samePlayerName(entry?.name,name))
    );
    if(!matched) return null;

    const previousOrder=Number(matched?.order||0);
    if(!(previousOrder>=1&&previousOrder<=9)) return null;
    const nextOrder=(previousOrder%9)+1;
    const entry=roster.find(player=>Number(player?.order)===nextOrder) || null;
    return entry ? {...entry,inferredFromCompletedPa:true,previousLineupOrder:previousOrder} : null;
"""
if old not in s: raise SystemExit('cpblExpectedBatter order anchor missing')
s=s.replace(old,new,1)

old=r"""    if(sameHalf && completedPlateAppearance(last)){
      const lastName=compactName(last?.batter?.fullName||last?.batter?.name||last?.batter||last?.hitter||'');
      // A completed PA is stronger evidence than a current.batter field that still points at that hitter.
      if(lastName&&samePlayerName(officialName,lastName)) return expected;
      return official;
    }
"""
new=r"""    if(sameHalf && completedPlateAppearance(last)){
      const lastName=compactName(last?.batter?.fullName||last?.batter?.name||last?.batter||last?.hitter||'');
      const offense=currentOffenseSide(detail);
      const offenseRoster=lineupEntries(detail,offense);
      const officialEntry=offenseRoster.find(p=>samePlayerName(p?.name,officialName));

      // A completed PA defines exactly one next lineup slot. Keep that inferred hitter
      // stable until CPBL current.batter catches up; this prevents visual 2->4->2 bouncing.
      if(lastName&&samePlayerName(officialName,lastName)) return expected;
      if(officialEntry && Number(officialEntry?.order)===Number(expected?.order)) return official;
      if(!officialEntry) {
        // A name not present in the latest lineup can be a just-announced pinch hitter.
        return official;
      }
      return expected;
    }
"""
if old not in s: raise SystemExit('effectiveCurrentBatter same-half anchor missing')
s=s.replace(old,new,1)

# Make the comment explicit so this regression is easy to audit later.
s=s.replace('Completed PA -> infer the next batter from the latest lineup / batting order.',
            'Completed PA -> infer the next batter from the latest lineup only (never CPBL play.battingOrder).')

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
    x=q.read_text(encoding='utf-8').replace('v3.04','v3.05').replace('v304','v305')
    if name=='service-worker.js': x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v305',x)
    q.write_text(x,encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v3.05'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

for old_path in [
    '.github/scripts/apply_v303.py',
    '.github/scripts/smoke_v303.mjs',
    '.github/workflows/apply-v303.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.05 CPBL lineup-order next batter inference applied')
