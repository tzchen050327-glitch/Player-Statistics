from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version bump.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.16';" not in s:
    raise SystemExit('expected v2.16 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.16';", "const APP_VERSION = 'v2.17';", 1)
s = s.replace('?v=v2.16', '?v=v2.17')
p.write_text(s, encoding='utf-8')

# Make CPBL error-player names clickable and auto-create/link players before opening them.
p = ROOT / 'js' / '06-provider-cpbl.js'
s = p.read_text(encoding='utf-8')
anchor = '''    function cpblErrorPlayerLabel(item) {\n      const number = String(item?.number || '').trim();\n      const name = String(item?.name || '').trim() || '未辨識球員';\n      return `${number ? `#${number} ` : ''}${name}`;\n    }\n\n'''
insert = r'''    async function openCpblErrorPlayer(item) {
      const acnt = String(item?.acnt || '').trim();
      if (!acnt) throw new Error('這筆官方失誤資料沒有球員 ID，暫時無法開啟。');

      const sourceDate = String(els.gameDate.value || '').trim();
      const sourceName = String(item?.name || '').trim();
      let player = players.find(p => playerScope(p) === 'cpbl' && String(p.cpblAcnt || '') === acnt) || null;

      // If the user already has an unlinked CPBL player with the exact same name,
      // link that record instead of creating a duplicate.
      if (!player && sourceName) {
        player = players.find(p =>
          playerScope(p) === 'cpbl'
          && !String(p.cpblAcnt || '').trim()
          && String(p.name || '').trim() === sourceName
        ) || null;
      }

      let official = null;
      try {
        const profileData = await cpblRequest('player-profile', { acnt });
        official = profileData?.player || null;
      } catch (error) {
        console.warn('失誤頁開啟球員時讀取 CPBL profile 失敗，改用單場資料建立', error);
      }

      const position = String(official?.position || '').trim();
      const type = /投手/.test(position) ? 'pitcher' : 'hitter';
      const now = Date.now();

      if (!player) {
        player = {
          id: uid(),
          name: String(official?.name || sourceName || '未命名球員').trim(),
          number: String(official?.number || item?.number || '—').trim() || '—',
          type,
          scope: 'cpbl',
          stats: type === 'pitcher' ? pitcherDefaults() : hitterDefaults(),
          pitcherLastMetric: type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null,
          photoTransforms: {},
          cpblAcnt: acnt,
          cpblTeam: normalizeTeamName(official?.team || item?.teamName || ''),
          cpblTeamCode: String(official?.teamCode || item?.teamCode || '').trim(),
          cpblCurrentLevel: 'A',
          cpblPosition: position,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now
        };
        await savePlayer(player);
      } else {
        player.cpblAcnt = acnt;
        if (official?.name) player.name = String(official.name).trim();
        else if (!player.name && sourceName) player.name = sourceName;
        if (official?.number) player.number = String(official.number).trim();
        else if ((!player.number || player.number === '—') && item?.number) player.number = String(item.number).trim();
        if (official?.team) player.cpblTeam = normalizeTeamName(official.team);
        else if (!player.cpblTeam && item?.teamName) player.cpblTeam = normalizeTeamName(item.teamName);
        if (official?.teamCode) player.cpblTeamCode = String(official.teamCode).trim();
        else if (!player.cpblTeamCode && item?.teamCode) player.cpblTeamCode = String(item.teamCode).trim();
        if (position) {
          player.cpblPosition = position;
          repairStoredCpblPlayerType(player, position);
        }
        await savePlayer(player);
      }

      await selectPlayer(player.id);

      // Stay on the same game date and open the same error workspace for the
      // newly selected player, so another error card can be downloaded immediately.
      if (sourceDate) els.gameDate.value = sourceDate;
      selectedTab = 'errors';
      await loadRecord();
      renderAll();
      try {
        await refreshCpblGameErrors(player, { quiet:true });
      } catch (error) {
        currentRecord.cpblGameErrorsLoadError = error?.message || '抓取失誤資料失敗。';
        renderCpblErrorsPage(player);
        setStatus(currentRecord.cpblGameErrorsLoadError, true);
      }
    }

'''
if s.count(anchor) != 1:
    raise SystemExit('cpblErrorPlayerLabel anchor not found')
s = s.replace(anchor, anchor + insert, 1)

old = '''                <div class="error-player-name">${escapeHtml(cpblErrorPlayerLabel(item))}</div>'''
new = '''                <button class="error-player-name error-player-name-link" type="button" data-error-player-acnt="${escapeAttr(String(item.acnt || ''))}" ${item.acnt ? '' : 'disabled'}>${escapeHtml(cpblErrorPlayerLabel(item))}</button>'''
if s.count(old) != 1:
    raise SystemExit('error player name anchor not found')
s = s.replace(old, new, 1)

anchor = '''      document.getElementById('backFromErrorsBtn')?.addEventListener('click', () => {\n        selectedTab = 'today';\n        renderAll();\n      });\n'''
insert = r'''      document.querySelectorAll('[data-error-player-acnt]').forEach(button => {
        button.addEventListener('click', async event => {
          const target = event.currentTarget;
          const acnt = String(target.dataset.errorPlayerAcnt || '');
          const item = (errors || []).find(row => String(row.acnt || '') === acnt);
          if (!item) return;
          const original = target.textContent;
          target.disabled = true;
          target.textContent = `${original}｜開啟中…`;
          try {
            await openCpblErrorPlayer(item);
          } catch (error) {
            target.disabled = false;
            target.textContent = original;
            setStatus(error?.message || '開啟球員失敗。', true);
          }
        });
      });
'''
if s.count(anchor) != 1:
    raise SystemExit('backFromErrors anchor not found')
s = s.replace(anchor, anchor + insert, 1)
p.write_text(s, encoding='utf-8')

# Link appearance: looks like the existing player name, but clearly interactive.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = '''\n.error-player-name-link{appearance:none;border:0;background:none;padding:0;margin:0;color:inherit;font:inherit;font-weight:inherit;text-align:left;cursor:pointer;text-decoration:none}\n.error-player-name-link:hover,.error-player-name-link:focus-visible{color:#1f4e79;text-decoration:underline;text-underline-offset:4px}\n.error-player-name-link:disabled{cursor:default;opacity:.7;text-decoration:none}\n'''
if '.error-player-name-link{' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# HTML archive + cache bust.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.16', 'v2.17')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.17.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.15.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v133", "baseball-player-card-pwa-v134", 1)
s = s.replace('v2.16', 'v2.17')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.17 patch applied')
