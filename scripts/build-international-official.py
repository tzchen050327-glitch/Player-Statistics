#!/usr/bin/env python3
import argparse, json, os, re, subprocess, tempfile, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

SOURCES = [
    {
        "competition": "亞洲運動會",
        "year": 2023,
        "url": "https://www.ocagames.com/orb/books/Hangzhou_2022/Baseball.pdf",
        "source": "OCA Hangzhou 2022 Baseball Official Results Book"
    },
    {
        "competition": "世界12強",
        "year": 2024,
        "url": "https://static.wbsc.org/uploads/federations/0/documents/82f90f98-607b-6a2c-59ba-47dbefdf741f.pdf",
        "source": "WBSC Premier12 2024 Final Daily Report"
    },
    {
        "competition": "亞錦賽",
        "year": 2025,
        "url": "https://static.wbsc.org/uploads/federations/281/documents/5908975f-de80-9c57-0009-7c19299f559a.pdf",
        "source": "BFA XXXI Asian Baseball Championship Daily Report"
    },
    {
        "competition": "亞錦賽",
        "year": 2023,
        "url": "https://static.wbsc.org/uploads/federations/281/documents/4deef3f6-9c5d-4b9a-a597-8595b52ecb2a.pdf",
        "source": "BFA XXX Asian Baseball Championship Final Daily Report"
    }
]

TEAM_ZH = {
    "CHINESE TAIPEI":"中華台北","TAIWAN":"中華台北",
    "JAPAN":"日本","KOREA":"韓國","SOUTH KOREA":"韓國","KOREA REPUBLIC":"韓國",
    "USA":"美國","UNITED STATES":"美國","UNITED STATES OF AMERICA":"美國",
    "AUSTRALIA":"澳洲","CANADA":"加拿大","CHINA":"中國","CHINA PR":"中國",
    "CUBA":"古巴","DOMINICAN REPUBLIC":"多明尼加","MEXICO":"墨西哥",
    "NETHERLANDS":"荷蘭","KINGDOM OF THE NETHERLANDS":"荷蘭",
    "PANAMA":"巴拿馬","PUERTO RICO":"波多黎各","VENEZUELA":"委內瑞拉",
    "PHILIPPINES":"菲律賓","PAKISTAN":"巴基斯坦","PALESTINE":"巴勒斯坦",
    "HONG KONG":"香港","HONG KONG, CHINA":"香港","HONG KONG SAR":"香港",
    "THAILAND":"泰國","SINGAPORE":"新加坡"
}

BATTING_FIELDS = ["ab","runs","hits","rbi","double","triple","hr","bb","sb","cs","hbp","sacBunt","sacFly","k","ibb","kl","gdp","po","a","errors"]
PITCHING_FIELDS = ["h","r","er","bb","k","wp","hbp","bk","ibb","sacBunt","sacFly","double","triple","hr","ab","bf","fo","go","pitchCount"]

MONTHS = {m:i for i,m in enumerate([
    "January","February","March","April","May","June","July","August","September","October","November","December"
],1)}
MONTHS.update({"Jan":1,"Feb":2,"Mar":3,"Apr":4,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Sept":9,"Oct":10,"Nov":11,"Dec":12})

def clean(s):
    return re.sub(r"\s+"," ",str(s or "")).strip()

def norm(s):
    return re.sub(r"[^a-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+","",clean(s).lower())

def team_zh(s):
    raw=clean(s)
    up=raw.upper()
    return TEAM_ZH.get(up, raw.title() if raw.isupper() else raw)

def parse_date(block):
    m=re.search(r"\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})\b",block,re.I)
    if not m:
        return ""
    month=MONTHS.get(m.group(1).title(), MONTHS.get(m.group(1),0))
    return f"{int(m.group(3)):04d}-{month:02d}-{int(m.group(2)):02d}" if month else ""

def split_game_blocks(text):
    # Normalize form-feed but preserve lines.
    text=text.replace("\r","\n")
    matches=list(re.finditer(r"(?im)^\s*GAME SUMMARY[^\n]*$",text))
    out=[]
    for i,m in enumerate(matches):
        end=matches[i+1].start() if i+1<len(matches) else len(text)
        out.append(text[m.start():end])
    return out

def matchup_from_block(block):
    lines=[clean(x) for x in block.splitlines() if clean(x)]
    for line in lines[1:12]:
        if line.startswith("(") or "RESULTADO DEL JUEGO" in line.upper() or "COMPOSITE BOX SCORE" in line.upper():
            continue
        # Real matchup lines are short and use a dash between team names.
        m=re.match(r"^(.+?)\s+[–—-]\s+(.+?)$",line)
        if m and len(line)<100:
            a=clean(m.group(1)); b=clean(m.group(2))
            if a and b and not re.search(r"\d{4}\s+at\b",line,re.I):
                return team_zh(a),team_zh(b)
    return "",""

def score_team_from_line(line):
    # Immediately before the PLAYER header there is normally "Chinese Taipei 4".
    s=clean(line)
    s=re.sub(r"\s+\d+\s*$","",s)
    return team_zh(s)

def batting_row(line):
    tokens=clean(line).split()
    if len(tokens)<22:
        return None
    # Last 20 columns are integers in WBSC/BFA report batting tables.
    vals=tokens[-20:]
    if not all(re.fullmatch(r"-?\d+",x) for x in vals):
        return None
    prefix=tokens[:-20]
    if len(prefix)<2:
        return None
    pos=prefix[-1]
    if not re.fullmatch(r"[A-Za-z0-9/,.-]+",pos):
        return None
    name=clean(" ".join(prefix[:-1]).lstrip("*"))
    if not name or name.lower()=="totals":
        return None
    nums=[int(x) for x in vals]
    stat=dict(zip(BATTING_FIELDS,nums))
    stat["pa"]=stat["ab"]+stat["bb"]+stat["hbp"]+stat["sacBunt"]+stat["sacFly"]
    stat["single"]=max(0,stat["hits"]-stat["double"]-stat["triple"]-stat["hr"])
    return {"name":name,"position":pos,"hitter":stat}

def pitching_row(line):
    tokens=clean(line).split()
    ip_index=-1
    for i,t in enumerate(tokens):
        if re.fullmatch(r"\d+\.[012]",t):
            ip_index=i
            break
    if ip_index<1:
        return None
    tail=tokens[ip_index+1:]
    if len(tail)<19 or not all(re.fullmatch(r"-?\d+",x) for x in tail[:19]):
        return None
    prefix=tokens[:ip_index]
    decision=""
    if prefix and re.fullmatch(r"(?:W|L|S|SV|H|HLD)(?:,\d+(?:-\d+)?)?",prefix[-1],re.I):
        decision=prefix.pop()
    name=clean(" ".join(prefix).lstrip("*"))
    if not name or name.lower()=="totals":
        return None
    ip=tokens[ip_index]
    whole,frac=ip.split(".")
    outs=int(whole)*3+int(frac)
    nums=[int(x) for x in tail[:19]]
    stat={"outs":outs,"innings":ip}
    stat.update(dict(zip(PITCHING_FIELDS,nums)))
    stat["w"]=1 if decision.upper().startswith("W") else 0
    stat["l"]=1 if decision.upper().startswith("L") else 0
    stat["sv"]=1 if decision.upper().startswith(("S","SV")) else 0
    stat["hld"]=1 if decision.upper().startswith(("H","HLD")) else 0
    stat["bsv"]=0
    stat["cg"]=1 if outs>=27 else 0
    stat["sho"]=1 if outs>=27 and stat["r"]==0 else 0
    stat["era"]=round(stat["er"]*27/outs,2) if outs else 0
    stat["whip"]=round((stat["h"]+stat["bb"])*3/outs,2) if outs else 0
    return {"name":name,"pitcher":stat}

def merge_player(target, src):
    if src.get("hitter"):
        h=target.setdefault("hitter",{})
        for k,v in src["hitter"].items():
            if isinstance(v,(int,float)):
                h[k]=h.get(k,0)+v
    if src.get("pitcher"):
        p=target.setdefault("pitcher",{})
        for k,v in src["pitcher"].items():
            if k in ("innings","era","whip"):
                continue
            if isinstance(v,(int,float)):
                p[k]=p.get(k,0)+v
        outs=p.get("outs",0)
        p["innings"]=f"{outs//3}.{outs%3}"
        p["era"]=round(p.get("er",0)*27/outs,2) if outs else 0
        p["whip"]=round((p.get("h",0)+p.get("bb",0))*3/outs,2) if outs else 0

def parse_game(block, source_meta, seq):
    away,home=matchup_from_block(block)
    date=parse_date(block)
    if not away or not home or not date:
        return None
    lines=block.splitlines()
    players_by_team=defaultdict(dict)

    # Batting tables.
    for i,line in enumerate(lines):
        if re.search(r"\bPLAYER\s+AB\s+R\s+H\s+BI\b",line,re.I):
            prev=""
            for j in range(i-1,max(-1,i-5),-1):
                if clean(lines[j]) and not set(clean(lines[j]))<=set("-"):
                    prev=clean(lines[j]); break
            team=score_team_from_line(prev)
            if not team:
                continue
            for rowline in lines[i+1:]:
                s=clean(rowline)
                if not s or set(s)<=set("-"):
                    continue
                if re.match(r"^Totals\b",s,re.I):
                    break
                parsed=batting_row(rowline)
                if not parsed:
                    continue
                key=norm(parsed["name"])
                obj=players_by_team[team].setdefault(key,{"name":parsed["name"],"position":parsed.get("position","")})
                # In one game, duplicate rows for the same person are rare; sum safely.
                merge_player(obj,parsed)

    # Pitching tables.
    for i,line in enumerate(lines):
        if re.search(r"\bIP\s+H\s+R\s+ER\s+BB\s+SO\s+WP\s+HP\s+BK\s+IBB\s+SH\s+SF\s+2B\s+3B\s+HR\s+AB\s+BF\s+FO\s+GO\s+NP\b",line,re.I):
            team=team_zh(re.split(r"\s+IP\s+H\s+R\s+ER\b",clean(line),flags=re.I)[0])
            for rowline in lines[i+1:]:
                s=clean(rowline)
                if not s or set(s)<=set("-"):
                    continue
                if re.match(r"^(Umpires|Scorers|TC:|Start:|GAME SUMMARY)",s,re.I):
                    break
                if re.search(r"\bIP\s+H\s+R\s+ER\s+BB\s+SO\b",s,re.I):
                    break
                parsed=pitching_row(rowline)
                if not parsed:
                    continue
                key=norm(parsed["name"])
                obj=players_by_team[team].setdefault(key,{"name":parsed["name"],"position":"P"})
                merge_player(obj,parsed)

    teams={}
    for team,pmap in players_by_team.items():
        teams[team]=list(pmap.values())
    if not teams:
        return None
    return {
        "gameId":f'{source_meta["competition"]}-{source_meta["year"]}-{seq}',
        "date":date,
        "away":away,
        "home":home,
        "source":source_meta["source"],
        "sourceUrl":source_meta["url"],
        "teams":teams
    }

def build_event(meta,text):
    games=[]
    for seq,block in enumerate(split_game_blocks(text),1):
        g=parse_game(block,meta,seq)
        if g:
            games.append(g)

    aggregate=defaultdict(dict)
    for g in games:
        for team,plist in g["teams"].items():
            for p in plist:
                key=norm(p["name"])
                obj=aggregate[team].setdefault(key,{"name":p["name"],"position":p.get("position",""),"hitter":None,"pitcher":None,"games":[]})
                if p.get("position") and not obj.get("position"):
                    obj["position"]=p["position"]
                if p.get("hitter"):
                    if obj["hitter"] is None: obj["hitter"]={}
                    temp={"hitter":obj["hitter"]}
                    merge_player(temp,{"hitter":p["hitter"]})
                    obj["hitter"]=temp["hitter"]
                if p.get("pitcher"):
                    if obj["pitcher"] is None: obj["pitcher"]={}
                    temp={"pitcher":obj["pitcher"]}
                    merge_player(temp,{"pitcher":p["pitcher"]})
                    obj["pitcher"]=temp["pitcher"]
                opp=g["home"] if team==g["away"] else g["away"]
                obj["games"].append({
                    "gameId":g["gameId"],"date":g["date"],"opponent":opp,
                    "hitter":p.get("hitter"),"pitcher":p.get("pitcher"),
                    "source":g["source"],"sourceUrl":g["sourceUrl"]
                })
    # Recompute rate fields after totals.
    for team,pmap in aggregate.items():
        for p in pmap.values():
            pit=p.get("pitcher")
            if pit:
                outs=pit.get("outs",0)
                pit["innings"]=f"{outs//3}.{outs%3}"
                pit["era"]=round(pit.get("er",0)*27/outs,2) if outs else 0
                pit["whip"]=round((pit.get("h",0)+pit.get("bb",0))*3/outs,2) if outs else 0

    return {
        "competition":meta["competition"],"year":meta["year"],
        "source":meta["source"],"sourceUrl":meta["url"],
        "games":games,
        "teams":{team:list(pmap.values()) for team,pmap in aggregate.items()}
    }

def fetch_pdf_text(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 InternationalStatsBot/1.0"})
    with tempfile.TemporaryDirectory() as td:
        pdf=os.path.join(td,"report.pdf")
        txt=os.path.join(td,"report.txt")
        with urllib.request.urlopen(req,timeout=90) as r, open(pdf,"wb") as f:
            f.write(r.read())
        subprocess.run(["pdftotext","-layout",pdf,txt],check=True)
        with open(txt,"r",encoding="utf-8",errors="replace") as f:
            return f.read()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",default="data/international-official.json")
    args=ap.parse_args()
    events={}
    errors=[]
    for meta in SOURCES:
        key=f'{meta["competition"]}:{meta["year"]}'
        try:
            text=fetch_pdf_text(meta["url"])
            event=build_event(meta,text)
            if not event["games"]:
                raise RuntimeError("no game summaries parsed")
            events[key]=event
            print(f'OK {key}: {len(event["games"])} games, {len(event["teams"])} teams')
        except Exception as e:
            errors.append({"event":key,"error":str(e),"sourceUrl":meta["url"]})
            print(f'ERROR {key}: {e}')
    out={
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "generator":"official-data-bot",
        "events":events,
        "errors":errors
    }
    os.makedirs(os.path.dirname(args.output) or ".",exist_ok=True)
    with open(args.output,"w",encoding="utf-8") as f:
        json.dump(out,f,ensure_ascii=False,separators=(",",":"))
    if not events:
        raise SystemExit("no official events were generated")

if __name__=="__main__":
    main()
