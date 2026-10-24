#!/usr/bin/env python3
"""Sync 2026 Panther Cup public rosters via the verified Supabase Edge reader.

The tournament returns HTTP 403 to GitHub-hosted Python runners. The
read-only reader is fixed to the official domain, accepts only 2026 slugs,
and returns parsed player rows; GitHub never downloads raw HTML.
"""
import json
import re
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://blackpanthercup.tw'
READER='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/panther-roster-source-probe'
DATA_FILE=ROOT/'data/black-panther-rosters-2026.json'
REPORT_FILE=ROOT/'data/black-panther-rosters-2026-report.json'
SCHEDULE=(ROOT/'black-panther-2026.html').read_text(encoding='utf-8')
match=re.search(r'const DATA=(\[.*?\]);const VENUES=',SCHEDULE,re.S)
if not match:raise RuntimeError('Cannot find 2026 tournament schedule')
games=json.loads(match.group(1))
TEAM_NAMES=sorted({x[k] for x in games for k in ('home','away')
                   if not re.search(r'勝|晉級|敗|待定|空白',x[k])})
if len(TEAM_NAMES)!=211:raise RuntimeError('Schedule changed: expected 211 distinct teams')
try:
 existing=json.loads(DATA_FILE.read_text(encoding='utf-8'))
except (OSError,ValueError):
 existing={}
session=requests.Session()
session.headers['User-Agent']='DiamondScope-2026-roster-sync/2.0'
def request_reader(params):
 for attempt in range(2):
  try:
   response=session.get(READER,params=params,timeout=38)
   data=response.json()
   if response.status_code==200:return data,None
   return None,{'http_status':response.status_code,'error':str(data.get('error','unknown'))[:250]}
  except (requests.RequestException,ValueError) as exc:
   if attempt==1:return None,{'error':str(exc)[:250]}
   time.sleep(2)
 return None,{'error':'Unknown reader failure'}

def norm(s):
 s=unicodedata.normalize('NFKC',str(s)).replace('臺','台').replace('髙','高')
 replacements=[
  ('高級家事商業職業學校','家商'),('高級工業職業學校','高工'),
  ('高級農工職業學校','農工'),('高級商業職業學校','高商'),
  ('高級商工職業學校','商工'),('高級海事水產職業學校','海事'),
  ('高級中等學校','高中'),('高級中學','高中'),
  ('高級工業家事職業學校','高職'),('高級中等','高中'),
  ('國立',''),('私立',''),('市立',''),('縣立',''),
  ('學校財團法人',''),('財團法人',''),('學校',''),(' ',''),
 ]
 for a,b in replacements:s=s.replace(a,b)
 s=re.sub(r'^(?:台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|南投|澎湖|金門|連江)(?:市|縣)?','',s)
 return s

existing_alias={}
for key,value in existing.items():
 if value.get('scheduleName') and value.get('players'):
  existing_alias[norm(value.get('officialName') or key.split('::')[0])]=value['scheduleName']

def choose_schedule_name(official,region):
 direct=existing_alias.get(norm(official))
 if direct in TEAM_NAMES:return direct
 name=norm(official)
 scored=sorted(((SequenceMatcher(None,name,norm(t)).ratio(),t) for t in TEAM_NAMES),reverse=True)
 perfect=[t for t in TEAM_NAMES if norm(t)==name]
 if len(perfect)==1:return perfect[0]
 if not scored:return None
 top=scored[0]
 if top[0]>=0.82 and (len(scored)==1 or top[0]-scored[1][0]>=0.09):return top[1]
 return None

entries,index_error=request_reader({'type':'index'})
issues=[]
if not entries or not isinstance(entries.get('entries'),list):
 report={'year':2026,'target_teams':211,'complete':False,'blocked':True,
         'reason':'edge_reader_index_unavailable','error':index_error,
         'existing_verified_teams':len(existing),'issues':[]}
 REPORT_FILE.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 raise RuntimeError('Official 2026 roster index unavailable from Edge reader')
regions=entries.get('regions',[])
team_pages=entries['entries']
if any(x.get('status')!=200 for x in regions):
 issues.append({'reason':'region_fetch_failed','regions':regions})
print('2026 official roster links:',len(team_pages),flush=True)
if len(team_pages)<190:raise RuntimeError('Official list unexpectedly small; refusing overwrite')

result=dict(existing)
retrieved=0
skipped=0
for i,entry in enumerate(team_pages,1):
 official=entry['officialName']
 region=entry['region']
 slug=entry['slug']
 key=official+('::女子組' if region=='teams_girl2026' else '')
 if key in result and isinstance(result[key].get('players'),list) and result[key]['players']:
  if result[key].get('scheduleName') is None:
   result[key]['scheduleName']=choose_schedule_name(official,region)
  skipped+=1
  continue
 roster,error=request_reader({'type':'roster','slug':slug})
 if roster and isinstance(roster.get('players'),list) and roster['players']:
  players=[]
  for p in roster['players']:
   if not re.fullmatch(r'\d{1,3}',str(p.get('number',''))) or not p.get('name'):continue
   players.append({'number':str(p['number']),'name':str(p['name']),
                   'position':str(p.get('position','')),
                   'height':p.get('height'),'weight':p.get('weight'),
                   'hand':str(p.get('hand',''))})
  if players:
   result[key]={'source':roster.get('source') or entry['source'],
                'officialName':official,
                'scheduleName':choose_schedule_name(official,region),
                'players':players}
   retrieved+=1
  else:
   issues.append({'team':official,'region':region,'slug':slug,'reason':'parsed_empty'})
 else:
  issues.append({'team':official,'region':region,'slug':slug,'reason':'page_not_parsed','detail':error})
 if i%20==0:print('Checked',i,'/',len(team_pages),'new',retrieved,'preserved',skipped,flush=True)
 time.sleep(0.4)

DATA_FILE.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
mapped={v.get('scheduleName') for v in result.values() if isinstance(v.get('players'),list) and v['players'] and v.get('scheduleName')}
unmapped=[{'team':key,'reason':'schedule_alias_not_found','source':v.get('source')}
          for key,v in result.items() if v.get('players') and not v.get('scheduleName')]
report={'year':2026,'target_teams':211,'official_team_pages':len(team_pages),
        'index_regions':regions,'newly_fetched_teams':retrieved,'reused_verified_teams':skipped,
        'stored_rosters':len(result),'mapped_schedule_names':len(mapped),
        'stored_players':sum(len(x['players']) for x in result.values() if x.get('players')),
        'incomplete_source_links':len(team_pages)<211,'issues':issues,
        'unmapped':unmapped,'missing_teams':sorted(set(TEAM_NAMES)-mapped),
        'complete':len(mapped)>=211 and not issues}
REPORT_FILE.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Saved',len(result),'rosters,',report['stored_players'],'players. Newly fetched:',retrieved,flush=True)
if not report['complete']:
 raise RuntimeError('Panther Cup roster import incomplete; inspect audit and failure reports')
