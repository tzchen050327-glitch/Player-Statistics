import json, re, urllib.parse, urllib.request, http.cookiejar

BASE='https://cpbl.com.tw'
GAME_ID='280'
YEAR='2026'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36'

cj=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
page_path=f'/box/index?gameSno={GAME_ID}&kindCode=A&year={YEAR}'
req=urllib.request.Request(BASE+page_path,headers={'User-Agent':UA,'Accept-Language':'zh-TW,zh;q=.9'})
with opener.open(req,timeout=20) as r:
    r.read()

body=urllib.parse.urlencode({'GameSno':GAME_ID,'Year':YEAR,'KindCode':'A'}).encode()
req=urllib.request.Request(BASE+'/box/getlive',data=body,headers={
    'User-Agent':UA,
    'Accept':'application/json, text/javascript, */*; q=0.01',
    'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With':'XMLHttpRequest',
    'Referer':BASE+page_path,
    'Origin':BASE,
})
with opener.open(req,timeout=20) as r:
    raw=r.read().decode('utf-8','replace')

j=json.loads(raw)
detail=json.loads(j.get('CurtGameDetailJson') or '{}')
live=json.loads(j.get('LiveLogJson') or '[]')
last=live[-1] if live else {}

pat=re.compile(r'(time|date|update|modify|create|stamp|event)',re.I)

def matching(obj):
    return {k:v for k,v in (obj or {}).items() if pat.search(str(k))}

print('TOP_TIME_FIELDS=',json.dumps(matching(j),ensure_ascii=False,default=str))
print('DETAIL_TIME_FIELDS=',json.dumps(matching(detail),ensure_ascii=False,default=str))
print('LAST_LIVE_TIME_FIELDS=',json.dumps(matching(last),ensure_ascii=False,default=str))
print('LAST_LIVE_KEYS=',json.dumps(sorted(last.keys()),ensure_ascii=False))
print('LAST_LIVE_SAMPLE=',json.dumps(last,ensure_ascii=False,default=str)[:12000])
