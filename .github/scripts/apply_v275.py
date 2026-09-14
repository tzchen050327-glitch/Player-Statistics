from pathlib import Path
import re


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {n}")
    return text.replace(old, new, 1)


def regex_once(text, pattern, repl, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 regex occurrence, found {n}")
    return out

p = Path('app.js')
s = p.read_text(encoding='utf-8')

s = replace_once(
    s,
    "    const CPBL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-client';\n",
    "    const CPBL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-client';\n    const CPBL_POSTSEASON_DAILY_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-postseason-daily';\n",
    'postseason daily url',
)

s = regex_once(
    s,
    r"(    async function cpblRequest\(action, payload = \{\}\) \{\s*)const response = await fetch\(CPBL_API_URL, \{",
    r"\1const requestKindCode = String(payload?.kindCode || '').toUpperCase();\n      const requestUrl = action === 'daily' && ['E','C'].includes(requestKindCode)\n        ? CPBL_POSTSEASON_DAILY_API_URL\n        : CPBL_API_URL;\n      const response = await fetch(requestUrl, {",
    'cpbl request postseason routing',
)

n = s.count("      const levels = ['A','D'];")
if n != 2:
    raise SystemExit(f'CPBL daily levels: expected 2 occurrences, found {n}')
s = s.replace("      const levels = ['A','D'];", "      const levels = ['A','E','C','D'];")

s = replace_once(
    s,
    "      if (selectedLevel !== kindCode) {\n        persistActiveStatsProfile(player);\n        selectedLevel = kindCode;\n        const years = availableSeasonYears(player, kindCode);\n        selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);\n        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);\n        await loadRecord();\n      }\n      currentRecord.level = kindCode;",
    "      const recordLevel = kindCode === 'D' ? 'D' : 'A';\n      if (selectedLevel !== recordLevel) {\n        persistActiveStatsProfile(player);\n        selectedLevel = recordLevel;\n        const years = availableSeasonYears(player, recordLevel);\n        selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);\n        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);\n        await loadRecord();\n      }\n      currentRecord.level = recordLevel;",
    'daily record level normalization',
)

s = replace_once(
    s,
    "      if (daily.game?.opponent) currentRecord.opponent = normalizeTeamName(daily.game.opponent);\n\n      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });",
    "      if (daily.game?.opponent) currentRecord.opponent = normalizeTeamName(daily.game.opponent);\n      currentRecord.cpblKindCode = kindCode;\n      currentRecord.competition = daily.competition || (kindCode === 'E' ? 'playoff_challenge' : kindCode === 'C' ? 'taiwan_series' : kindCode === 'D' ? 'minor' : 'regular');\n      currentRecord.competitionLabel = daily.competitionLabel || (kindCode === 'E' ? '季後挑戰賽' : kindCode === 'C' ? '總冠軍賽' : kindCode === 'D' ? '二軍' : '一軍例行賽');\n\n      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });",
    'daily competition metadata',
)

s = replace_once(
    s,
    "      const isToday = els.gameDate.value === localISODate();\n      currentRecord.cpblReadOnlyImport = !isToday;\n\n      if (isToday) {",
    "      const isToday = els.gameDate.value === localISODate();\n      const syncSeasonToday = isToday && !['E','C'].includes(kindCode);\n      currentRecord.cpblReadOnlyImport = !syncSeasonToday;\n\n      if (syncSeasonToday) {",
    'postseason isolated daily import',
)

s = replace_once(
    s,
    "      currentRecord.cpblImportedAt = Date.now();\n      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.cpblImportedAt };",
    "      currentRecord.cpblImportedAt = Date.now();\n      const cpblImportSource = ['E','C'].includes(kindCode)\n        ? `CPBL 官方｜${currentRecord.competitionLabel}`\n        : officialDataSourceLabel(player);\n      currentRecord.syncMeta = { source: cpblImportSource, updatedAt: currentRecord.cpblImportedAt };",
    'daily import source label',
)

s = replace_once(
    s,
    "      const levelLabel = kindCode === 'D' ? '二軍' : '一軍';\n      setStatus(isToday\n        ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料並同步今日累積數據。`\n        : `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；歷史日期不會寫入球員累積數據。`);",
    "      const levelLabel = kindCode === 'D' ? '二軍' : kindCode === 'E' ? '季後挑戰賽' : kindCode === 'C' ? '總冠軍賽' : '一軍例行賽';\n      setStatus(syncSeasonToday\n        ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料並同步今日累積數據。`\n        : isToday && ['E','C'].includes(kindCode)\n          ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；季後賽單場獨立保存，不會寫入例行賽累積數據。`\n          : `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；歷史日期不會寫入球員累積數據。`);",
    'daily status label',
)

s = replace_once(
    s,
    "    function batchRecordFromCpblDaily(player, daily, level) {\n      if (!daily?.found) return null;\n      const record = {\n        ...defaultGameRecord(player),\n        key: `${els.gameDate.value}:${player.id}:${level}`,\n        playerId: player.id,\n        date: els.gameDate.value,\n        level,",
    "    function batchRecordFromCpblDaily(player, daily, level) {\n      if (!daily?.found) return null;\n      const recordLevel = level === 'D' ? 'D' : 'A';\n      const record = {\n        ...defaultGameRecord(player),\n        key: `${els.gameDate.value}:${player.id}:${recordLevel}`,\n        playerId: player.id,\n        date: els.gameDate.value,\n        level: recordLevel,\n        cpblKindCode: level,\n        competition: daily.competition || (level === 'E' ? 'playoff_challenge' : level === 'C' ? 'taiwan_series' : level === 'D' ? 'minor' : 'regular'),\n        competitionLabel: daily.competitionLabel || (level === 'E' ? '季後挑戰賽' : level === 'C' ? '總冠軍賽' : level === 'D' ? '二軍' : '一軍例行賽'),",
    'batch record competition metadata',
)

s = replace_once(
    s,
    "        cpblReadOnlyImport: els.gameDate.value !== localISODate(),",
    "        cpblReadOnlyImport: ['E','C'].includes(level) || els.gameDate.value !== localISODate(),",
    'batch postseason read-only',
)

s = replace_once(
    s,
    "          return { record, level, fetched:true };",
    "          return { record, level: level === 'D' ? 'D' : 'A', kindCode: level, fetched:true };",
    'batch returned level',
)

old_help = '會先查一軍，當日一軍無出賽再自動查二軍；若同場有打擊與投球，兩邊會一次匯入。'
if old_help not in s:
    raise SystemExit('CPBL import helper text not found')
s = s.replace(old_help, '會自動查一軍例行賽、季後挑戰賽、總冠軍賽與二軍；若同場有打擊與投球，兩邊會一次匯入。', 1)

p.write_text(s, encoding='utf-8')

p = Path('landscape-state.js')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "  const DETAIL_RE = /\\/(?:cpbl-game-detail|league-game-detail)(?:\\?|$)/i;",
    "  const DETAIL_RE = /\\/(?:cpbl-game-detail|cpbl-postseason-detail|npb-game-detail|league-game-detail)(?:\\?|$)/i;",
    'landscape detail regex',
)
s = replace_once(
    s,
    "    if (!detail || String(detail?.league || '').toUpperCase() !== 'CPBL') return;",
    "    const league = String(detail?.league || '').toUpperCase();\n    if (!detail || !['CPBL','NPB'].includes(league)) return;",
    'landscape league guard',
)
s = replace_once(
    s,
    """  window.addEventListener('cpbl-live-cache-update', event => {
    const detail = event?.detail?.detail || event?.detail?.row?.published_payload || null;
    if (detail?.game) {
      latestDetail = detail;
      schedule();
    }
  });""",
    """  const acceptLiveCacheUpdate = event => {
    const detail = event?.detail?.detail || event?.detail?.row?.published_payload || null;
    if (detail?.game && ['CPBL','NPB'].includes(String(detail?.league || '').toUpperCase())) {
      latestDetail = detail;
      schedule();
    }
  };
  window.addEventListener('cpbl-live-cache-update', acceptLiveCacheUpdate);
  window.addEventListener('npb-live-cache-update', acceptLiveCacheUpdate);""",
    'landscape live update block',
)
p.write_text(s, encoding='utf-8')

files = [
    'app.js','index.html','service-worker.js','game-detail-enhancement.js','game-detail-enhancement.css',
    'report-layout.js','report-layout.css','cpbl-realtime.js','npb-realtime.js','live-static-update.js',
    'cpbl-cache-router.js','landscape-state.js','landscape-state.css','manifest.webmanifest','rescue.html',
    'styles.css','postseason-history.js','postseason-history.css'
]
for name in files:
    q = Path(name)
    if not q.exists():
        continue
    text = q.read_text(encoding='utf-8').replace('v2.74','v2.75').replace('v274','v275')
    q.write_text(text, encoding='utf-8')
Path('version.json').write_text('{"version":"v2.75"}\n', encoding='utf-8')
