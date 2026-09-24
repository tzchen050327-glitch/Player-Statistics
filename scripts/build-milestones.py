#!/usr/bin/env python3
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SEASON = datetime.now().year
CPBL = "https://cpbl.com.tw"
NPB = "https://npb.jp"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"

CPBL_TEAMS = {
    "AAA": "味全龍",
    "ADD": "統一7-ELEVEn獅",
    "AEO": "富邦悍將",
    "ACN": "中信兄弟",
    "AJL": "樂天桃猿",
    "AKP": "台鋼雄鷹",
}
NPB_TEAMS = {
    "t": "阪神虎", "db": "橫濱DeNA灣星", "g": "讀賣巨人", "d": "中日龍",
    "c": "廣島東洋鯉魚", "s": "東京養樂多燕子", "h": "福岡軟銀鷹",
    "f": "北海道日本火腿鬥士", "b": "歐力士猛牛", "e": "東北樂天金鷲",
    "l": "埼玉西武獅", "m": "千葉羅德海洋",
}


def new_session():
    s = requests.Session()
    retry = Retry(
        total=3, connect=3, read=3,
        backoff_factor=0.45,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"]),
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({
        "User-Agent": UA,
        "Accept-Language": "zh-TW,zh;q=0.9,ja;q=0.8,en;q=0.6",
    })
    return s


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value):
    s = clean(value).replace(",", "").replace("（", "").replace("）", "")
    try:
        return float(s)
    except Exception:
        return 0.0


def whole(value):
    return int(round(number(value)))


def innings_to_outs(value):
    s = clean(value).replace(" ", "")
    m = re.fullmatch(r"(\d+)(?:\.([012]))?", s)
    if m:
        return int(m.group(1)) * 3 + int(m.group(2) or 0)
    m = re.fullmatch(r"(\d+)([12])/3", s)
    if m:
        return int(m.group(1)) * 3 + int(m.group(2))
    return 0


def outs_to_innings(outs):
    outs = max(0, int(round(outs or 0)))
    return f"{outs // 3}.{outs % 3}"


def csrf(html):
    patterns = [
        r"RequestVerificationToken\s*:\s*['\"]([^'\"]+)",
        r'name=["\']__RequestVerificationToken["\'][^>]*value=["\']([^"\']+)',
    ]
    for pattern in patterns:
        m = re.search(pattern, html, re.I)
        if m:
            return m.group(1)
    return ""


def html_cells(tr):
    return [clean(x.get_text(" ", strip=True)) for x in tr.find_all(["th", "td"])]


def normalize_name(name):
    return clean(name).replace(" ", "").replace("　", "").lstrip("*+")


def merge_by_id(rows):
    out = {}
    for row in rows:
        pid = str(row.get("id") or "").strip()
        if pid:
            out[pid] = row
    return list(out.values())


# ---------- CPBL ----------

def cpbl_batting_for_team(code, team):
    s = new_session()
    r = s.get(f"{CPBL}/team/teamscore?ClubNo={code}", timeout=25)
    r.raise_for_status()
    html = r.text
    start = html.find("打擊成績")
    end = html.find("投球成績", max(0, start))
    segment = html[start:end if end > start else None] if start >= 0 else html
    soup = BeautifulSoup(segment, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        a = tr.find("a", href=re.compile(r"/team/person\?acnt=\d+"))
        if not a:
            continue
        m = re.search(r"acnt=(\d+)", a.get("href", ""))
        cells = html_cells(tr)
        if not m or len(cells) < 23:
            continue
        rows.append({
            "id": m.group(1),
            "name": normalize_name(cells[0]),
            "team": team,
            "stats": {
                "hits": whole(cells[6]),
                "hr": whole(cells[10]),
                "rbi": whole(cells[4]),
                "runs": whole(cells[5]),
            },
        })
    return rows


def cpbl_pitching_for_team(code, team):
    s = new_session()
    page = s.get(f"{CPBL}/team/teamscore?ClubNo={code}", timeout=25)
    page.raise_for_status()
    token = csrf(page.text)
    data = {
        "ClubNo": code, "KindCode": "A", "Year": str(SEASON),
        "Position": "02", "DefendStation": "", "ExecAction": "Q",
        "IndexOfPages": "0", "Sortby": "01",
    }
    if token:
        data["__RequestVerificationToken"] = token
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{CPBL}/team/teamscore?ClubNo={code}",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
    if token:
        headers["RequestVerificationToken"] = token
    r = s.post(f"{CPBL}/team/teamscoreaction", data=data, headers=headers, timeout=25)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        a = tr.find("a", href=re.compile(r"/team/person\?acnt=\d+"))
        if not a:
            continue
        m = re.search(r"acnt=(\d+)", a.get("href", ""))
        cells = html_cells(tr)
        if not m or len(cells) < 22:
            continue
        rows.append({
            "id": m.group(1),
            "name": normalize_name(cells[0]).lstrip("#"),
            "team": team,
            "stats": {
                "k": whole(cells[21]),
                "w": whole(cells[7]),
                "sv": whole(cells[9]),
                "hld": whole(cells[10]),
                "outs": innings_to_outs(cells[11]),
            },
        })
    return rows


def cpbl_person_json(acnt, path):
    s = new_session()
    page_url = f"{CPBL}/team/person?acnt={acnt}"
    page = s.get(page_url, timeout=25)
    page.raise_for_status()
    token = csrf(page.text)
    data = {"acnt": acnt, "kindCode": "A"}
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": page_url,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
    if token:
        headers["RequestVerificationToken"] = token
    r = s.post(f"{CPBL}{path}", data=data, headers=headers, timeout=25)
    r.raise_for_status()
    return r.json()


def cpbl_parse_json_rows(payload, key_names):
    if not isinstance(payload, dict) or not payload.get("Success"):
        return []
    raw = None
    for key in key_names:
        if payload.get(key):
            raw = payload.get(key)
            break
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def cpbl_career_for_player(meta):
    acnt = str(meta["id"])
    batting = []
    pitching = []
    try:
        batting = cpbl_parse_json_rows(
            cpbl_person_json(acnt, "/team/getbattingscore"),
            ("BattingScore",),
        )
    except Exception as exc:
        print("CPBL batting career failed", acnt, exc)
    time.sleep(0.08)
    try:
        pitching = cpbl_parse_json_rows(
            cpbl_person_json(acnt, "/team/getpitchscore"),
            ("PitchScore", "PitchingScore"),
        )
    except Exception as exc:
        print("CPBL pitching career failed", acnt, exc)

    hitter = None
    if batting:
        stats = {"hits": 0, "hr": 0, "rbi": 0, "runs": 0}
        for row in batting:
            stats["hits"] += sum(whole(row.get(k)) for k in ("OneBaseHitCnt", "TwoBaseHitCnt", "ThreeBaseHitCnt", "HomeRunCnt"))
            stats["hr"] += whole(row.get("HomeRunCnt"))
            stats["rbi"] += whole(row.get("RunBattedINCnt"))
            stats["runs"] += whole(row.get("ScoreCnt"))
        if any(stats.values()):
            hitter = {**meta, "stats": stats}

    pitcher = None
    if pitching:
        stats = {"k": 0, "w": 0, "sv": 0, "hld": 0, "outs": 0}
        for row in pitching:
            stats["k"] += whole(row.get("StrikeOutCnt"))
            stats["w"] += whole(row.get("Wins"))
            stats["sv"] += whole(row.get("SaveOK"))
            stats["hld"] += whole(row.get("ReliefPointCnt"))
            stats["outs"] += innings_to_outs(row.get("InningPitched"))
        if any(stats.values()):
            pitcher = {**meta, "stats": stats}
    return hitter, pitcher


def build_cpbl():
    season_hitters, season_pitchers = [], []
    for code, team in CPBL_TEAMS.items():
        try:
            season_hitters.extend(cpbl_batting_for_team(code, team))
        except Exception as exc:
            print("CPBL team batting failed", code, exc)
        try:
            season_pitchers.extend(cpbl_pitching_for_team(code, team))
        except Exception as exc:
            print("CPBL team pitching failed", code, exc)

    season_hitters = merge_by_id(season_hitters)
    season_pitchers = merge_by_id(season_pitchers)
    active = {}
    for row in season_hitters + season_pitchers:
        active[row["id"]] = {"id": row["id"], "name": row["name"], "team": row["team"]}

    career_hitters, career_pitchers = [], []
    metas = list(active.values())
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(cpbl_career_for_player, meta) for meta in metas]
        for future in as_completed(futures):
            try:
                h, p = future.result()
                if h:
                    career_hitters.append(h)
                if p:
                    career_pitchers.append(p)
            except Exception as exc:
                print("CPBL career worker failed", exc)

    return {
        "season": {"hitters": season_hitters, "pitchers": season_pitchers},
        "career": {"hitters": career_hitters, "pitchers": career_pitchers},
    }


# ---------- NPB ----------

def npb_player_id(tr):
    for a in tr.find_all("a", href=True):
        href = str(a.get("href", ""))
        m = re.search(r"(?:players/|/)(\d{8})\.html(?:$|[?#])", href)
        if m:
            return m.group(1)
    return ""


def npb_table_rows(url):
    s = new_session()
    r = s.get(url, timeout=25)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    return soup


def npb_season_batting(code, team):
    soup = npb_table_rows(f"{NPB}/bis/{SEASON}/stats/idb1_{code}.html")
    out = []
    for tr in soup.find_all("tr"):
        pid = npb_player_id(tr)
        cells = html_cells(tr)
        if not pid or len(cells) < 11:
            continue
        out.append({
            "id": pid,
            "name": normalize_name(cells[0]),
            "team": team,
            "stats": {
                "runs": whole(cells[4]),
                "hits": whole(cells[5]),
                "hr": whole(cells[8]),
                "rbi": whole(cells[10]),
            },
        })
    return out


def npb_season_pitching(code, team):
    soup = npb_table_rows(f"{NPB}/bis/{SEASON}/stats/idp1_{code}.html")
    out = []
    for tr in soup.find_all("tr"):
        pid = npb_player_id(tr)
        cells = html_cells(tr)
        if not pid or len(cells) < 19:
            continue
        out.append({
            "id": pid,
            "name": normalize_name(cells[0]),
            "team": team,
            "stats": {
                "w": whole(cells[2]),
                "sv": whole(cells[4]),
                "hld": whole(cells[5]),
                "outs": innings_to_outs(cells[12]),
                "k": whole(cells[18]),
            },
        })
    return out


def npb_headers(table):
    for tr in table.find_all("tr"):
        cells = html_cells(tr)
        if cells and ("年度" in cells or "Year" in cells):
            return cells
    return []


def npb_career_from_profile(meta):
    pid = str(meta["id"])
    s = new_session()
    r = s.get(f"{NPB}/bis/players/{pid}.html", timeout=25)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    hitter_stats = {"hits": 0, "hr": 0, "rbi": 0, "runs": 0}
    pitcher_stats = {"k": 0, "w": 0, "sv": 0, "hld": 0, "outs": 0}

    for table in soup.find_all("table"):
        headers = npb_headers(table)
        if not headers:
            continue
        idx = {clean(v): i for i, v in enumerate(headers)}
        is_bat = "安打" in idx and "本塁打" in idx and "打点" in idx
        is_pit = "投球回" in idx and "三振" in idx and ("勝利" in idx or "勝" in idx)
        if not (is_bat or is_pit):
            continue

        for tr in table.find_all("tr"):
            cells = html_cells(tr)
            if not cells or not re.fullmatch(r"\d{4}", cells[0] or ""):
                continue
            year = int(cells[0])
            if year > SEASON or year < 1936:
                continue
            if is_bat:
                def bget(key):
                    i = idx.get(key, -1)
                    return cells[i] if 0 <= i < len(cells) else 0
                hitter_stats["hits"] += whole(bget("安打"))
                hitter_stats["hr"] += whole(bget("本塁打"))
                hitter_stats["rbi"] += whole(bget("打点"))
                hitter_stats["runs"] += whole(bget("得点"))
            if is_pit:
                def pget(*keys):
                    for key in keys:
                        i = idx.get(key, -1)
                        if 0 <= i < len(cells):
                            return cells[i]
                    return 0
                pitcher_stats["k"] += whole(pget("三振", "奪三振"))
                pitcher_stats["w"] += whole(pget("勝利", "勝"))
                pitcher_stats["sv"] += whole(pget("セーブ", "S"))
                pitcher_stats["hld"] += whole(pget("ホールド", "HLD"))
                pitcher_stats["outs"] += innings_to_outs(pget("投球回"))

    hitter = {**meta, "stats": hitter_stats} if any(hitter_stats.values()) else None
    pitcher = {**meta, "stats": pitcher_stats} if any(pitcher_stats.values()) else None
    return hitter, pitcher


def build_npb():
    season_hitters, season_pitchers = [], []
    for code, team in NPB_TEAMS.items():
        try:
            season_hitters.extend(npb_season_batting(code, team))
        except Exception as exc:
            print("NPB team batting failed", code, exc)
        try:
            season_pitchers.extend(npb_season_pitching(code, team))
        except Exception as exc:
            print("NPB team pitching failed", code, exc)

    season_hitters = merge_by_id(season_hitters)
    season_pitchers = merge_by_id(season_pitchers)
    active = {}
    for row in season_hitters + season_pitchers:
        active[row["id"]] = {"id": row["id"], "name": row["name"], "team": row["team"]}

    career_hitters, career_pitchers = [], []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(npb_career_from_profile, meta) for meta in active.values()]
        for future in as_completed(futures):
            try:
                h, p = future.result()
                if h:
                    career_hitters.append(h)
                if p:
                    career_pitchers.append(p)
            except Exception as exc:
                print("NPB career worker failed", exc)

    return {
        "season": {"hitters": season_hitters, "pitchers": season_pitchers},
        "career": {"hitters": career_hitters, "pitchers": career_pitchers},
    }


def stable_sort(rows):
    return sorted(rows, key=lambda x: (clean(x.get("team")), clean(x.get("name")), clean(x.get("id"))))


def normalize_payload(payload):
    for league in ("CPBL", "NPB"):
        for scope in ("season", "career"):
            for role in ("hitters", "pitchers"):
                payload["leagues"][league][scope][role] = stable_sort(payload["leagues"][league][scope][role])
    return payload


def same_day_cpbl_snapshot():
    path = Path("data/milestones.json")
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        generated = str(data.get("generatedAt") or "")[:10]
        today = datetime.now(timezone.utc).date().isoformat()
        cpbl = data.get("leagues", {}).get("CPBL")
        if generated == today and int(data.get("season") or 0) == SEASON and cpbl:
            return cpbl
    except Exception:
        return None
    return None


def main():
    print("Building milestone snapshot for", SEASON)
    cpbl = same_day_cpbl_snapshot()
    if cpbl:
        print("Reusing today's CPBL snapshot")
    else:
        cpbl = build_cpbl()
    npb = build_npb()
    payload = normalize_payload({
        "schemaVersion": 2,
        "season": SEASON,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "official-league-daily-snapshot",
        "leagues": {"CPBL": cpbl, "NPB": npb},
    })

    out = Path("data/milestones.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    counts = {}
    for league in ("CPBL", "NPB"):
        counts[league] = {
            scope: {
                role: len(payload["leagues"][league][scope][role])
                for role in ("hitters", "pitchers")
            }
            for scope in ("season", "career")
        }
    print(json.dumps(counts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
