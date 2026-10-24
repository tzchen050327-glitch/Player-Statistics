#!/usr/bin/env python3
"""Fetch verified 2026 Panther Cup roster rows from the tournament's region/team pages."""
import json,re,time,unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin,urlparse,unquote
import requests
from bs4 import BeautifulSoup
from difflib import SequenceMatcher

BASE='https://blackpanthercup.tw'
REGIONS=['teams_north2026','teams_central2026','teams_south2026','teams_east2026','teams_girl2026']
root=Path(__file__).resolve().parents[1]
html=(root/'black-panther-2026.html').read_text(encoding='utf8')
raw=re.search(r'const DATA=(\[.*?\]);const VENUES=',html,re.S)
if not raw: raise RuntimeError('Unable to locate existing schedule teams')
matches=json.loads(raw.group(1))
teams=sorted({x[k] for x in matches for k in ('home','away') if '勝' not in x[k] and '晉級' not in x[k]})
def norm(s):
 s=unicodedata.normalize('NFKC',str(s)).replace('臺','台').replace('髙','高')
 s=re.sub(r'^(?:台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|南投|澎湖|金門|連江)(?:市|縣)?','',s)
 for x in ('學校財團法人','財團法人','國立','私立','市立','縣立','高級工業職業學校','高級商業職業學校','高級家事商業職業學校','高級工商職業學校','高級職業學校','高級中等學校','高級中等','高級中學','中等學校','高級','高中','中學','市','縣','區',' '):
  s=s.replace(x,'')
 return s
session=requests.Session()
fetch_failures=[]
session.headers['User-Agent']='Mozilla/5.0 (compatible; DiamondScope-roster-sync/1.0)'
def soup(url):
 for attempt in range(3):
  try:
   r=session.get(url,timeout=25);r.raise_for_status();return BeautifulSoup(r.text,'html.parser')
  except requests.RequestException as exc:
   if attempt==2:
    fetch_failures.append({'url':url,'error':str(exc)[:400],'status_code':getattr(getattr(exc,'response',None),'status_code',None)})
    print('FETCH ERROR:',url,str(exc)[:200],flush=True)
    return None
   time.sleep(2*(attempt+1))
 return None
links={}
region_issues=[]
for region in REGIONS:
 p=soup(BASE+'/'+region+'/')
 if not p:
  print('Region inaccessible:',region)
  region_issues.append({'region':region,'reason':'region_page_fetch_failed'})
  continue
 for a in p.select('a[href]'):
  href=urljoin(BASE,a['href']);path=unquote(urlparse(href).path)
  if not re.match(r'^/20(?:25|26)',path) or '/teams_' in path: continue
  name=a.get_text(' ',strip=True)
  if not name or len(name)<3:continue
  # Some 2026 region entries link to 2025 pages; always try their 2026 slug.
  # The official page convention is /2026<full school name>/.
  clean_name=re.sub(r'\s+','',name)
  if region=='teams_girl2026':
   school_name=re.sub(r'女子組$','',clean_name)

   # Women's team pages have a distinct official slug and must not
   # collide with the school's open-division roster.
   fixed_url=urljoin(BASE,'/2026'+school_name+'女子組/')
   links[fixed_url]=(school_name,region)
  else:
   year_path=re.sub(r'^/2025','/2026',path)
   fixed_url=urljoin(BASE,year_path)
   links[fixed_url]=(clean_name,region)
# Independently attempt known official 2026 school URLs even if every region page fails.
existing_path=root/'data'/'black-panther-rosters-2026.json'
try:
 known_rosters=json.loads(existing_path.read_text(encoding='utf8'))
except (OSError,ValueError):
 known_rosters={}
for key,entry in known_rosters.items():
 official=entry.get('officialName') or key.split('::')[0]
 if not official:continue
 group='teams_girl2026' if key.endswith('::女子組') else 'known_rosters'
 url=urljoin(BASE,'/2026'+official+('女子組' if group=='teams_girl2026' else '')+'/')
 links.setdefault(url,(official,group))
print('Official team pages:',len(links))
# A 403 on all five official index pages indicates source-side access denial.
# Do not retry every team's page when this execution environment is blocked.
if len(region_issues)==len(REGIONS) and all(x.get('status_code')==403 for x in fetch_failures):
 report={'year':2026,'target_teams':211,'complete':False,
         'blocked':True,'reason':'official_site_http_403',
         'official_team_pages':len(links),
         'existing_verified_teams':len(known_rosters),
         'regions_failed':region_issues,'fetch_failures':fetch_failures,
         'missing_teams':[],
         'missing_teams_unavailable_reason':'Cannot enumerate 211 official team pages while source returns 403'}
 report_path=root/'data'/'black-panther-rosters-2026-report.json'
 report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 raise RuntimeError('Official site returns HTTP 403 to GitHub runner; preserving previous roster data. No per-team retries.')
result={}
issues=[]
existing_path=root/'data'/'black-panther-rosters-2026.json'
try:
 existing=json.loads(existing_path.read_text(encoding='utf8'))
except (OSError,ValueError):
 existing={}

for n,(url,(full_name,region)) in enumerate(links.items(),1):
 normalized=norm(full_name)
 exact=[t for t in teams if norm(t)==normalized]
 ranked=sorted(((SequenceMatcher(None,norm(t),normalized).ratio(),t) for t in teams),reverse=True)
 if not exact and ranked and ranked[0][0]>=0.84 and (len(ranked)==1 or ranked[0][0]-ranked[1][0]>=0.15):
  exact=[ranked[0][1]]
 # Always fetch the official roster; a missing schedule alias must never skip players.
 key=full_name+('::女子組' if region=='teams_girl2026' else '')
 if key in result:
  issues.append({'team':full_name,'url':url,'reason':'duplicate_official_name'})
  continue
 if len(exact)!=1:
  issues.append({'team':full_name,'url':url,'region':region,'reason':'schedule_alias_needs_review','suggested':[(t,round(v,3)) for v,t in ranked[:3]]})
 p=soup(url)
 if p and not re.search(r'2026', p.title.get_text(' ',strip=True) if p.title else ''):
  issues.append({'team':full_name,'url':url,'region':region,'reason':'not_2026_team_page'})
  continue
 if not p:
  issues.append({'team':full_name,'url':url,'region':region,'reason':'team_page_fetch_failed'})
  continue
 roster=[]
 for table in p.select('table'):
  trs=table.select('tr')
  if not trs:continue
  heads=[x.get_text(' ',strip=True) for x in trs[0].find_all(['th','td'],recursive=False)]
  titles=[h.replace('／','/').replace(' ','') for h in heads]
  if not all(any(word in title for title in titles) for word in ('背號','球員','守位','投/打')):continue
  col={}
  for i,title in enumerate(titles):
   for field,word in [('number','背號'),('name','球員'),('position','守位'),('height','身高'),('weight','體重'),('hand','投/打')]:
    if word in title:col[field]=i
  if len(col)<6:continue
  for tr in trs[1:]:
   cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'],recursive=False)]
   if len(cells)<=max(col.values()):continue
   number=cells[col['number']].strip()
   name=cells[col['name']].strip()
   if not re.fullmatch(r'\d{1,3}',number) or not name:continue
   height=re.search(r'\d+',cells[col['height']])
   weight=re.search(r'\d+',cells[col['weight']])
   roster.append({'number':number,'name':name,'position':cells[col['position']],'height':int(height.group()) if height else None,'weight':int(weight.group()) if weight else None,'hand':cells[col['hand']]})
  if roster:break
 if roster:
  result[key]={'source':url,'officialName':full_name,'scheduleName':exact[0] if len(exact)==1 else None,'players':roster}
 else:
  issues.append({'team':full_name,'url':url,'region':region,'reason':'roster_table_not_parsed'})
 if n%20==0:print('Scanned',n,'/',len(links),'matched rosters',len(result),flush=True)
 time.sleep(0.12)
out=root/'data'/'black-panther-rosters-2026.json'
out.parent.mkdir(exist_ok=True)
report={'year':2026,'target_teams':211,'official_team_pages':len(links),'matched_teams':len(result),'players':sum(len(x['players']) for x in result.values()),'regions_failed':region_issues,'fetch_failures':fetch_failures,'issues':issues}
report_path=root/'data'/'black-panther-rosters-2026-report.json'
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
if not result:
 print('ABORT: no official rosters parsed; failure report written')
 raise RuntimeError('No verified rosters; inspect import diagnostics')
for key,entry in existing.items():
 if key not in result and entry.get('players'):
  result[key]=entry
  issues.append({'team':key,'reason':'retained_previous_verified_roster'})
out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
report['matched_teams']=len(result)
report['players']=sum(len(x['players']) for x in result.values())
# Validate against the complete official URL inventory, not just a raw count.
missing=[{'team':name,'region':region,'url':url,'reason':'no_verified_roster'}
 for url,(name,region) in links.items()
 if (name+('::女子組' if region=='teams_girl2026' else '')) not in result]
report['fetch_failures']=fetch_failures
report['missing_teams']=missing
report['missing_count']=len(missing)
report['expected_official_teams']=len(links)
report['complete']=(len(links)==211 and not missing and not region_issues and len(result)>=211)
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
if not report['complete']:
 print('INCOMPLETE: verified %s/211 teams; retry is required'%len(result),flush=True)
 raise RuntimeError('Incomplete official roster coverage: %s/211'%len(result))
print('Issues:',len(issues))
print('Saved',len(result),'teams,',sum(len(x['players']) for x in result.values()),'players')
