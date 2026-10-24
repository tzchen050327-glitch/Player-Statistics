#!/usr/bin/env python3
"""Fetch verified 2026 Panther Cup roster rows from the tournament's region/team pages."""
import json,re,time,unicodedata
from pathlib import Path
from urllib.parse import urljoin,urlparse
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
session.headers['User-Agent']='Mozilla/5.0 (compatible; DiamondScope-roster-sync/1.0)'
def soup(url):
 for attempt in range(3):
  try:
   r=session.get(url,timeout=25);r.raise_for_status();return BeautifulSoup(r.text,'html.parser')
  except requests.RequestException:
   if attempt==2: return None
   time.sleep(2*(attempt+1))
 return None
links={}
for region in REGIONS:
 p=soup(BASE+'/'+region+'/')
 if not p: print('Region inaccessible:',region);continue
 for a in p.select('a[href]'):
  href=urljoin(BASE,a['href']);path=urlparse(href).path
  if not path.startswith('/2026') or '/teams_' in path: continue
  name=a.get_text(' ',strip=True)
  if name and len(name)>=3:links[href]=(name,region)
print('Official team pages:',len(links))
result={}
issues=[]
seen_links=set()

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
 if not p:
  issues.append({'team':full_name,'url':url,'region':region,'reason':'team_page_fetch_failed'})
  continue
 roster=[]
 for table in p.select('table'):
  heads=[th.get_text(' ',strip=True) for th in table.select('tr:first-child th, tr:first-child td')]
  title=''.join(heads).replace('／','/').replace(' ','')
  if not ('背號' in title and '球員' in title and '守位' in title and '投/打' in title):continue
  for tr in table.select('tr')[1:]:
   cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'],recursive=False)]
   if len(cells)<6 or not re.fullmatch(r'\d{1,3}',cells[0]):continue
   height=re.search(r'\d+',cells[3]);weight=re.search(r'\d+',cells[4])
   roster.append({'number':cells[0],'name':cells[1],'position':cells[2],'height':int(height.group()) if height else None,'weight':int(weight.group()) if weight else None,'hand':cells[5]})
  if roster:break
 if roster:
  result[key]={'source':url,'officialName':full_name,'scheduleName':exact[0] if len(exact)==1 else None,'players':roster}
 else:
  issues.append({'team':full_name,'url':url,'region':region,'reason':'roster_table_not_parsed'})
 if n%30==0:print('Scanned',n,'/',len(links),'matched rosters',len(result))
 time.sleep(0.12)
out=root/'data'/'black-panther-rosters-2026.json'
out.parent.mkdir(exist_ok=True)
if not result:
 print('ABORT: zero parsed rosters; refusing to replace verified data')
 raise RuntimeError('Not enough verified rosters: '+str(len(result)))
out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
report={'year':2026,'official_team_pages':len(links),'matched_teams':len(result),'players':sum(len(x['players']) for x in result.values()),'issues':issues}
(root/'data'/'black-panther-rosters-2026-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Issues:',len(issues))
print('Saved',len(result),'teams,',sum(len(x['players']) for x in result.values()),'players')
