from pathlib import Path
import re, json

# postseason-history.js: prefetch all valid season payloads and preserve competition on detail open.
p = Path('postseason-history.js')
s = p.read_text(encoding='utf-8')

old_prefetch = """  window.__prefetchPostseasonContext = async () => {
    const ctx = getContext();
    if (!ctx?.player) return { years:[], failures:[] };
    const league = showAvailability(ctx);
    if (!league) return { years:[], failures:[] };
    rememberCandidateYears(ctx, league);
    const key = playerKey(ctx, league);
    const result = await preparePostseasonYears(ctx, league, { background:true });
    return { years:(validYearsCache.get(key) || []).slice(), failures:result?.failures || [] };
  };
"""
new_prefetch = """  window.__prefetchPostseasonContext = async () => {
    const ctx = getContext();
    if (!ctx?.player) return { years:[], failures:[], cached:0 };
    const league = showAvailability(ctx);
    if (!league) return { years:[], failures:[], cached:0 };
    rememberCandidateYears(ctx, league);
    const key = playerKey(ctx, league);
    const result = await preparePostseasonYears(ctx, league, { background:true });
    const years = (validYearsCache.get(key) || []).slice();
    const failures = [...(result?.failures || [])];

    // The first player-page progress pass warms the complete postseason payload,
    // not just the year list. Finished seasons will then come from IndexedDB.
    let cursor = 0;
    let cached = 0;
    const worker = async () => {
      while (cursor < years.length) {
        const year = years[cursor++];
        try {
          await requestHistory(ctx, league, year);
          cached += 1;
        } catch (error) {
          console.warn(`季後賽 ${year} 預抓失敗`, error);
          if (!failures.includes(year)) failures.push(year);
        }
      }
    };
    await Promise.all(Array.from({ length:Math.min(3, years.length) }, () => worker()));
    return { years, failures, cached };
  };
"""
if old_prefetch not in s:
    raise SystemExit('prefetch block not found')
s = s.replace(old_prefetch, new_prefetch, 1)

old_event = "window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game:{...game,status:'final'}, league:data.league, date:game.date, postseason:true } }));"
new_event = "window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game:{...game,status:'final',competition:comp.key,competitionLabel:comp.label}, league:data.league, date:game.date, postseason:true } }));"
if old_event not in s:
    raise SystemExit('postseason open event anchor not found')
s = s.replace(old_event, new_event, 1)
p.write_text(s, encoding='utf-8')

# app.js: preserve postseason competition context and show how many payloads were cached.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = """      if (league === 'NPB' && String(data?.status || '').toLowerCase() === 'scheduled'
          && Array.isArray(data?.plays) && data.plays.length > 0) {
        data.status = 'final';
        if (data.game && typeof data.game === 'object') data.game.status = 'final';
      }
      return data;
"""
new = """      if (league === 'NPB' && String(data?.status || '').toLowerCase() === 'scheduled'
          && Array.isArray(data?.plays) && data.plays.length > 0) {
        data.status = 'final';
        if (data.game && typeof data.game === 'object') data.game.status = 'final';
      }
      // A postseason card already knows its exact stage. Keep that context even if
      // an old NPB page contains generic navigation text for other competitions.
      if (game?.competition) {
        data.competition = String(game.competition);
        data.competitionLabel = String(game.competitionLabel || data.competitionLabel || '');
        if (data.game && typeof data.game === 'object') {
          data.game.competition = data.competition;
          data.game.competitionLabel = data.competitionLabel;
        }
      }
      return data;
"""
if old not in s:
    raise SystemExit('detail normalization anchor not found')
s = s.replace(old, new, 1)

old2 = """          const postseason = await window.__prefetchPostseasonContext();
          const count = Array.isArray(postseason?.years) ? postseason.years.length : 0;
          if (count) setSyncProgress(98, `季後賽 ${count} 個賽季已快取`);
"""
new2 = """          const postseason = await window.__prefetchPostseasonContext();
          const count = Array.isArray(postseason?.years) ? postseason.years.length : 0;
          const cached = Number(postseason?.cached || 0);
          if (count) setSyncProgress(98, `季後賽 ${cached || count}/${count} 個賽季資料已快取`);
"""
if old2 not in s:
    raise SystemExit('progress postseason anchor not found')
s = s.replace(old2, new2, 1)
s = s.replace('v2.81','v2.82')
p.write_text(s, encoding='utf-8')

for name in ['index.html','service-worker.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.81','v2.82').replace('v281','v282')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v282', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.82'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.82 patch applied')
