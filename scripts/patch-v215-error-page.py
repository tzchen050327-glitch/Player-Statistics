from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# Version bump.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.14';" not in s:
    raise SystemExit('expected v2.14 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.14';", "const APP_VERSION = 'v2.15';", 1)
s = s.replace('?v=v2.14', '?v=v2.15')
p.write_text(s, encoding='utf-8')

# CPBL error management page + official whole-game error fetch.
p = ROOT / 'js' / '06-provider-cpbl.js'
s = p.read_text(encoding='utf-8')
append = r'''

    async function refreshCpblGameErrors(player, { quiet = false } = {}) {
      if (!player?.cpblAcnt) throw new Error('此球員尚未連結中職官網。');
      const date = String(els.gameDate.value || '').trim();
      if (!date) throw new Error('請先選擇日期。');

      const data = await cpblRequest('game-errors', {
        acnt: player.cpblAcnt,
        date,
        teamCode: player.cpblTeamCode || '',
        kindCode: currentRecord?.level || selectedLevel || 'A'
      });
      if (!data?.found) throw new Error(data?.reason || '找不到這場比賽的失誤資料。');

      currentRecord.cpblGameErrors = Array.isArray(data.errors)
        ? data.errors.map(item => ({
            acnt: String(item?.acnt || ''),
            name: String(item?.name || '').trim(),
            number: String(item?.number || '').trim(),
            teamCode: String(item?.teamCode || '').trim(),
            teamName: String(item?.teamName || '').trim(),
            count: Math.max(0, Number(item?.count) || 0)
          })).filter(item => item.count > 0)
        : [];
      currentRecord.cpblGameErrorsGame = data.game ? { ...data.game } : null;
      currentRecord.cpblGameErrorsFetchedAt = Date.now();
      delete currentRecord.cpblGameErrorsLoadError;
      await saveRecord();

      if (!quiet) {
        const total = currentRecord.cpblGameErrors.reduce((sum, item) => sum + item.count, 0);
        setStatus(total
          ? `已抓到本場 ${currentRecord.cpblGameErrors.length} 位球員、共 ${total} 次失誤。`
          : 'CPBL 官方記錄本場沒有失誤。');
      }
      if (selectedTab === 'errors') renderCpblErrorsPage(player);
      return currentRecord.cpblGameErrors;
    }

    function cpblErrorPlayerLabel(item) {
      const number = String(item?.number || '').trim();
      const name = String(item?.name || '').trim() || '未辨識球員';
      return `${number ? `#${number} ` : ''}${name}`;
    }

    function renderCpblErrorsPage(player) {
      const errors = Array.isArray(currentRecord?.cpblGameErrors) ? currentRecord.cpblGameErrors : null;
      const game = currentRecord?.cpblGameErrorsGame || null;
      const loadError = String(currentRecord?.cpblGameErrorsLoadError || '');
      const ownAcnt = String(player?.cpblAcnt || '');
      const own = errors?.find(item => String(item?.acnt || '') === ownAcnt) || null;
      const dateText = String(els.gameDate.value || '').replaceAll('-', '/');
      const matchup = [game?.visitingTeamName, game?.homeTeamName].filter(Boolean).join(' vs ');
      const gameMeta = [dateText, matchup, game?.field].filter(Boolean).join('｜');

      let listHtml = '';
      if (loadError) {
        listHtml = `<div class="error-page-empty error">${escapeHtml(loadError)}</div>`;
      } else if (errors === null) {
        listHtml = '<div class="error-page-empty">正在抓取 CPBL 官方本場失誤…</div>';
      } else if (!errors.length) {
        listHtml = '<div class="error-page-empty success">CPBL 官方紀錄：本場沒有任何球員被記失誤。</div>';
      } else {
        listHtml = errors.map(item => {
          const selected = String(item.acnt || '') === ownAcnt;
          const team = item.teamName || item.teamCode || '';
          return `
            <div class="error-player-card ${selected ? 'selected' : ''}">
              <div class="error-player-info">
                <div class="error-player-name">${escapeHtml(cpblErrorPlayerLabel(item))}</div>
                <div class="error-player-team">${escapeHtml(team || 'CPBL 官方紀錄')}${selected ? '｜目前球員' : ''}</div>
              </div>
              <div class="error-count-badge">${Math.max(0, Number(item.count) || 0)} 次</div>
            </div>`;
        }).join('');
      }

      els.content.innerHTML = `
        <div class="error-page-shell">
          <div class="error-page-head">
            <button id="backFromErrorsBtn" class="press-btn" type="button">← 返回今日戰績</button>
            <button id="refreshGameErrorsBtn" class="press-btn primary" type="button">重新抓取官方失誤</button>
          </div>
          <div class="error-page-title-row">
            <div>
              <div class="error-page-kicker">FIELDING ERRORS</div>
              <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜失誤紀錄</h2>
              <div class="subtle">${escapeHtml(gameMeta || dateText)}</div>
            </div>
            <div class="error-own-summary">
              <span>此球員本場</span>
              <strong>${own ? `${Math.max(0, Number(own.count) || 0)} 次失誤` : '0 次失誤'}</strong>
            </div>
          </div>
          <div class="error-page-note">資料來源為 CPBL 官方單場 BOX；下方列出這場比賽所有被記失誤的球員。</div>
          <div class="error-player-list">${listHtml}</div>
        </div>`;

      document.getElementById('backFromErrorsBtn')?.addEventListener('click', () => {
        selectedTab = 'today';
        renderAll();
      });
      document.getElementById('refreshGameErrorsBtn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = '正在抓取…';
        try {
          await refreshCpblGameErrors(player);
        } catch (error) {
          currentRecord.cpblGameErrorsLoadError = error?.message || '抓取失誤資料失敗。';
          renderCpblErrorsPage(player);
          setStatus(currentRecord.cpblGameErrorsLoadError, true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    }
'''
if 'function renderCpblErrorsPage(player)' in s:
    raise SystemExit('error page already exists')
p.write_text(s.rstrip() + append + '\n', encoding='utf-8')

# Make the CPBL player name in Today status clickable and open the dedicated error page.
p = ROOT / 'js' / '13-daily-editor.js'
s = p.read_text(encoding='utf-8')
old = r'''      els.content.innerHTML = `
        <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜今日狀況</h2>
        ${opponentField}
'''
new = r'''      const todayHeading = scope === 'cpbl' && player.cpblAcnt
        ? `<h2 class="today-status-heading"><button id="playerErrorPageBtn" class="today-player-name-link" type="button" title="開啟失誤紀錄">#${escapeHtml(player.number)} ${escapeHtml(player.name)}</button><span>｜今日狀況</span></h2>`
        : `<h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜今日狀況</h2>`;

      els.content.innerHTML = `
        ${todayHeading}
        ${opponentField}
'''
if s.count(old) != 1:
    raise SystemExit(f'today heading anchor count={s.count(old)}')
s = s.replace(old, new, 1)
anchor = r'''      const opponentInput = document.getElementById('opponentInput');
'''
insert = r'''      document.getElementById('playerErrorPageBtn')?.addEventListener('click', async () => {
        selectedTab = 'errors';
        delete currentRecord.cpblGameErrorsLoadError;
        renderAll();
        try {
          await refreshCpblGameErrors(player, { quiet:true });
        } catch (error) {
          currentRecord.cpblGameErrorsLoadError = error?.message || '抓取失誤資料失敗。';
          if (selectedTab === 'errors') renderCpblErrorsPage(player);
          setStatus(currentRecord.cpblGameErrorsLoadError, true);
        }
      });

'''
if s.count(anchor) != 1:
    raise SystemExit(f'opponent anchor count={s.count(anchor)}')
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s, encoding='utf-8')

# Render controller: treat errors as a dedicated, full-width subpage with tabs/canvas hidden.
p = ROOT / 'js' / '15-render-controller.js'
s = p.read_text(encoding='utf-8')
old = """      if (selectedTab === 'photos') renderPhotos(player);\n"""
new = """      if (selectedTab === 'photos') renderPhotos(player);\n      if (selectedTab === 'errors' && playerScope(player) === 'cpbl') renderCpblErrorsPage(player);\n"""
if s.count(old) != 1:
    raise SystemExit('renderContent photos anchor not found')
s = s.replace(old, new, 1)
old = """      const player = selectedPlayer();\n      const playerPageActive = currentPage === 'player' && Boolean(player);\n\n"""
new = """      const player = selectedPlayer();\n      const playerPageActive = currentPage === 'player' && Boolean(player);\n      const errorPageActive = playerPageActive && selectedTab === 'errors' && playerScope(player) === 'cpbl';\n\n"""
if s.count(old) != 1:
    raise SystemExit('renderAll header anchor not found')
s = s.replace(old, new, 1)
old = """        els.pageSubtitle.textContent = playerPageActive\n          ? (playerScope(player) === 'international'\n              ? `${playerSpecialCompetition(player)}｜${internationalEdition(player)}｜${internationalTeam(player)}`\n              : `球員設定｜${scopeLabel(playerScope(player))}`)\n          : homePageBreadcrumb();\n"""
new = """        els.pageSubtitle.textContent = playerPageActive\n          ? (errorPageActive\n              ? '失誤紀錄｜CPBL 官方'\n              : (playerScope(player) === 'international'\n                  ? `${playerSpecialCompetition(player)}｜${internationalEdition(player)}｜${internationalTeam(player)}`\n                  : `球員設定｜${scopeLabel(playerScope(player))}`))\n          : homePageBreadcrumb();\n"""
if s.count(old) != 1:
    raise SystemExit('page subtitle anchor not found')
s = s.replace(old, new, 1)
old = """      tabsHost?.classList.toggle('league-level-tabs', levelTabs);\n      tabsHost?.classList.toggle('us-dual-role-tabs', usDualTabs);\n"""
new = """      tabsHost?.classList.toggle('league-level-tabs', levelTabs);\n      tabsHost?.classList.toggle('us-dual-role-tabs', usDualTabs);\n      tabsHost?.classList.toggle('hidden', errorPageActive);\n"""
if s.count(old) != 1:
    raise SystemExit('tabsHost anchor not found')
s = s.replace(old, new, 1)
old = """      els.seasonSelect?.closest('.season-field')?.classList.toggle('hidden', levelTabs && !statsTabActive);\n"""
new = """      els.seasonSelect?.closest('.season-field')?.classList.toggle('hidden', errorPageActive || (levelTabs && !statsTabActive));\n"""
if s.count(old) != 1:
    raise SystemExit('season field anchor not found')
s = s.replace(old, new, 1)
old = """        document.querySelector('#playerPage .workspace')?.classList.toggle('international-overview', internationalOverview);\n        renderContent();\n\n        if (!internationalOverview) {\n"""
new = """        const workspace = document.querySelector('#playerPage .workspace');\n        workspace?.classList.toggle('international-overview', internationalOverview);\n        workspace?.classList.toggle('error-management', errorPageActive);\n        document.querySelector('#playerPage .canvas-wrap')?.classList.toggle('hidden', errorPageActive);\n        renderContent();\n\n        if (!internationalOverview && !errorPageActive) {\n"""
if s.count(old) != 1:
    raise SystemExit('workspace anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Styles: same visual language as the existing blue/gold UI.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.15 CPBL fielding-error management */
.today-status-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:0;margin:0 0 18px}
.today-player-name-link{appearance:none;border:0;background:transparent;padding:0;margin:0;color:#102f56;font:inherit;font-weight:900;cursor:pointer;border-bottom:3px solid #c49a3a;line-height:1.2}
.today-player-name-link:hover,.today-player-name-link:focus-visible{color:#1f4e79;border-bottom-color:#1f4e79;outline:none}
.workspace.error-management{grid-template-columns:minmax(0,1fr)}
.workspace.error-management #contentPanel{width:100%;max-width:980px;margin:0 auto}
.error-page-shell{display:flex;flex-direction:column;gap:18px}
.error-page-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.error-page-title-row{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;padding:18px 20px;border:1px solid #d8e2ec;border-radius:18px;background:linear-gradient(135deg,#f8fbff 0%,#eef4f9 100%)}
.error-page-title-row h2{margin:3px 0 5px;color:#102f56}
.error-page-kicker{font-size:12px;letter-spacing:.16em;font-weight:900;color:#a77b20}
.error-own-summary{min-width:150px;padding:12px 16px;border-radius:14px;background:#102f56;color:#fff;text-align:right}
.error-own-summary span{display:block;font-size:12px;opacity:.8;margin-bottom:4px}
.error-own-summary strong{display:block;font-size:20px}
.error-page-note{padding:12px 14px;border-radius:12px;background:#f8fafc;color:#52657d;font-size:13px;font-weight:700}
.error-player-list{display:grid;gap:10px}
.error-player-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 16px;border:1px solid #dce4ed;border-radius:15px;background:#fff}
.error-player-card.selected{border-color:#c49a3a;box-shadow:0 0 0 2px rgba(196,154,58,.14);background:#fffdf7}
.error-player-info{min-width:0}
.error-player-name{font-size:18px;font-weight:900;color:#102f56;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.error-player-team{margin-top:4px;color:#6d7e91;font-size:13px;font-weight:700}
.error-count-badge{flex:0 0 auto;min-width:68px;padding:9px 12px;border-radius:999px;background:#102f56;color:#fff;text-align:center;font-weight:900}
.error-player-card.selected .error-count-badge{background:#b88727}
.error-page-empty{padding:26px 18px;text-align:center;border:1px dashed #cfd9e4;border-radius:15px;background:#f8fafc;color:#607086;font-weight:800}
.error-page-empty.success{color:#2f775d;background:#f3faf7;border-color:#b9ddcf}
.error-page-empty.error{color:#9b3f3f;background:#fff6f6;border-color:#ecc7c7}
@media (max-width:720px){
  .error-page-title-row{align-items:stretch;flex-direction:column}
  .error-own-summary{min-width:0;text-align:left}
  .error-player-card{padding:13px 14px}
  .error-player-name{font-size:17px}
}
'''
if 'v2.15 CPBL fielding-error management' not in s:
    s = s.rstrip() + css + '\n'
p.write_text(s, encoding='utf-8')

# HTML and PWA cache.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.14' not in s:
    raise SystemExit('expected v2.14 index wiring')
s = s.replace('v2.14', 'v2.15')
p.write_text(s, encoding='utf-8')

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if "baseball-player-card-pwa-v131" not in s:
    raise SystemExit('expected service worker cache v131')
s = s.replace('baseball-player-card-pwa-v131', 'baseball-player-card-pwa-v132', 1)
s = s.replace('v2.14', 'v2.15')
p.write_text(s, encoding='utf-8')

# Rebuild runtime bundle.
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# Keep only current + previous archive.
(ROOT / 'index v2.15.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.13.html'
if old_archive.exists():
    old_archive.unlink()
if not (ROOT / 'index v2.14.html').exists():
    raise SystemExit('previous archive index v2.14.html missing')

print('v2.15 CPBL fielding error page applied')
