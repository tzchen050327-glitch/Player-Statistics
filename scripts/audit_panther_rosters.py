#!/usr/bin/env python3
"""Audit the 211 unique team names used by the 2026 Panther Cup schedule.

Read only repository files so this report works even when the official
website denies automated traffic (HTTP 403).
"""
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'black-panther-2026.html').read_text(encoding='utf-8')
schedule_match=re.search(r'const DATA=(\[.*?\]);const VENUES=',HTML,re.S)
embedded_match=re.search(r'const ROSTERS_2026=(\{.*?\});\s*const rosterFor',HTML,re.S)
if not schedule_match or not embedded_match:
 raise RuntimeError('Missing schedule or embedded rosters in frontend')
games=json.loads(schedule_match.group(1))
embedded=json.loads(embedded_match.group(1))
expected=sorted({g[k] for g in games for k in ('home','away')
                 if not re.search(r'勝|晉級|敗|待定|空白',g[k])})
if len(expected)!=211:
 raise RuntimeError(f'Expected 211 distinct schedule team names, found {len(expected)}')

roster_file=ROOT/'data'/'black-panther-rosters-2026.json'
imported=json.loads(roster_file.read_text(encoding='utf-8'))
all_rosters={**embedded}
all_rosters.update(imported)
matched={}
for team,entry in all_rosters.items():
 if not isinstance(entry,dict) or not isinstance(entry.get('players'),list) or not entry['players']:
  continue
 alias=entry.get('scheduleName') or (team if team in expected else None)
 if alias in expected:
  if alias not in matched or len(entry['players'])>len(matched[alias]['players']):
   matched[alias]={'officialName':entry.get('officialName',team),
                   'players':entry['players'],
                   'count':len(entry['players']),
                   'source':entry.get('source')}
missing=[{'team':team,'reason':'no_nonempty_roster_mapped_to_schedule'} for team in expected if team not in matched]
unmatched=[{'officialName':key,'scheduleName':entry.get('scheduleName'),
            'player_count':len(entry.get('players') or [])}
 for key,entry in imported.items()
 if isinstance(entry,dict) and entry.get('players') and entry.get('scheduleName') not in expected]
report={
 'year':2026,'target_unique_schedule_teams':len(expected),
 'verified_unique_teams':len(matched),
 'verified_players':sum(entry['count'] for entry in matched.values()),
 'missing_count':len(missing),
 'missing_teams':missing,
 'unmatched_imported_teams':unmatched,
 'complete':not missing,
 'note':'Unique schedule team names are counted here. Women/open rosters with the same school name require separate verification.'
}
path=ROOT/'data'/'black-panther-rosters-2026-audit.json'
path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"Verified {len(matched)}/{len(expected)} unique schedule names; missing {len(missing)}",flush=True)
