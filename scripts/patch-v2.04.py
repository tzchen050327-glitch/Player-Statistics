from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new, 1)


def sub_once(pattern, repl, label, flags=0):
    global s
    s2, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {n}')
    s = s2


if 'v2.03' not in s:
    raise RuntimeError('v2.03 not found')
s = s.replace('v2.03', 'v2.04')

# 1) Sync lock + 2) provenance display styles.
css = r'''

    /* ===== v2.04 SYNC SAFETY + SOURCE META ===== */
    body.sync-ui-locked .app,
    body.sync-ui-locked dialog {
      pointer-events: none !important;
      user-select: none;
    }
    body.sync-ui-locked #syncProgressOverlay,
    body.sync-ui-locked .sync-progress-overlay {
      pointer-events: auto !important;
    }
    body.sync-ui-locked { cursor: progress; }

    .sync-source-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px 14px;
      margin: 0 0 14px;
      padding: 10px 12px;
      border: 1px solid #dbe4ed;
      border-radius: 12px;
      background: linear-gradient(180deg,#f9fbfd,#f4f8fb);
      color: #627184;
      font-size: 12px;
      line-height: 1.45;
    }
    .sync-source-meta::before {
      content: '';
      width: 7px;
      height: 7px;
      flex: 0 0 7px;
      border-radius: 999px;
      background: #3f8b67;
      box-shadow: 0 0 0 3px rgba(63,139,103,.10);
    }
    .sync-source-meta strong { color: #173c61; font-weight: 900; }
    .sync-source-meta .sync-meta-muted { color: #8793a1; }

    @media (max-width:700px) {
      .sync-source-meta { gap: 5px 10px; padding: 9px 10px; }
    }
    /* ===== v2.04 END ===== */
'''
replace_once('</style>', css + '\n</style>', 'style close')

helpers = r'''
    let syncUiLocked = false;

    function setSyncUiLocked(locked) {
      syncUiLocked = Boolean(locked);
      document.body?.classList.toggle('sync-ui-locked', syncUiLocked);
      if (syncUiLocked) document.body?.setAttribute('aria-busy', 'true');
      else document.body?.removeAttribute('aria-busy');
    }

    function officialDataSourceLabel(player) {
      if (!player) return '本機資料';
      const scope = playerScope(player);
      if (scope === 'cpbl') return 'CPBL 官方';
      if (scope === 'international') {
        const competition = playerSpecialCompetition(player) || '國際賽';
        return `${competition} 官方資料`;
      }
      if (scope === 'overseas') {
        if (isUsPlayer(player)) return 'MLB / MiLB 官方';
        const provider = overseasProviderLabel(player.externalProvider || playerSpecialCompetition(player));
        return `${provider || '國外聯盟'} 官方`;
      }
      return '本機手動資料';
    }

    function formatSyncMetaTime(value) {
      const time = Number(value) || 0;
      if (!time) return '尚未記錄';
      const d = new Date(time);
      if (Number.isNaN(d.getTime())) return '尚未記錄';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function ensureSyncMetaProfiles(player) {
      if (!player.syncMetaProfiles || typeof player.syncMetaProfiles !== 'object' || Array.isArray(player.syncMetaProfiles)) {
        player.syncMetaProfiles = {};
      }
      return player.syncMetaProfiles;
    }

    async function markSuccessfulSeasonSyncMeta() {
      const player = selectedPlayer();
      if (!player) return;
      try {
        const now = Date.now();
        const key = statsProfileKey(selectedSeason, selectedLevel);
        const source = officialDataSourceLabel(player);
        ensureSyncMetaProfiles(player)[key] = { source, updatedAt: now };
        player.lastOfficialSyncAt = now;
        await savePlayer(player);
      } catch (error) {
        console.warn('同步來源資訊儲存失敗', error);
      }
    }

    function syncMetaForCurrentView(player) {
      const source = officialDataSourceLabel(player);
      if (selectedTab === 'today') {
        const meta = currentRecord?.syncMeta || null;
        const updatedAt = Number(meta?.updatedAt)
          || Number(currentRecord?.cpblImportedAt)
          || Number(currentRecord?.externalImportedAt)
          || (currentRecord?.internationalOfficialImport ? Number(currentRecord?.updatedAt) : 0);
        return { source: meta?.source || source, updatedAt };
      }

      const key = statsProfileKey(selectedSeason, selectedLevel);
      const meta = player?.syncMetaProfiles?.[key] || null;
      const localOnly = playerScope(player) === 'local';
      return {
        source: meta?.source || source,
        updatedAt: Number(meta?.updatedAt) || Number(player?.lastOfficialSyncAt) || (localOnly ? Number(player?.updatedAt) : 0)
      };
    }

    function renderSyncMetaBanner(player) {
      if (!els.content || !player || selectedTab === 'photos') return;
      const meta = syncMetaForCurrentView(player);
      const levelText = supportsLeagueLevelTabs(player) && selectedTab !== 'today'
        ? `｜${selectedLevel === 'D' ? '二軍' : '一軍'}`
        : '';
      els.content.insertAdjacentHTML('afterbegin', `
        <div class="sync-source-meta" aria-label="資料來源與最後同步時間">
          <span>資料來源 <strong>${escapeHtml(meta.source || '未提供')}</strong>${escapeHtml(levelText)}</span>
          <span>最後同步 <strong class="${meta.updatedAt ? '' : 'sync-meta-muted'}">${escapeHtml(formatSyncMetaTime(meta.updatedAt))}</strong></span>
        </div>`);
    }

    function pitcherSpecialRecordState(game = {}) {
      const outs = ipToOuts(game.innings) || Math.max(0, Number(game.outs) || 0);
      const pitches = Math.max(0, (Number(game.pitchTens) || 0) * 10 + (Number(game.pitchOnes) || 0));
      const result = pitcherResult(game);
      let cg = Boolean(Number(game.cg) || game.cg);
      let sho = Boolean(Number(game.sho) || game.sho);
      if (sho) cg = true;
      if (cg && Number(game.r || 0) === 0) sho = true;
      const noWalkHbp = Boolean(Number(game.noWalkHbp) || game.noWalkHbp)
        || (cg && Number(game.bb || 0) === 0 && Number(game.hbp || 0) === 0);

      let featured = '';
      if (cg && outs >= 27 && Number(game.h) === 0 && Number(game.bb) === 0 && Number(game.hbp) === 0 && Number(game.otherReach || 0) === 0) {
        featured = '完全比賽';
      } else if (cg && outs >= 27 && Number(game.h) === 0) {
        featured = '無安打比賽';
      } else if (cg && sho && result === 'W' && outs >= 27 && pitches < 100) {
        featured = 'Maddux 完封勝';
      }

      const tags = [];
      if (cg) tags.push('完投');
      if (sho) tags.push('完封');
      if (noWalkHbp) tags.push('無四死球');
      if (result === 'HLD') tags.push('中繼成功');
      if (result === 'SV') tags.push('救援成功');
      if (game.bsv) tags.push('救援失敗');
      if (game.rainCalled) tags.push('因雨提前裁定');
      if (result === 'W') tags.push('勝');
      if (result === 'L') tags.push('敗');
      return { cg, sho, noWalkHbp, featured, tags, outs, pitches, result };
    }

    function standardizePitcherSpecialRecords(game = {}) {
      const state = pitcherSpecialRecordState(game);
      game.cg = state.cg;
      game.sho = state.sho;
      game.noWalkHbp = state.noWalkHbp;
      return state;
    }
'''
needle = "    let currentRecord = null;\n    let internationalSelectedGameKey = '';"
replace_once(needle, needle + '\n' + helpers, 'state helpers')

# Sync locking lifecycle.
replace_once(
    "    function setSyncProgress(percent, status, { error = false } = {}) {\n      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));",
    "    function setSyncProgress(percent, status, { error = false } = {}) {\n      setSyncUiLocked(true);\n      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));",
    'setSyncProgress'
)
replace_once(
    "    function hideSyncProgress() {\n      els.syncProgressOverlay?.classList.add('hidden');\n      els.syncProgressCard?.classList.remove('error');\n    }",
    "    function hideSyncProgress() {\n      els.syncProgressOverlay?.classList.add('hidden');\n      els.syncProgressCard?.classList.remove('error');\n      setSyncUiLocked(false);\n    }",
    'hideSyncProgress'
)
replace_once(
    "    async function finishSyncProgress(status = '同步完成') {\n      setSyncProgress(100, status);",
    "    async function finishSyncProgress(status = '同步完成') {\n      setSyncProgress(100, status);\n      await markSuccessfulSeasonSyncMeta();",
    'finishSyncProgress'
)

# Source banner after normal content render.
sub_once(
    r"(els\.seasonReportBtn\?\.classList\.toggle\('hidden', !proSeasonStatsActive\);\s*\n\s*)renderContent\(\);",
    r"\1renderContent();\n      renderSyncMetaBanner(player);",
    'renderAll metadata banner'
)

# Daily provenance for new imports.
replace_once(
    "      currentRecord.externalImportedAt = Date.now();\n\n      const importedHasHitter",
    "      currentRecord.externalImportedAt = Date.now();\n      currentRecord.syncMeta = {\n        source: officialDataSourceLabel(player),\n        updatedAt: currentRecord.externalImportedAt\n      };\n\n      const importedHasHitter",
    'external daily meta'
)
replace_once(
    "      currentRecord.cpblImportedAt = Date.now();\n      await saveRecord();",
    "      currentRecord.cpblImportedAt = Date.now();\n      currentRecord.syncMeta = {\n        source: officialDataSourceLabel(player),\n        updatedAt: currentRecord.cpblImportedAt\n      };\n      await saveRecord();",
    'CPBL daily meta'
)

# One canonical special-record pass for all official daily imports.
replace_once(
    "        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;\n        currentRecord.externalWalksCombined = Boolean(pitcher.walksCombined);",
    "        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;\n        currentRecord.externalWalksCombined = Boolean(pitcher.walksCombined);\n        standardizePitcherSpecialRecords(g);",
    'import special normalizer'
)

# Canvas consumes the canonical state instead of duplicating rules.
old_feature = r"""        const result = pitcherResult\(g\);
        const outs = ipToOuts\(g\.innings\) \|\| 0;
        let specialRecord = '';

        if \(g\.cg && outs >= 27 && Number\(g\.h\) === 0 && Number\(g\.bb\) === 0 && Number\(g\.hbp\) === 0 && Number\(g\.otherReach \|\| 0\) === 0\) \{
          specialRecord = '完全比賽';
        \} else if \(g\.cg && outs >= 27 && Number\(g\.h\) === 0\) \{
          specialRecord = '無安打比賽';
        \} else if \(g\.cg && g\.sho && result === 'W' && outs >= 27 && pitches < 100\) \{
          specialRecord = 'Maddux 完封勝';
        \}"""
sub_once(old_feature, "        const specialState = pitcherSpecialRecordState(g);\n        const result = specialState.result;\n        const specialRecord = specialState.featured;", 'canvas featured special record')

old_tags = r"""          const tags = \[\];
          if \(g\.cg\) tags\.push\('完投'\);
          if \(g\.sho\) tags\.push\('完封'\);
          if \(g\.noWalkHbp\) tags\.push\('無四死球'\);
          if \(result === 'HLD'\) tags\.push\('中繼成功'\);
          if \(result === 'SV'\) tags\.push\('救援成功'\);
          if \(g\.bsv\) tags\.push\('救援失敗'\);
          if \(g\.rainCalled\) tags\.push\('因雨提前裁定'\);
          if \(result === 'W'\) tags\.push\('勝'\);
          if \(result === 'L'\) tags\.push\('敗'\);
          drawTags\(ctx, tags, tagX, tagBottom, tagW\);"""
sub_once(old_tags, "          drawTags(ctx, specialState.tags, tagX, tagBottom, tagW);", 'canvas standard tags')

if "      selectedTab = 'base';\n      selectedLevel = 'A';" not in s:
    raise RuntimeError('base-tab safety from v2.03 is missing')

required = [
    "const APP_VERSION = 'v2.04'",
    'setSyncUiLocked(true);',
    'renderSyncMetaBanner(player);',
    'standardizePitcherSpecialRecords(g);',
    'pitcherSpecialRecordState(g)'
]
for item in required:
    if item not in s:
        raise RuntimeError('missing required patch: ' + item)

path.write_text(s, encoding='utf-8')
archive = Path('index v2.04.html')
if archive.exists():
    raise RuntimeError('index v2.04.html already exists')
archive.write_text(s, encoding='utf-8')
print('v2.04 patch complete', len(s))
