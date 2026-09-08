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
    "THAILAND":"泰國","SINGAPORE":"新加坡",
    "REPUBLIC OF KOREA":"韓國","PEOPLE'S REPUBLIC OF CHINA":"中國",
    "LAO PEOPLE'S DEMOCRATIC REPUBLIC":"寮國","HONG KONG, CHINA":"香港",
    "CZECHIA":"捷克","CZECH REPUBLIC":"捷克","ITALY":"義大利",
    "GREAT BRITAIN":"英國","BRAZIL":"巴西","COLOMBIA":"哥倫比亞",
    "ISRAEL":"以色列","NICARAGUA":"尼加拉瓜"
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



OCA_MONTHS = {
    "JAN":1,"FEB":2,"MAR":3,"APR":4,"MAY":5,"JUN":6,
    "JUL":7,"AUG":8,"SEP":9,"OCT":10,"NOV":11,"DEC":12
}

def oca_value(v):
    t=clean(v)
    if t in ("","-","x","X"):
        return 0
    try:
        return int(t)
    except Exception:
        return 0

def oca_date(line):
    m=re.search(r"\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\b",line,re.I)
    if not m:
        return ""
    month=OCA_MONTHS.get(m.group(2).upper(),0)
    return f"{int(m.group(3)):04d}-{month:02d}-{int(m.group(1)):02d}" if month else ""

def oca_player_abbr(full_name):
    name=clean(re.sub(r"\s*\(C\)\s*$","",full_name))
    parts=name.split()
    if not parts:
        return ""
    surname=re.sub(r"[^A-Za-z]","",parts[0]).upper()
    initials=[]
    for p in parts[1:]:
        for q in re.split(r"[-']",p):
            q=re.sub(r"[^A-Za-z]","",q)
            if q:
                initials.append(q[0].upper())
    return clean(surname+" "+"".join(initials))

def parse_oca_rosters(text):
    lines=text.splitlines()
    rosters={}
    displays={}
    i=0
    while i<len(lines):
        m=re.match(r"^\s*([A-Z]{3})\s*-\s*(.+?)\s*$",lines[i])
        if not m:
            i+=1
            continue
        code=m.group(1).upper()
        display=clean(m.group(2))
        look="\n".join(lines[i:i+8])
        if "No. Name" not in look or "Date of Birth" not in look:
            i+=1
            continue
        displays[code]=display
        team=team_zh(display)
        roster=[]
        for j in range(i+1,min(len(lines),i+120)):
            line=lines[j]
            if re.search(r"Team Manager:|Coaches:|Pitching Coach:|Bench Coach:",line,re.I):
                break
            rm=re.match(
                r"^\s*(\d{1,3})\s+(.+?)\s{2,}(\d{1,2}\s+[A-Z]{3}\s+\d{4})\s+(.+)$",
                line
            )
            if not rm:
                continue
            number=rm.group(1)
            name=clean(re.sub(r"\s*\(C\)\s*$","",rm.group(2)))
            rest=rm.group(4)
            pm=re.search(r"\d+\.\d+\s*/\s*\S+\s+([A-Z]{1,3})\s+[LRS]\s+[LRS]\b",rest)
            pos=pm.group(1) if pm else ""
            if not name or len(name)<2:
                continue
            roster.append({
                "number":number,
                "name":name,
                "position":pos,
                "abbr":oca_player_abbr(name)
            })
        if roster:
            rosters[code]={"team":team,"display":display,"players":roster}
        i+=1
    return rosters,displays

def resolve_oca_player(rosters,code,abbr):
    raw=clean(abbr).lstrip("*")
    raw=re.sub(r"\s*\(C\)\s*$","",raw)
    key=norm(raw)
    roster=(rosters.get(code) or {}).get("players") or []
    exact=[p for p in roster if norm(p.get("abbr"))==key]
    if len(exact)==1:
        return exact[0]
    if exact:
        return exact[0]
    # Secondary match: surname + initials contained in the roster-generated abbreviation.
    for p in roster:
        pab=norm(p.get("abbr"))
        if key and pab and (key==pab or key in pab or pab in key):
            return p
    return {"number":"","name":raw,"position":""}

def parse_oca_batter_segment(segment,rosters,code):
    tokens=clean(segment).split()
    if len(tokens)<11:
        return None
    stat_tokens=tokens[-9:]
    if not all(re.fullmatch(r"(?:\d+|-|x)",x,re.I) for x in stat_tokens):
        return None
    pos=tokens[-10]
    if not re.fullmatch(r"[A-Z0-9/.-]+",pos):
        return None
    abbr=clean(" ".join(tokens[:-10])).lstrip("*")
    if not abbr:
        return None
    vals=[oca_value(x) for x in stat_tokens]
    ab,runs,hits,rbi,bb,so,po,a,errors=vals
    resolved=resolve_oca_player(rosters,code,abbr)
    hitter={
        "pa":ab+bb,
        "ab":ab,"runs":runs,"hits":hits,
        "single":hits,"double":0,"triple":0,"hr":0,
        "rbi":rbi,"bb":bb,"ibb":0,"hbp":0,
        "sacBunt":0,"sacFly":0,"k":so,"errors":errors
    }
    return {
        "name":resolved.get("name") or abbr,
        "number":resolved.get("number") or "",
        "position":pos or resolved.get("position") or "",
        "hitter":hitter
    }

def parse_oca_pitcher_row(line,rosters,code):
    tokens=clean(line).split()
    if len(tokens)<13:
        return None
    tail=tokens[-12:]
    if not all(re.fullmatch(r"(?:\d+(?:\.[012])?|-)",x) for x in tail):
        return None
    prefix=tokens[:-12]
    if not prefix:
        return None
    decision=""
    if len(prefix)>=2 and re.fullmatch(r"[WLS]",prefix[-2],re.I) and re.fullmatch(r"\(\d+,\d+,\d+\)",prefix[-1]):
        decision=prefix[-2].upper()
        prefix=prefix[:-2]
    elif prefix and re.fullmatch(r"[WLS]",prefix[-1],re.I):
        decision=prefix[-1].upper()
        prefix=prefix[:-1]
    abbr=clean(" ".join(prefix)).lstrip("*")
    if not abbr or abbr.lower()=="totals:":
        return None
    ip,h,r,er,bb,so,hr,wp,bk,ab,bf,np=tail
    ip=clean(ip)
    if re.fullmatch(r"\d+",ip):
        outs=int(ip)*3
    else:
        m=re.fullmatch(r"(\d+)\.([012])",ip)
        outs=int(m.group(1))*3+int(m.group(2)) if m else 0
    resolved=resolve_oca_player(rosters,code,abbr)
    hh=oca_value(h); bbb=oca_value(bb); e=oca_value(er)
    pitcher={
        "outs":outs,"innings":f"{outs//3}.{outs%3}",
        "h":hh,"r":oca_value(r),"er":e,"bb":bbb,"hbp":0,
        "k":oca_value(so),
        "w":1 if decision=="W" else 0,
        "l":1 if decision=="L" else 0,
        "sv":1 if decision=="S" else 0,
        "hld":0,"bsv":0,
        "cg":1 if outs>=27 else 0,
        "sho":1 if outs>=27 and oca_value(r)==0 else 0,
        "pitchCount":oca_value(np),
        "era":round(e*27/outs,2) if outs else 0,
        "whip":round((hh+bbb)*3/outs,2) if outs else 0
    }
    return {
        "name":resolved.get("name") or abbr,
        "number":resolved.get("number") or "",
        "position":"P",
        "pitcher":pitcher
    }

def merge_oca_game_player(target,src):
    if not target.get("number") and src.get("number"):
        target["number"]=src["number"]
    if not target.get("position") and src.get("position"):
        target["position"]=src["position"]
    if src.get("hitter"):
        if target.get("hitter") is None:
            target["hitter"]={}
        h=target["hitter"]
        for k,v in src["hitter"].items():
            if isinstance(v,(int,float)):
                h[k]=h.get(k,0)+v
    if src.get("pitcher"):
        target["pitcher"]=src["pitcher"]

def build_asian_games_event(meta,text):
    lines=text.splitlines()
    rosters,displays=parse_oca_rosters(text)

    # Group all repeated report pages for the same Game N.
    headers=[]
    for i,line in enumerate(lines):
        m=re.search(r"Men's .+? - Game\s+(\d+)\b",line,re.I)
        if m:
            headers.append((i,int(m.group(1)),oca_date(line)))
    if not headers:
        raise RuntimeError("OCA game headers not found")

    groups=defaultdict(list)
    dates={}
    for idx,(start,game_no,date) in enumerate(headers):
        end=headers[idx+1][0] if idx+1<len(headers) else len(lines)
        groups[game_no].extend(lines[start:end])
        if date:
            dates[game_no]=date

    games=[]
    for game_no in sorted(groups):
        glines=groups[game_no]
        if game_no in (13,15,17,19):
            print("ASIAN_GAMES_MISSING_RAW_BEGIN",game_no)
            for raw_line in glines[:90]:
                if clean(raw_line):
                    print(raw_line)
            print("ASIAN_GAMES_MISSING_RAW_END",game_no)
        score=None
        for line in glines:
            m=re.search(r"\b([A-Z]{3})\s+(\d+)\s*-\s*(\d+)\s+([A-Z]{3})\b",line)
            if m:
                score=(m.group(1),int(m.group(2)),int(m.group(3)),m.group(4))
                break
        if not score:
            continue
        code1,score1,score2,code2=score
        team1=team_zh((rosters.get(code1) or {}).get("display") or displays.get(code1) or code1)
        team2=team_zh((rosters.get(code2) or {}).get("display") or displays.get(code2) or code2)
        players_by_team={team1:{},team2:{}}

        # Batting: OCA puts both teams side by side on the same fixed-width row.
        for i,line in enumerate(glines):
            if not ("Pos." in line and "AB" in line and "RBI" in line and f"({code1})" in line and f"({code2})" in line):
                continue
            right_display=(rosters.get(code2) or {}).get("display") or displays.get(code2) or ""
            right_start=line.find(right_display) if right_display else -1
            if right_start<0:
                code_at=line.rfind(f"({code2})")
                if code_at>0:
                    # Walk left to the previous large whitespace gap.
                    right_start=code_at
                    while right_start>0 and line[right_start-1]!=" ":
                        right_start-=1
                    while right_start>1 and not (line[right_start-2:right_start]=="  "):
                        right_start-=1
            if right_start<=0:
                continue
            for row in glines[i+1:i+35]:
                if "W/L/S" in row or "Timing and Results" in row:
                    break
                if "Totals:" in row:
                    break
                left=row[:right_start]
                right=row[right_start:]
                for code,team,seg in [(code1,team1,left),(code2,team2,right)]:
                    parsed=parse_oca_batter_segment(seg,rosters,code)
                    if not parsed:
                        continue
                    key=norm(parsed["name"])
                    obj=players_by_team[team].setdefault(key,{
                        "name":parsed["name"],"number":parsed.get("number",""),
                        "position":parsed.get("position",""),"hitter":None,"pitcher":None
                    })
                    merge_oca_game_player(obj,parsed)
            break

        # Pitching: each team gets its own single-column table.
        for i,line in enumerate(glines):
            if not ("W/L/S" in line and "IP" in line and "ER" in line and "NP" in line):
                continue
            hm=re.match(r"^\s*(.+?)\s+\(([A-Z]{3})\)\s+W/L/S\b",line)
            if not hm:
                continue
            code=hm.group(2)
            if code not in (code1,code2):
                continue
            team=team1 if code==code1 else team2
            for row in glines[i+1:i+15]:
                if "Totals:" in row:
                    break
                parsed=parse_oca_pitcher_row(row,rosters,code)
                if not parsed:
                    continue
                key=norm(parsed["name"])
                obj=players_by_team[team].setdefault(key,{
                    "name":parsed["name"],"number":parsed.get("number",""),
                    "position":"P","hitter":None,"pitcher":None
                })
                merge_oca_game_player(obj,parsed)

        if not any(players_by_team[t] for t in players_by_team):
            continue

        game={
            "gameId":f"AG-2023-{game_no}",
            "date":dates.get(game_no,""),
            "away":team1,"home":team2,
            "score":{"away":score1,"home":score2},
            "source":meta["source"],"sourceUrl":meta["url"],
            "teams":{team:list(pmap.values()) for team,pmap in players_by_team.items()}
        }
        if game["date"]:
            games.append(game)

    # Start with the official full roster, then add/merge game stats.
    aggregate=defaultdict(dict)
    for code,rinfo in rosters.items():
        team=rinfo["team"]
        for p in rinfo["players"]:
            aggregate[team][norm(p["name"])]={
                "name":p["name"],"number":p.get("number",""),
                "position":p.get("position",""),
                "hitter":None,"pitcher":None,"games":[]
            }

    for game in games:
        for team,plist in game["teams"].items():
            for p in plist:
                key=norm(p["name"])
                obj=aggregate[team].setdefault(key,{
                    "name":p["name"],"number":p.get("number",""),
                    "position":p.get("position",""),
                    "hitter":None,"pitcher":None,"games":[]
                })
                if p.get("hitter"):
                    if obj["hitter"] is None:
                        obj["hitter"]={}
                    h=obj["hitter"]
                    for k,v in p["hitter"].items():
                        if isinstance(v,(int,float)):
                            h[k]=h.get(k,0)+v
                if p.get("pitcher"):
                    if obj["pitcher"] is None:
                        obj["pitcher"]={}
                    pit=obj["pitcher"]
                    for k,v in p["pitcher"].items():
                        if k in ("innings","era","whip"):
                            continue
                        if isinstance(v,(int,float)):
                            pit[k]=pit.get(k,0)+v
                    outs=pit.get("outs",0)
                    pit["innings"]=f"{outs//3}.{outs%3}"
                    pit["era"]=round(pit.get("er",0)*27/outs,2) if outs else 0
                    pit["whip"]=round((pit.get("h",0)+pit.get("bb",0))*3/outs,2) if outs else 0
                opponent=game["home"] if team==game["away"] else game["away"]
                obj["games"].append({
                    "gameId":game["gameId"],"date":game["date"],"opponent":opponent,
                    "hitter":p.get("hitter"),"pitcher":p.get("pitcher"),
                    "source":meta["source"],"sourceUrl":meta["url"]
                })

    return {
        "competition":"亞洲運動會","year":2023,
        "source":meta["source"],"sourceUrl":meta["url"],
        "games":sorted(games,key=lambda g:(g.get("date",""),g.get("gameId",""))),
        "teams":{team:list(pmap.values()) for team,pmap in aggregate.items()}
    }


WBC_TEAMS_2026 = [
    "Chinese Taipei","Japan","Korea","Australia","Czechia",
    "United States","Mexico","Italy","Great Britain","Brazil",
    "Canada","Colombia","Cuba","Panama","Puerto Rico",
    "Dominican Republic","Israel","Kingdom of the Netherlands",
    "Nicaragua","Venezuela"
]

def fetch_json(url, timeout=60):
    req=urllib.request.Request(url,headers={
        "User-Agent":"Mozilla/5.0 InternationalStatsBot/1.0",
        "Accept":"application/json"
    })
    with urllib.request.urlopen(req,timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def mlb_ip_to_outs(v):
    m=re.fullmatch(r"(\d+)(?:\.([012]))?",clean(v))
    return int(m.group(1))*3+int(m.group(2) or 0) if m else 0

def safe_float(v, fallback=0.0):
    try:
        text=clean(v)
        if not text or text in ("-.--","---","--","-"):
            return float(fallback)
        return float(text)
    except Exception:
        return float(fallback)

def mlb_hitter_stat(stat, errors=0):
    if not stat:
        return None
    h=int(stat.get("hits") or 0)
    d=int(stat.get("doubles") or 0)
    t=int(stat.get("triples") or 0)
    hr=int(stat.get("homeRuns") or 0)
    return {
        "pa":int(stat.get("plateAppearances") or 0),
        "ab":int(stat.get("atBats") or 0),
        "runs":int(stat.get("runs") or 0),
        "hits":h,
        "single":max(0,h-d-t-hr),
        "double":d,
        "triple":t,
        "hr":hr,
        "rbi":int(stat.get("rbi") or 0),
        "bb":int(stat.get("baseOnBalls") or 0),
        "ibb":int(stat.get("intentionalWalks") or 0),
        "hbp":int(stat.get("hitByPitch") or 0),
        "sacBunt":int(stat.get("sacBunts") or 0),
        "sacFly":int(stat.get("sacFlies") or 0),
        "k":int(stat.get("strikeOuts") or 0),
        "errors":int(errors or 0)
    }

def mlb_pitcher_stat(stat):
    if not stat:
        return None
    outs=int(stat.get("outs") or 0)
    if not outs:
        outs=mlb_ip_to_outs(stat.get("inningsPitched") or "0.0")
    h=int(stat.get("hits") or 0)
    bb=int(stat.get("baseOnBalls") or 0)
    er=int(stat.get("earnedRuns") or 0)
    return {
        "outs":outs,
        "innings":f"{outs//3}.{outs%3}",
        "h":h,
        "r":int(stat.get("runs") or 0),
        "er":er,
        "bb":bb,
        "hbp":int(stat.get("hitBatsmen") or 0),
        "k":int(stat.get("strikeOuts") or 0),
        "w":int(stat.get("wins") or 0),
        "l":int(stat.get("losses") or 0),
        "sv":int(stat.get("saves") or 0),
        "hld":int(stat.get("holds") or 0),
        "bsv":int(stat.get("blownSaves") or 0),
        "cg":int(stat.get("completeGames") or 0),
        "sho":int(stat.get("shutouts") or 0),
        "pitchCount":int(stat.get("numberOfPitches") or stat.get("pitchesThrown") or 0),
        "era":safe_float(stat.get("era"), er*27/outs if outs else 0),
        "whip":safe_float(stat.get("whip"), (h+bb)*3/outs if outs else 0)
    }

def mlb_pa_code(event_type):
    return {
        "single":"1B","double":"2B","triple":"3B","home_run":"HR",
        "walk":"BB","intent_walk":"IBB","hit_by_pitch":"HBP",
        "catcher_interf":"CI","sac_bunt":"SH","sac_fly":"SF",
        "field_error":"E","fielders_choice":"FC","fielders_choice_out":"FC",
        "strikeout":"K","strikeout_double_play":"K",
        "groundout":"GO","force_out":"GO","double_play":"DP",
        "grounded_into_double_play":"DP","triple_play":"TP",
        "flyout":"FO","lineout":"FO","pop_out":"FO"
    }.get(clean(event_type).lower(),"OUT")

def mlb_plate_appearances(feed):
    out=defaultdict(list)
    for play in (((feed.get("liveData") or {}).get("plays") or {}).get("allPlays") or []):
        batter=(play.get("matchup") or {}).get("batter") or {}
        pid=str(batter.get("id") or "")
        result=play.get("result") or {}
        if not pid or not (result.get("eventType") or result.get("event")):
            continue
        out[pid].append({
            "code":mlb_pa_code(result.get("eventType") or ""),
            "position":"",
            "rbi":int(result.get("rbi") or 0),
            "officialAction":clean(result.get("description") or result.get("event") or "")
        })
    return out

def mlb_decision_flags(feed):
    d=((feed.get("liveData") or {}).get("decisions") or {})
    result={}
    for key,field in [("winner","w"),("loser","l"),("save","sv")]:
        p=d.get(key) or {}
        pid=str(p.get("id") or "")
        if pid:
            result.setdefault(pid,{"w":0,"l":0,"sv":0})[field]=1
    return result

def build_wbc_event_2026():
    year=2026
    source="MLB StatsAPI World Baseball Classic"
    source_url="https://www.mlb.com/world-baseball-classic"
    all_teams=fetch_json(f"https://statsapi.mlb.com/api/v1/teams?sportId=51&season={year}").get("teams") or []
    by_name={clean(t.get("name")):t for t in all_teams}
    selected={}
    for name in WBC_TEAMS_2026:
        t=by_name.get(name)
        if not t:
            raise RuntimeError(f"WBC team not found in MLB: {name}")
        selected[int(t["id"])]=t

    players_by_team=defaultdict(dict)
    # Official roster + official cumulative tournament stats.
    for team_id,t in selected.items():
        hydrate=f"person(rosterEntries,education,stats(type=season,season={year},sportId=51,teamId={team_id},gameType=F))"
        url=(f"https://statsapi.mlb.com/api/v1/teams/{team_id}/roster?"
             f"hydrate={hydrate}&rosterType=active&season={year}&sportId=51")
        roster=fetch_json(url).get("roster") or []
        team_name=team_zh(t.get("name") or "")
        for item in roster:
            person=item.get("person") or {}
            pid=str(person.get("id") or "")
            name=clean(person.get("fullName") or "")
            if not pid or not name:
                continue
            position=clean((item.get("position") or {}).get("abbreviation")
                           or (person.get("primaryPosition") or {}).get("abbreviation") or "")
            obj={
                "id":pid,"name":name,"number":str(item.get("jerseyNumber") or ""),
                "position":position,"hitter":None,"pitcher":None,"games":[]
            }
            for stats_block in person.get("stats") or []:
                group=clean((stats_block.get("group") or {}).get("displayName")).lower()
                for split in stats_block.get("splits") or []:
                    if clean(split.get("gameType")) not in ("","F"):
                        continue
                    if "hitting" in group:
                        obj["hitter"]=mlb_hitter_stat(split.get("stat") or {})
                    elif "pitching" in group:
                        obj["pitcher"]=mlb_pitcher_stat(split.get("stat") or {})
            players_by_team[team_name][pid]=obj

    schedule=fetch_json(
        f"https://statsapi.mlb.com/api/v1/schedule?sportId=51&season={year}&gameType=F&hydrate=team"
    )
    scheduled=(schedule.get("dates") or [])
    games=[]
    seen_game=set()
    for day in scheduled:
        for g in day.get("games") or []:
            game_pk=int(g.get("gamePk") or 0)
            if not game_pk or game_pk in seen_game:
                continue
            away_id=int((((g.get("teams") or {}).get("away") or {}).get("team") or {}).get("id") or 0)
            home_id=int((((g.get("teams") or {}).get("home") or {}).get("team") or {}).get("id") or 0)
            if away_id not in selected or home_id not in selected:
                continue
            seen_game.add(game_pk)
            feed=fetch_json(f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live")
            pa_by_id=mlb_plate_appearances(feed)
            decisions=mlb_decision_flags(feed)
            date=clean((((feed.get("gameData") or {}).get("datetime") or {}).get("officialDate"))
                       or g.get("officialDate") or day.get("date") or "")
            away_name=team_zh(selected[away_id].get("name"))
            home_name=team_zh(selected[home_id].get("name"))
            game_obj={
                "gameId":str(game_pk),"date":date,"away":away_name,"home":home_name,
                "source":source,"sourceUrl":source_url,"teams":{}
            }

            box_teams=((feed.get("liveData") or {}).get("boxscore") or {}).get("teams") or {}
            for side,team_id,team_name,opp_name in [
                ("away",away_id,away_name,home_name),
                ("home",home_id,home_name,away_name)
            ]:
                tb=box_teams.get(side) or {}
                appeared=set(str(x) for x in ((tb.get("batters") or [])+(tb.get("pitchers") or [])))
                game_players=[]
                for entry in (tb.get("players") or {}).values():
                    person=entry.get("person") or {}
                    pid=str(person.get("id") or "")
                    if not pid or pid not in appeared:
                        continue
                    name=clean(person.get("fullName") or "")
                    stats=entry.get("stats") or {}
                    batting=stats.get("batting")
                    pitching=stats.get("pitching")
                    fielding=stats.get("fielding") or {}
                    hitter=mlb_hitter_stat(batting,fielding.get("errors") or 0) if batting is not None else None
                    pitcher=mlb_pitcher_stat(pitching) if pitching is not None else None
                    if hitter is not None:
                        hitter["plateAppearances"]=pa_by_id.get(pid,[])
                    if pitcher is not None:
                        flags=decisions.get(pid) or {}
                        pitcher["w"]=int(flags.get("w") or 0)
                        pitcher["l"]=int(flags.get("l") or 0)
                        pitcher["sv"]=int(flags.get("sv") or 0)
                    pos=clean((entry.get("position") or {}).get("abbreviation")
                              or (person.get("primaryPosition") or {}).get("abbreviation") or "")
                    gp={"id":pid,"name":name,"position":pos,"hitter":hitter,"pitcher":pitcher}
                    game_players.append(gp)

                    obj=players_by_team[team_name].get(pid)
                    if obj is None:
                        obj={"id":pid,"name":name,"number":"","position":pos,
                             "hitter":None,"pitcher":None,"games":[]}
                        players_by_team[team_name][pid]=obj
                    obj["games"].append({
                        "gameId":str(game_pk),"date":date,"opponent":opp_name,
                        "hitter":hitter,"pitcher":pitcher,
                        "source":source,"sourceUrl":source_url
                    })
                game_obj["teams"][team_name]=game_players
            games.append(game_obj)

    # For an appearing player whose hydrated total is missing, aggregate the game boxes.
    for team,pmap in players_by_team.items():
        for obj in pmap.values():
            if obj.get("hitter") is None:
                hs=[g.get("hitter") for g in obj.get("games",[]) if g.get("hitter")]
                if hs:
                    total={}
                    for h in hs:
                        for k in ("pa","ab","runs","hits","single","double","triple","hr","rbi","bb","ibb","hbp","sacBunt","sacFly","k","errors"):
                            total[k]=total.get(k,0)+int(h.get(k) or 0)
                    obj["hitter"]=total
            if obj.get("pitcher") is None:
                ps=[g.get("pitcher") for g in obj.get("games",[]) if g.get("pitcher")]
                if ps:
                    total={}
                    for p in ps:
                        for k in ("outs","h","r","er","bb","hbp","k","w","l","sv","hld","bsv","cg","sho","pitchCount"):
                            total[k]=total.get(k,0)+int(p.get(k) or 0)
                    outs=total.get("outs",0)
                    total["innings"]=f"{outs//3}.{outs%3}"
                    total["era"]=round(total.get("er",0)*27/outs,2) if outs else 0
                    total["whip"]=round((total.get("h",0)+total.get("bb",0))*3/outs,2) if outs else 0
                    obj["pitcher"]=total

    return {
        "competition":"WBC","year":year,
        "source":source,"sourceUrl":source_url,
        "games":sorted(games,key=lambda x:(x.get("date",""),x.get("gameId",""))),
        "teams":{team:list(pmap.values()) for team,pmap in players_by_team.items()}
    }


def debug_asian_games_text(text):
    lines=text.splitlines()
    pats=[
        r"Chinese Taipei",r"Korea",r"Japan",r"China",
        r"BOX SCORE",r"Box Score",r"Batting",r"Pitching",
        r"Game No",r"Match No",r"RESULT",r"AB\s+R\s+H"
    ]
    hits=[]
    for i,line in enumerate(lines):
        if any(re.search(p,line,re.I) for p in pats):
            hits.append(i)
    seen=set()
    print("ASIAN_GAMES_DIAG line_count=",len(lines),"hit_count=",len(hits))
    for i in hits[:120]:
        start=max(0,i-3); end=min(len(lines),i+8)
        key=(start,end)
        if key in seen: continue
        seen.add(key)
        print("ASIAN_GAMES_SNIP",i+1)
        for j in range(start,end):
            print(f"{j+1:05d}: {lines[j]}")
        print("ASIAN_GAMES_SNIP_END")

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

    try:
        wbc=build_wbc_event_2026()
        events["WBC:2026"]=wbc
        print(f'OK WBC:2026: {len(wbc["games"])} games, {len(wbc["teams"])} teams')
    except Exception as e:
        errors.append({"event":"WBC:2026","error":str(e),"sourceUrl":"https://www.mlb.com/world-baseball-classic"})
        print(f'ERROR WBC:2026: {e}')

    for meta in SOURCES:
        key=f'{meta["competition"]}:{meta["year"]}'
        try:
            text=fetch_pdf_text(meta["url"])
            event=build_asian_games_event(meta,text) if meta["competition"]=="亞洲運動會" else build_event(meta,text)
            if not event["games"]:
                if meta["competition"]=="亞洲運動會":
                    debug_asian_games_text(text)
                raise RuntimeError("no game summaries parsed")
            events[key]=event
            print(f'OK {key}: {len(event["games"])} games, {len(event["teams"])} teams')
            if meta["competition"]=="亞洲運動會":
                parsed_nos=sorted(int(str(g.get("gameId","")).split("-")[-1]) for g in event["games"] if str(g.get("gameId","")).split("-")[-1].isdigit())
                print("ASIAN_GAMES_PARSED_GAMES",parsed_nos)
                print("ASIAN_GAMES_MISSING_GAMES",[n for n in range(1,23) if n not in parsed_nos])
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
