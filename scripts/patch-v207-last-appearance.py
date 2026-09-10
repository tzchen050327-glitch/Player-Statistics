from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 1) Version source
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
old = "const APP_VERSION = 'v2.06';"
new = "const APP_VERSION = 'v2.07';"
assert s.count(old) == 1, f'APP_VERSION occurrence: {s.count(old)}'
p.write_text(s.replace(old, new), encoding='utf-8')

# 2) Daily import previous-appearance fallbacks
p = ROOT / 'js' / '06-provider-cpbl.js'
s = p.read_text(encoding='utf-8')

old_external = """        const last = daily?.lastAppearance;
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄。\\n\\n上一次出賽：${lastDate}${lastLevel ? `（${lastLevel}）` : ''}`;
          await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastLevel ? `（${lastLevel}）` : ''}。`);
          return false;
        }
"""
new_external = """        let last = daily?.lastAppearance || null;
        if (!last && isUsPlayer(player)) {
          try {
            const lastData = await baseballRequest('last-appearance', {
              provider:'US',
              id:player.externalPlayerId,
              date:els.gameDate.value
            });
            last = lastData?.lastAppearance || null;
          } catch (error) {
            console.warn('MLB / MiLB 上一次出賽查詢失敗', error);
          }
        }
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const lastOpponent = String(last.opponent || '').trim();
          const lastDetail = `${lastLevel ? `（${lastLevel}）` : ''}${lastOpponent ? `｜vs ${lastOpponent}` : ''}`;
          const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄。\\n\\n上一次出賽：${lastDate}${lastDetail}`;
          await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastDetail}。`);
          return false;
        }
"""
assert s.count(old_external) == 1, f'external no-game block occurrence: {s.count(old_external)}'
s = s.replace(old_external, new_external)

old_cpbl = """      if (!daily?.found) {
        await showAppAlert(
          `${els.gameDate.value.replaceAll('-', '/')} 一軍、二軍都找不到此球員的出賽資料。`,
          { title:'當日無出賽', tone:'warning' }
        );
        setStatus(lastReason || '當日一軍、二軍皆無出賽資料。');
        return false;
      }
"""
new_cpbl = """      if (!daily?.found) {
        let last = null;
        try {
          const lastData = await cpblRequest('last-appearance', {
            acnt:player.cpblAcnt,
            date:els.gameDate.value,
            teamCode:player.cpblTeamCode
          });
          last = lastData?.lastAppearance || null;
        } catch (error) {
          console.warn('中職上一次出賽查詢失敗', error);
        }

        const requestedDate = els.gameDate.value.replaceAll('-', '/');
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const lastOpponent = normalizeTeamName(String(last.opponent || '').trim());
          const lastDetail = `${lastLevel ? `（${lastLevel}）` : ''}${lastOpponent ? `｜vs ${lastOpponent}` : ''}`;
          await showAppAlert(
            `${requestedDate} 一軍、二軍都找不到此球員的出賽資料。\\n\\n上一次出賽：${lastDate}${lastDetail}`,
            { title:'當日無出賽', tone:'warning' }
          );
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastDetail}。`);
          return false;
        }

        await showAppAlert(
          `${requestedDate} 一軍、二軍都找不到此球員的出賽資料，近期也找不到可確認的上一次出賽資料。`,
          { title:'當日無出賽', tone:'warning' }
        );
        setStatus(lastReason || '當日一軍、二軍皆無出賽資料。');
        return false;
      }
"""
assert s.count(old_cpbl) == 1, f'cpbl no-game block occurrence: {s.count(old_cpbl)}'
s = s.replace(old_cpbl, new_cpbl)
p.write_text(s, encoding='utf-8')

# 3) HTML version/cache-busting
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
assert s.count('v2.06') >= 3, 'index v2.06 wiring not found'
s = s.replace('v2.06', 'v2.07')
p.write_text(s, encoding='utf-8')

# 4) Service worker cache/version
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
assert "baseball-player-card-pwa-v123" in s, 'service worker cache v123 not found'
s = s.replace('baseball-player-card-pwa-v123', 'baseball-player-card-pwa-v124')
s = s.replace('v2.06', 'v2.07')
p.write_text(s, encoding='utf-8')

# 5) Build deterministic runtime bundle
import subprocess
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 6) Archive the new modular index
archive = ROOT / 'index v2.07.html'
assert not archive.exists(), 'index v2.07.html already exists'
archive.write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')

# Guards
bundle = (ROOT / 'app.js').read_text(encoding='utf-8')
assert "const APP_VERSION = 'v2.07';" in bundle
assert "baseballRequest('last-appearance'" in bundle
assert "cpblRequest('last-appearance'" in bundle
assert '上一次出賽：' in bundle
print('v2.07 last-appearance patch complete')
