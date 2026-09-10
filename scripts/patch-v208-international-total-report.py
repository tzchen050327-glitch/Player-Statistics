from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# 1) Bump app version
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
old = "const APP_VERSION = 'v2.07';"
new = "const APP_VERSION = 'v2.08';"
assert s.count(old) == 1, f'APP_VERSION occurrence: {s.count(old)}'
p.write_text(s.replace(old, new), encoding='utf-8')

# 2) Preserve both hitter/pitcher tournament totals for report output
p = ROOT / 'js' / '05-provider-international.js'
s = p.read_text(encoding='utf-8')
old = """        const official = player.type === 'pitcher' ? pitcher : hitter;
        if (official) {
          player.stats = player.type === 'pitcher'
            ? externalPitcherStatsToLocal(official)
            : externalHitterStatsToLocal(official);
        }

        player.internationalSource = remote.source || player.internationalSource || '';
"""
new = """        const hitterLocal = hitter ? externalHitterStatsToLocal(hitter) : null;
        const pitcherLocal = pitcher ? externalPitcherStatsToLocal(pitcher) : null;
        storeRoleStatsProfile(player, year, 'A', hitterLocal, pitcherLocal);

        const official = player.type === 'pitcher' ? pitcher : hitter;
        if (official) {
          player.stats = player.type === 'pitcher'
            ? (pitcherLocal || pitcherDefaults())
            : (hitterLocal || hitterDefaults());
        }

        player.internationalSource = remote.source || player.internationalSource || '';
"""
assert s.count(old) == 1, f'international totals block occurrence: {s.count(old)}'
s = s.replace(old, new)

old = """      const completeGames = games.filter(game => !game?.partial);
      if (!player.internationalStatsFound && completeGames.length) {
        const hitterGames = completeGames.filter(game => game?.hitter);
        const pitcherGames = completeGames.filter(game => game?.pitcher);
        if (player.type === 'pitcher' && pitcherGames.length) {
          player.stats = internationalPitcherTotalsFromGames(pitcherGames);
          player.internationalStatsFound = true;
          player.internationalSource = '官方逐場 Box 合計';
          player.externalLastUpdatedAt = Date.now();
          await savePlayer(player);
        } else if (player.type === 'hitter' && hitterGames.length) {
          player.stats = internationalHitterTotalsFromGames(hitterGames);
          player.internationalStatsFound = true;
          player.internationalSource = '官方逐場 Box 合計';
          player.externalLastUpdatedAt = Date.now();
          await savePlayer(player);
        }
      }
"""
new = """      const completeGames = games.filter(game => !game?.partial);
      if (completeGames.length) {
        const hitterGames = completeGames.filter(game => game?.hitter);
        const pitcherGames = completeGames.filter(game => game?.pitcher);
        const hitterTotals = hitterGames.length ? internationalHitterTotalsFromGames(hitterGames) : null;
        const pitcherTotals = pitcherGames.length ? internationalPitcherTotalsFromGames(pitcherGames) : null;

        // Keep a tournament role pair so two-way players can export separate
        // total batting and pitching report images using the normal league template.
        if (!player.internationalStatsFound) {
          storeRoleStatsProfile(player, year, 'A', hitterTotals, pitcherTotals);
          if (player.type === 'pitcher' && pitcherTotals) {
            player.stats = pitcherTotals;
            player.internationalStatsFound = true;
          } else if (player.type === 'hitter' && hitterTotals) {
            player.stats = hitterTotals;
            player.internationalStatsFound = true;
          } else if (pitcherTotals) {
            player.type = 'pitcher';
            player.stats = pitcherTotals;
            player.internationalStatsFound = true;
          } else if (hitterTotals) {
            player.type = 'hitter';
            player.stats = hitterTotals;
            player.internationalStatsFound = true;
          }
          if (player.internationalStatsFound) {
            player.internationalSource = '官方逐場 Box 合計';
            player.externalLastUpdatedAt = Date.now();
            await savePlayer(player);
          }
        }
      }
"""
assert s.count(old) == 1, f'international game totals block occurrence: {s.count(old)}'
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# 3) Enable the existing annual league report canvas on international total stats page
p = ROOT / 'js' / '15-render-controller.js'
s = p.read_text(encoding='utf-8')
old = """      const statsTabActive = selectedTab === 'base' || selectedTab === 'minor' || selectedTab === 'secondary';
      const proSeasonStatsActive = statsTabActive && playerScopeCode !== 'international';
      const dailyReportActive = selectedTab === 'today';
"""
new = """      const statsTabActive = selectedTab === 'base' || selectedTab === 'minor' || selectedTab === 'secondary';
      const seasonReportActive = statsTabActive && (playerScopeCode !== 'international' || selectedTab === 'base');
      const dailyReportActive = selectedTab === 'today';
"""
assert s.count(old) == 1, f'stats active block occurrence: {s.count(old)}'
s = s.replace(old, new)
s = s.replace("els.seasonReportBtn?.classList.toggle('hidden', !proSeasonStatsActive);", "els.seasonReportBtn?.classList.toggle('hidden', !seasonReportActive);")

old = """        const context = proSeasonStatsActive ? annualSeasonContext(player) : null;
        const levelText = supportsLeagueLevelTabs(player)
          ? (selectedLevel === 'D' ? '二軍' : '一軍')
          : (context?.league || '');
        els.seasonReportBtn.textContent = context
          ? `輸出 ${context.year} ${levelText}整季戰報`
          : '輸出這個年度成績';
"""
new = """        const context = seasonReportActive ? annualSeasonContext(player) : null;
        const internationalTotal = playerScopeCode === 'international' && selectedTab === 'base';
        const levelText = supportsLeagueLevelTabs(player)
          ? (selectedLevel === 'D' ? '二軍' : '一軍')
          : (context?.league || '');
        els.seasonReportBtn.textContent = context
          ? (internationalTotal
              ? `輸出 ${context.year} ${context.league || '國際賽'}總戰績圖`
              : `輸出 ${context.year} ${levelText}整季戰報`)
          : '輸出這個年度成績';
"""
assert s.count(old) == 1, f'season report label block occurrence: {s.count(old)}'
s = s.replace(old, new)

old = """        if (proSeasonStatsActive) {
          const context = annualSeasonContext(player);
          const levelText = supportsLeagueLevelTabs(player)
            ? (selectedLevel === 'D' ? '二軍' : '一軍')
            : (context.league || '');
          els.canvasPreviewTitle.textContent = `${context.year} ${levelText}整季戰報預覽`.trim();
        } else if (dailyReportActive) {
"""
new = """        if (seasonReportActive) {
          const context = annualSeasonContext(player);
          const internationalTotal = playerScopeCode === 'international' && selectedTab === 'base';
          const levelText = supportsLeagueLevelTabs(player)
            ? (selectedLevel === 'D' ? '二軍' : '一軍')
            : (context.league || '');
          els.canvasPreviewTitle.textContent = internationalTotal
            ? `${context.year} ${context.league || '國際賽'}總戰績預覽`
            : `${context.year} ${levelText}整季戰報預覽`.trim();
        } else if (dailyReportActive) {
"""
assert s.count(old) == 1, f'preview title block occurrence: {s.count(old)}'
s = s.replace(old, new)

old = """        const internationalOverview = playerScopeCode === 'international'
          && (selectedTab === 'base' || (selectedTab === 'today' && !internationalSelectedGameKey));
"""
new = """        const internationalOverview = playerScopeCode === 'international'
          && selectedTab === 'today' && !internationalSelectedGameKey;
"""
assert s.count(old) == 1, f'international overview occurrence: {s.count(old)}'
s = s.replace(old, new)
s = s.replace("if (proSeasonStatsActive) {\n            void renderAnnualSeasonCanvas(activeSeasonReportRole(player), player);", "if (seasonReportActive) {\n            void renderAnnualSeasonCanvas(activeSeasonReportRole(player), player);")
assert 'proSeasonStatsActive' not in s, 'stale proSeasonStatsActive remains'
p.write_text(s, encoding='utf-8')

# 4) Make output dialog/filename terminology fit international tournament totals
p = ROOT / 'js' / '21-annual-report.js'
s = p.read_text(encoding='utf-8')
old = """      return `${context?.year || selectedSeason}_${reportPlayerName(player)}_${team}${league ? '_'+league : ''}_${role==='pitcher'?'年度投球戰報':'年度打擊戰報'}.png`;
"""
new = """      const internationalTotal = playerScope(player) === 'international';
      const suffix = internationalTotal
        ? (role === 'pitcher' ? '賽事總投球戰績' : '賽事總打擊戰績')
        : (role === 'pitcher' ? '年度投球戰報' : '年度打擊戰報');
      return `${context?.year || selectedSeason}_${reportPlayerName(player)}_${team}${league ? '_'+league : ''}_${suffix}.png`;
"""
assert s.count(old) == 1, f'annual filename occurrence: {s.count(old)}'
s = s.replace(old, new)
old = """      preparedOutputKind='season';
"""
new = """      preparedOutputKind = playerScope(player) === 'international' ? 'international-total' : 'season';
"""
assert s.count(old) == 1, f'preparedOutputKind season occurrence: {s.count(old)}'
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

p = ROOT / 'js' / '22-output-actions.js'
s = p.read_text(encoding='utf-8')
old = """      const annual = preparedOutputKind === 'season';
      if (els.outputDialogTitle) {
        els.outputDialogTitle.textContent = annual
          ? (count > 1 ? `${count} 張年度戰報已準備完成` : '年度戰報已準備完成')
          : (count > 1 ? `${count} 張圖片已準備完成` : '圖片已準備完成');
      }
"""
new = """      const internationalTotal = preparedOutputKind === 'international-total';
      const annual = preparedOutputKind === 'season' || internationalTotal;
      if (els.outputDialogTitle) {
        els.outputDialogTitle.textContent = internationalTotal
          ? (count > 1 ? `${count} 張賽事總戰績圖已準備完成` : '賽事總戰績圖已準備完成')
          : annual
            ? (count > 1 ? `${count} 張年度戰報已準備完成` : '年度戰報已準備完成')
            : (count > 1 ? `${count} 張圖片已準備完成` : '圖片已準備完成');
      }
"""
assert s.count(old) == 1, f'output dialog block occurrence: {s.count(old)}'
s = s.replace(old, new)

old = """        if (!['base','minor','secondary'].includes(selectedTab) || playerScope(player) === 'international') {
          throw new Error('請到一軍／二軍整季成績頁輸出年度戰報。');
        }
        const context=annualSeasonContext(player);
        const levelText=supportsLeagueLevelTabs(player) ? (selectedLevel==='D'?'二軍':'一軍') : (context.league||'');
        setStatus(`正在產生 ${context.year} ${levelText}整季戰報…`);
        const outputs=await prepareAnnualSeasonReports();
        els.outputDialog?.showModal();
        setStatus(outputs.length>1
          ? `已產生 ${outputs.length} 張年度戰報（打擊＋投球）。`
          : `${context.year} 年度戰報已準備完成。`);
"""
new = """        const internationalTotal = playerScope(player) === 'international';
        const allowedTab = internationalTotal ? selectedTab === 'base' : ['base','minor','secondary'].includes(selectedTab);
        if (!allowedTab) {
          throw new Error(internationalTotal ? '請到「賽事總成績」頁輸出總戰績圖。' : '請到一軍／二軍整季成績頁輸出年度戰報。');
        }
        const context=annualSeasonContext(player);
        const levelText=supportsLeagueLevelTabs(player) ? (selectedLevel==='D'?'二軍':'一軍') : (context.league||'');
        setStatus(internationalTotal
          ? `正在產生 ${context.year} ${context.league || '國際賽'}總戰績圖…`
          : `正在產生 ${context.year} ${levelText}整季戰報…`);
        const outputs=await prepareAnnualSeasonReports();
        els.outputDialog?.showModal();
        setStatus(internationalTotal
          ? (outputs.length>1 ? `已產生 ${outputs.length} 張賽事總戰績圖（打擊＋投球）。` : `${context.year} 賽事總戰績圖已準備完成。`)
          : (outputs.length>1 ? `已產生 ${outputs.length} 張年度戰報（打擊＋投球）。` : `${context.year} 年度戰報已準備完成。`));
"""
assert s.count(old) == 1, f'season button handler block occurrence: {s.count(old)}'
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# 5) Update HTML / service worker version wiring
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
assert s.count('v2.07') >= 3, 'index v2.07 wiring not found'
s = s.replace('v2.07', 'v2.08')
p.write_text(s, encoding='utf-8')

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
assert 'baseball-player-card-pwa-v124' in s, 'service worker cache v124 not found'
s = s.replace('baseball-player-card-pwa-v124', 'baseball-player-card-pwa-v125')
s = s.replace('v2.07', 'v2.08')
p.write_text(s, encoding='utf-8')

# 6) Build deterministic runtime bundle
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 7) Archive current version and enforce keep-current-plus-previous rule
archive = ROOT / 'index v2.08.html'
assert not archive.exists(), 'index v2.08.html already exists'
archive.write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.06.html'
if old_archive.exists():
    old_archive.unlink()

# Guards
bundle = (ROOT / 'app.js').read_text(encoding='utf-8')
assert "const APP_VERSION = 'v2.08';" in bundle
assert 'seasonReportActive' in bundle
assert '國際賽' in bundle and '總戰績圖' in bundle
assert "preparedOutputKind = playerScope(player) === 'international' ? 'international-total' : 'season';" in bundle
assert "storeRoleStatsProfile(player, year, 'A', hitterLocal, pitcherLocal);" in bundle
assert not (ROOT / 'index v2.06.html').exists()
assert (ROOT / 'index v2.07.html').exists()
assert (ROOT / 'index v2.08.html').exists()
print('v2.08 international total report patch complete')
