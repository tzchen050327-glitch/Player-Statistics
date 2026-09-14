from pathlib import Path
import json, re

p = Path('game-detail-enhancement.js')
s = p.read_text(encoding='utf-8')

old_state = """    const keyOf=base=>base==='一壘'?'first':base==='二壘'?'second':'third';
    const destOf=text=>/一壘/.test(text)?'first':/二壘/.test(text)?'second':/三壘/.test(text)?'third':'';
    const stateForPlay=play=>normalizeBaseState(
      play?.baseStateBefore ?? play?.basesBefore ?? play?.baseState ?? play?.bases ?? ''
    );
"""
new_state = """    const keyOf=base=>base==='一壘'?'first':base==='二壘'?'second':'third';
    const destOf=text=>/一壘/.test(text)?'first':/二壘/.test(text)?'second':/三壘/.test(text)?'third':'';
    const league=String(detail?.league||'').toUpperCase();
    // CPBL baseState is the official situation BEFORE this plate appearance.
    // NPB keeps using the explicit before-state fields when available.
    const stateForPlay=play=>normalizeBaseState(
      league==='CPBL'
        ? (play?.baseState ?? play?.bases ?? play?.baseStateBefore ?? play?.basesBefore ?? '')
        : (play?.baseStateBefore ?? play?.basesBefore ?? play?.baseState ?? play?.bases ?? '')
    );
"""
if old_state not in s:
    raise SystemExit('runner stateForPlay anchor missing')
s = s.replace(old_state, new_state, 1)

old_after = """      const nextPlay=plays[i+1];
      const sameHalf=nextPlay&&Number(nextPlay?.inning)===Number(play?.inning)&&nextPlay?.half===play?.half;
      const league=String(detail?.league||'').toUpperCase();
      const officialAfter=league==='CPBL' && (play?.baseState!==undefined || play?.basesAfter!==undefined)
        ? normalizeBaseState(play?.baseState ?? play?.basesAfter ?? '')
        : sameHalf ? stateForPlay(nextPlay) : null;
"""
new_after = """      const nextPlay=plays[i+1];
      const sameHalf=nextPlay&&Number(nextPlay?.inning)===Number(play?.inning)&&nextPlay?.half===play?.half;
      // For CPBL, the next PA's official pre-PA state is this PA's authoritative after-state.
      // This fixes the old off-by-one interpretation that lost runner identities.
      const officialAfter=sameHalf ? stateForPlay(nextPlay) : null;
"""
if old_after not in s:
    raise SystemExit('runner officialAfter anchor missing')
s = s.replace(old_after, new_after, 1)

old_current = """    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
    return {first:direct.first||inferred.first,second:direct.second||inferred.second,third:direct.third||inferred.third};
"""
new_current = """    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
    const merged={first:direct.first||inferred.first,second:direct.second||inferred.second,third:direct.third||inferred.third};
    const hasOfficialState=detail?.current?.baseState!==undefined&&detail?.current?.baseState!==null
      || (detail?.current?.bases!==undefined&&detail?.current?.bases!==null&&String(detail.current.bases).trim()!=='');
    if(!hasOfficialState) return merged;
    const state=normalizeBaseState(detail?.current?.baseState ?? detail?.current?.bases ?? '');
    return {first:state.first?merged.first:'',second:state.second?merged.second:'',third:state.third?merged.third:''};
"""
if old_current not in s:
    raise SystemExit('currentRunnerNames anchor missing')
s = s.replace(old_current, new_current, 1)
p.write_text(s, encoding='utf-8')

# Formal version bump.
for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    q=Path(name)
    if not q.exists():
        continue
    x=q.read_text(encoding='utf-8').replace('v2.99','v3.00').replace('v299','v300')
    if name=='service-worker.js':
        x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v300',x)
    q.write_text(x,encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v3.00'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

# Keep only current + immediately previous release artifacts.
for old_path in [
    '.github/scripts/apply_v298.py',
    '.github/scripts/smoke_v298.mjs',
    '.github/workflows/apply-v298.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.00 CPBL runner-name semantics applied')
