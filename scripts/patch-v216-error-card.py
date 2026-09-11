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
if "const APP_VERSION = 'v2.15';" not in s:
    raise SystemExit('expected v2.15 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.15';", "const APP_VERSION = 'v2.16';", 1)
s = s.replace('?v=v2.15', '?v=v2.16')
p.write_text(s, encoding='utf-8')

# Add download button to the CPBL error page.
p = ROOT / 'js' / '06-provider-cpbl.js'
s = p.read_text(encoding='utf-8')
old = '''          <div class="error-page-head">\n            <button id="backFromErrorsBtn" class="press-btn" type="button">← 返回今日戰績</button>\n            <button id="refreshGameErrorsBtn" class="press-btn primary" type="button">重新抓取官方失誤</button>\n          </div>'''
new = '''          <div class="error-page-head">\n            <button id="backFromErrorsBtn" class="press-btn" type="button">← 返回今日戰績</button>\n            <div class="error-page-actions">\n              <button id="refreshGameErrorsBtn" class="press-btn" type="button">重新抓取官方失誤</button>\n              <button id="downloadErrorCardBtn" class="press-btn primary" type="button">下載此球員失誤圖</button>\n            </div>\n          </div>'''
if s.count(old) != 1:
    raise SystemExit('error page head anchor not found')
s = s.replace(old, new, 1)
anchor = '''      document.getElementById('refreshGameErrorsBtn')?.addEventListener('click', async event => {\n'''
insert = '''      document.getElementById('downloadErrorCardBtn')?.addEventListener('click', async event => {\n        const button = event.currentTarget;\n        const original = button.textContent;\n        button.disabled = true;\n        button.textContent = '正在產生…';\n        try {\n          await downloadCpblErrorCard(player);\n        } catch (error) {\n          setStatus(error?.message || '下載失誤圖失敗。', true);\n        } finally {\n          button.disabled = false;\n          button.textContent = original;\n        }\n      });\n\n'''
if s.count(anchor) != 1:
    raise SystemExit('refresh error button anchor not found')
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s, encoding='utf-8')

# Canvas: same daily-card layout, but replace the entire detail / plate-appearance area with one player's error count.
p = ROOT / 'js' / '16-daily-canvas.js'
s = p.read_text(encoding='utf-8')
old = '''      const effectiveType = player && selectedTab === 'today' ? activeTodayRole(player) : player?.type;\n      const W = els.canvas.width;'''
new = '''      const effectiveType = player && selectedTab === 'today' ? activeTodayRole(player) : player?.type;\n      const errorCardMode = Boolean(currentRecord?.cpblErrorCardMode);\n      const W = els.canvas.width;'''
if s.count(old) != 1:
    raise SystemExit('errorCardMode anchor not found')
s = s.replace(old, new, 1)
old = '''        const detailHeading = effectiveType === 'hitter' ? hitterAppearanceHeading(ensureHitterAppearance()) : '投球成績';'''
new = '''        const detailHeading = errorCardMode\n          ? '失誤紀錄'\n          : (effectiveType === 'hitter' ? hitterAppearanceHeading(ensureHitterAppearance()) : '投球成績');'''
if s.count(old) != 1:
    raise SystemExit('detail heading anchor not found')
s = s.replace(old, new, 1)
old = '''      if (effectiveType === 'hitter') {\n        const appearance = ensureHitterAppearance();'''
new = '''      if (errorCardMode) {\n        const ownCount = Math.max(0, Number(currentRecord?.cpblErrorCardCount) || 0);\n        const centerX = detail.x + detail.w / 2;\n        const centerY = detail.y + detail.h / 2;\n        const bigSize = Math.max(104, Math.min(190, Math.round(detail.w * 0.38)));\n\n        ctx.save();\n        ctx.textAlign = 'center';\n        ctx.textBaseline = 'middle';\n        ctx.fillStyle = detail.accentColor || '#d7ad52';\n        ctx.font = `900 ${bigSize}px Arial, sans-serif`;\n        ctx.fillText(String(ownCount), centerX, centerY - 28);\n\n        ctx.fillStyle = detail.textColor || '#172033';\n        ctx.font = '900 34px "Microsoft JhengHei", sans-serif';\n        ctx.fillText('本場失誤', centerX, centerY + 82);\n\n        ctx.fillStyle = detail.mutedColor || '#6d7688';\n        ctx.font = '700 22px "Microsoft JhengHei", sans-serif';\n        ctx.fillText(ownCount > 0 ? `CPBL 官方記錄｜${ownCount} 次失誤` : 'CPBL 官方記錄｜本場無失誤', centerX, centerY + 128);\n        ctx.restore();\n      } else if (effectiveType === 'hitter') {\n        const appearance = ensureHitterAppearance();'''
if s.count(old) != 1:
    raise SystemExit('detail body anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Output action: generate a single-player error card using the currently selected visual template.
p = ROOT / 'js' / '22-output-actions.js'
s = p.read_text(encoding='utf-8')
anchor = '''    els.downloadBtn.addEventListener('click', async () => {\n'''
insert = r'''    async function downloadCpblErrorCard(player = selectedPlayer()) {
      if (!player || playerScope(player) !== 'cpbl' || !player.cpblAcnt) {
        throw new Error('只有已連結 CPBL 官方資料的球員可以產生失誤圖。');
      }
      if (!currentRecord) throw new Error('請先選擇比賽日期。');

      if (!Array.isArray(currentRecord.cpblGameErrors)) {
        await refreshCpblGameErrors(player, { quiet:true });
      }

      const errors = Array.isArray(currentRecord.cpblGameErrors) ? currentRecord.cpblGameErrors : [];
      const own = errors.find(item => String(item?.acnt || '') === String(player.cpblAcnt || '')) || null;
      const ownCount = Math.max(0, Number(own?.count) || 0);
      const originalRecord = currentRecord;
      const originalRole = todayRoleView;

      try {
        currentRecord = {
          ...originalRecord,
          cpblErrorCardMode:true,
          cpblErrorCardCount:ownCount,
          cpblGameSummary:{
            ...defaultGameRecord(player).cpblGameSummary,
            ...(originalRecord.cpblGameSummary || {}),
            errors:ownCount,
            official:true
          }
        };
        todayRoleView = player.type === 'pitcher' ? 'pitcher' : 'hitter';
        await renderCanvas();

        const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('失誤圖產生失敗。');
        const safeName = String(reportPlayerName(player) || player.name || 'player').replace(/[\\/:*?"<>|]+/g, '_');
        const dateText = String(originalRecord.date || els.gameDate.value || '').replaceAll('-', '');
        const fileName = `${dateText}_${safeName}_失誤紀錄.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        setStatus(`已下載 ${reportPlayerName(player)} 的失誤圖（${ownCount} 次失誤）。`);
      } finally {
        currentRecord = originalRecord;
        todayRoleView = originalRole;
        await renderCanvas();
      }
    }

'''
if s.count(anchor) != 1:
    raise SystemExit('download action anchor not found')
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s, encoding='utf-8')

# Small layout support for the two error-page actions.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = '''\n.error-page-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}\n@media(max-width:640px){.error-page-actions{width:100%;justify-content:stretch}.error-page-actions .press-btn{flex:1 1 160px}}\n'''
if '.error-page-actions{' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# HTML + PWA cache bust.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('v2.15', 'v2.16')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.16.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.14.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v132", "baseball-player-card-pwa-v133", 1)
s = s.replace('v2.15', 'v2.16')
p.write_text(s, encoding='utf-8')

# Rebuild concatenated bundle.
subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)

print('v2.16 patch applied')
