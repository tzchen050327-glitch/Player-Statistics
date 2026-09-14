from pathlib import Path
import json, re

p=Path('game-detail-enhancement.js')
s=p.read_text(encoding='utf-8')

old_infer = r"""    if (/三人出局|3\s*出局/i.test(text)) return 3;
    // A hit can contain words such as '高飛球' in its description; that is not an out.
    if (/全壘打|三壘安打|二壘安打|一壘安打|安打|四壞|故意四壞|觸身|死球|失誤上壘|野手選擇|趁傳上壘/i.test(resultText)) return before;
    let added = 0;
    if (/三殺|トリプルプレー/i.test(resultText)) added = 3;
    else if (/雙殺|併殺|ダブルプレー|DP\b/i.test(resultText)) added = 2;
    else if (/三振|ゴロ|滾地|一滾|二滾|三滾|游滾|遊滾|投滾|捕滾|フライ|飛球|界飛|ライナー|平飛|犧牲|犠牲|犠打|犧飛|アウト|出局/i.test(resultText)) added = 1;
    else if (/打者[^。]*(刺殺|接殺|封殺|出局)/i.test(description)) added = 1;
    return Math.min(3, before + added);
"""
new_infer = r"""    if (/三人出局|3\s*出局/i.test(text)) return 3;
    // A hit can contain words such as '高飛球' in its description; that is not an out.
    if (/全壘打|三壘安打|二壘安打|一壘安打|安打|四壞|故意四壞|觸身|死球|失誤上壘|野手選擇|趁傳上壘/i.test(resultText)) return before;
    let added = 0;
    if (/三殺|トリプルプレー/i.test(resultText)) added = 3;
    else if (/雙殺|併殺|ダブルプレー|DP\b/i.test(resultText)) added = 2;
    else if (/三振|ゴロ|滾地|一滾|二滾|三滾|游滾|遊滾|投滾|捕滾|フライ|飛球|界飛|邪飛|ライナー|平飛|犧牲|犠牲|犠打|犧飛|アウト|出局|[一二三游遊左中右投捕](?:飛|直)/i.test(resultText)) added = 1;
    else if (/打者[^。]*(刺殺|接殺|封殺|出局)/i.test(description)) added = 1;
    return Math.min(3, before + added);
"""
if old_infer not in s: raise SystemExit('inferredOuts anchor missing')
s=s.replace(old_infer,new_infer,1)

old_current = r"""  function currentOuts(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    const after = inferredOutsAfterPlay(last);
    if (String(detail?.status || '').toLowerCase() === 'final') return 3;
    if (after >= 3) return 3;
    const direct = parseOutNumber(detail?.current?.outs);
    if (direct !== null) return Math.min(2, direct);
    return after;
  }
"""
new_current = r"""  function playMatchesCurrentHalf(detail,play) {
    if(!play) return false;
    const label=String(detail?.game?.inningLabel||'');
    const m=label.match(/(\d+)\s*局?\s*([上下])/);
    if(!m) return true;
    const inning=Number(m[1]);
    const half=m[2]==='上'?'top':'bottom';
    return Number(play?.inning)===inning && String(play?.half||'')===half;
  }

  function currentOuts(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    if (String(detail?.status || '').toLowerCase() === 'final') return 3;
    const direct = parseOutNumber(detail?.current?.outs);
    const sameHalf=playMatchesCurrentHalf(detail,last);
    if(!sameHalf) return direct===null?0:Math.min(2,direct);

    const after=inferredOutsAfterPlay(last);
    // CPBL current.outs can lag one completed PA behind. Within the same half-inning,
    // never let that stale value overwrite the official completed-PA out count.
    if(after>=3) return 3;
    if(direct!==null) return Math.min(2,Math.max(direct,after));
    return Math.min(2,after);
  }
"""
if old_current not in s: raise SystemExit('currentOuts anchor missing')
s=s.replace(old_current,new_current,1)
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
    x=q.read_text(encoding='utf-8').replace('v3.02','v3.03').replace('v302','v303')
    if name=='service-worker.js': x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v303',x)
    q.write_text(x,encoding='utf-8')
Path('version.json').write_text(json.dumps({'version':'v3.03'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

for old_path in [
    '.github/scripts/apply_v301.py',
    '.github/scripts/smoke_v301.mjs',
    '.github/workflows/apply-v301.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.03 CPBL live outs synchronization applied')
