import json, urllib.request

url='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-box-schema?date=2026-09-14&gameId=280&probe=timing-v308'
with urllib.request.urlopen(url,timeout=30) as r:
    data=json.loads(r.read().decode('utf-8','replace'))
print(json.dumps(data.get('timing',{}),ensure_ascii=False,default=str))
