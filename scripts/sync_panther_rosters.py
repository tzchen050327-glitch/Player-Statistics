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
 s=unicodedata.normalize('NFKC',s).replace('臺','台').replace('髙','高')
 for x in ('國立','私立','財團法人','學校財團法人','高級中等學校','高級職業學校','高級中學','高級工業職業學校','高級商業職業學校','高級家事商業職業學校','高級工商職業學校','高級中等','高級','中等學校','市立','縣立','市','縣','區',' '):
  s=s.replace(x,'')
 s=re.sub(r'^(?:台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|南投|澎湖|金門|連江)(?:市|縣)?','',s)\n s=s.replace('高工','工商').replace('高中','').replace('家商','').replace('中學','')
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
  if name and len(name)>=3:links[href]=name
print('Official team pages:',len(links))
result={}
for n,(url,full_name) in enumerate(links.items(),1):
 normalized=norm(full_name)
 exact=[t for t in teams if norm(t)==normalized]
 if not exact:
  ranked=sorted(((SequenceMatcher(None,norm(t),normalized).ratio(),t) for t in teams),reverse=True)
  if ranked and ranked[0][0]>=0.79 and (len(ranked)==1 or ranked[0][0]-ranked[1][0]>=0.14):exact=[ranked[0][1]]
 if len(exact)!=1:continue
 short=exact[0]
 if short in result:continue
 p=soup(url)
 if not p:continue
 roster=[]
 for table in p.select('table'):
  heads=[th.get_text(' ',strip=True) for th in table.select('tr:first-child th, tr:first-child td')]
  if not ('背號' in ''.join(heads) and '守位' in ''.join(heads) and '投/打' in ''.join(heads)):continue
  for tr in table.select('tr')[1:]:
   cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'],recursive=False)]
   if len(cells)<6 or not re.fullmatch(r'\d{1,3}',cells[0]):continue
   height=re.search(r'\d+',cells[3]);weight=re.search(r'\d+',cells[4])
   roster.append({'number':cells[0],'name':cells[1],'position':cells[2],'height':int(height.group()) if height else None,'weight':int(weight.group()) if weight else None,'hand':cells[5]})
  if roster:break
 if roster:
  result[short]={'source':url,'players':roster}
 if n%30==0:print('Scanned',n,'/',len(links),'matched rosters',len(result))
 time.sleep(0.12)
out=root/'data'/'black-panther-rosters-2026.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('Saved',len(result),'teams,',sum(len(x['players']) for x in result.values()),'players')
