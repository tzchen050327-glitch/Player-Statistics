    // Display-only team localization. Keep original provider names for lookups and sync.
    const HOME_ASIA_TEAM_TRANSLATIONS = new Map([
      ['fukuoka softbank hawks','福岡軟銀鷹'],['softbank hawks','福岡軟銀鷹'],['福岡ソフトバンクホークス','福岡軟銀鷹'],
      ['yokohama dena baystars','橫濱DeNA灣星'],['yokohama dena','橫濱DeNA灣星'],['横浜denaベイスターズ','橫濱DeNA灣星'],
      ['saitama seibu lions','埼玉西武獅'],['seibu lions','埼玉西武獅'],['埼玉西武ライオンズ','埼玉西武獅'],
      ['hanshin tigers','阪神虎'],['阪神タイガース','阪神虎'],
      ['yomiuri giants','讀賣巨人'],['読売ジャイアンツ','讀賣巨人'],
      ['chunichi dragons','中日龍'],['中日ドラゴンズ','中日龍'],
      ['hiroshima toyo carp','廣島東洋鯉魚'],['広島東洋カープ','廣島東洋鯉魚'],
      ['tokyo yakult swallows','東京養樂多燕子'],['東京ヤクルトスワローズ','東京養樂多燕子'],
      ['hokkaido nippon-ham fighters','北海道日本火腿鬥士'],['hokkaido nippon ham fighters','北海道日本火腿鬥士'],['北海道日本ハムファイターズ','北海道日本火腿鬥士'],
      ['orix buffaloes','歐力士猛牛'],['オリックス・バファローズ','歐力士猛牛'],
      ['chiba lotte marines','千葉羅德海洋'],['千葉ロッテマリーンズ','千葉羅德海洋'],
      ['tohoku rakuten golden eagles','東北樂天金鷲'],['東北楽天ゴールデンイーグルス','東北樂天金鷲'],
      ['lg twins','LG雙子'],['lg 트윈스','LG雙子'],['엘지 트윈스','LG雙子'],
      ['hanwha eagles','韓華鷹'],['한화 이글스','韓華鷹'],
      ['samsung lions','三星獅'],['삼성 라이온즈','三星獅'],
      ['ssg landers','SSG登陸者'],['ssg 랜더스','SSG登陸者'],
      ['kt wiz','KT巫師'],['kt 위즈','KT巫師'],
      ['lotte giants','樂天巨人'],['롯데 자이언츠','樂天巨人'],
      ['nc dinos','NC恐龍'],['nc 다이노스','NC恐龍'],
      ['kia tigers','KIA虎'],['kia 타이거즈','KIA虎'],
      ['doosan bears','斗山熊'],['두산 베어스','斗山熊'],
      ['kiwoom heroes','培證英雄'],['키움 히어로즈','培證英雄']
    ]);
    function homeLocalizedAsiaTeamName(team) {
      const raw = String(team || '').trim();
      return HOME_ASIA_TEAM_TRANSLATIONS.get(raw.toLowerCase().replace(/\s+/g, ' ')) || raw;
    }
    function homeLocalizedAsiaMeta(meta, player) {
      const text = String(meta || '');
      const provider = String(player?.externalProvider || player?.externalLeague || '').toUpperCase();
      if (!['NPB','KBO'].includes(provider) && !/(?:^|\|)\s*(?:NPB|KBO)\s*(?:\||$)/i.test(text)) return meta;
      return text.split('|').map(part => {
        const trimmed = part.trim();
        const translated = homeLocalizedAsiaTeamName(trimmed);
        return translated === trimmed ? part : part.replace(trimmed, translated);
      }).join('|');
    }

    function renderHomePlayerFilters() {
      const international = homeRootSection === 'international';
      const special = homeRootSection === 'special';
      const reels = homeRootSection === 'reels';
      const standalone = international || special || reels;
      if (international) homeZone = 'international';
      else if (special) homeZone = 'special';
      else if (reels) homeZone = 'reels';
      else applyHomeProSelection();

      els.homeZoneSwitch?.querySelectorAll('[data-home-root]').forEach(button => {
        const tab = button.dataset.homeRoot;
        const combinedActive = document.getElementById('homePage')?.classList.contains('combined-home-mode');
        const active = combinedActive ? tab === 'combined'
          : homeRootSection === 'pro'
            ? (homeProContinent === 'AMERICA' ? tab === 'america' : tab === 'asia')
            : tab === homeRootSection;
        button.classList.toggle('active', active);
      });

      els.homeProCountrySwitch?.classList.toggle('hidden', standalone);
      els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
        const country = button.dataset.proCountry;
        button.classList.toggle('hidden', homeProContinent === 'AMERICA' ? country !== 'US' : country === 'US');
        button.classList.toggle('active', country === homeProCountry);
      });

      els.homeUsLeagueSwitch?.classList.add('hidden');

      const cpbl = !standalone && homeProCountry === 'TW';
      els.homeDailyGames?.classList.toggle('hidden', standalone);
      els.homeSpecialFilters?.classList.add('hidden');
      els.homeInternationalExplorer?.classList.toggle('hidden', !international);
      els.homeSpecialGamesExplorer?.classList.toggle('hidden', !special);
      document.getElementById('homeReelsExplorer')?.classList.toggle('hidden', !reels);
      document.querySelector('.home-player-head')?.classList.toggle('hidden', standalone);
      const homeActions = document.querySelector('.home-player-actions');
      homeActions?.classList.toggle('hidden', standalone);
      homeActions?.classList.remove('international-actions');
      document.getElementById('addPlayerBtn')?.classList.remove('hidden');
      els.recent?.classList.toggle('hidden', standalone);

      if (els.homePlayerTitle) {
        if (international) els.homePlayerTitle.textContent = '國際賽';
        else if (special) els.homePlayerTitle.textContent = '作者收藏';
        else if (reels) els.homePlayerTitle.textContent = 'REELS';
        else if (homeProCountry === 'TW') els.homePlayerTitle.textContent = '台灣｜中華職棒';
        else if (homeProCountry === 'US') els.homePlayerTitle.textContent = '美國｜MLB / MiLB';
        else if (homeProCountry === 'JP') els.homePlayerTitle.textContent = '日本｜NPB';
        else if (homeProCountry === 'KR') els.homePlayerTitle.textContent = '韓國｜KBO';
        else if (homeProCountry === 'AWB') els.homePlayerTitle.textContent = '亞洲冬季棒球聯盟｜AWB';
        else els.homePlayerTitle.textContent = '各國職棒';
      }

      if (els.homeZoneNote) {
        if (international) {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '請依序選擇「賽事 → 年份 → 球隊 → 球員」。';
        } else if (special) {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '作者整理收錄的特殊紀錄與比賽。';
        } else if (reels) {
          els.homeZoneNote.classList.add('hidden');
          els.homeZoneNote.textContent = '';
        } else if (homeProCountry === 'AWB') {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '冬盟入口已建立；即時比分、逐打席及球員資料尚待官方來源串接。';
        } else {
          els.homeZoneNote.classList.add('hidden');
          els.homeZoneNote.textContent = '';
        }
      }

      renderInternationalExplorer();
      if (typeof renderSpecialGamesExplorer === 'function') renderSpecialGamesExplorer();
    }

    function renderRecentPlayers() {
      renderHomePlayerFilters();
      if (els.pageSubtitle && currentPage === 'home') {
        els.pageSubtitle.textContent = homePageBreadcrumb();
      }
      els.homePage?.classList.toggle('international-home-mode', homeRootSection === 'international');
      els.homePage?.classList.toggle('special-home-mode', homeRootSection === 'special' || homeRootSection === 'reels');
      renderHomeDailyGames();

      if (homeRootSection === 'international' || homeRootSection === 'special' || homeRootSection === 'reels') {
        if (els.homePlayerCount) els.homePlayerCount.textContent = '';
        if (els.recent) els.recent.innerHTML = '';
        return;
      }

      const zonePlayers = homeContextPlayers();
      let list = [...zonePlayers];

      list.sort((a, b) => {
        const used = (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
        if (used) return used;
        return String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric: true });
      });

      if (els.homePlayerCount) {
        els.homePlayerCount.textContent = `${list.length} / ${zonePlayers.length} 名`;
      }

      els.recent.innerHTML = list.length ? list.map(p => {
        const meta = homeLocalizedAsiaMeta(playerSourceMeta(p), p);
        return `
          <button class="player-btn home-player-card ${p.id === selectedPlayerId ? 'active' : ''}" data-player-id="${p.id}">
            <span class="home-player-number">#${escapeHtml(p.number)}</span>
            <span>
              <span class="home-player-name">${escapeHtml(p.name)}</span>
              <span class="home-player-meta">${escapeHtml(meta || '點擊進入球員設定')}</span>
            </span>
          </button>`;
      }).join('') : '<div class="empty" style="grid-column:1/-1">這個分類目前沒有符合條件的球員。</div>';

      els.recent.querySelectorAll('[data-player-id]').forEach(btn => {
        btn.addEventListener('click', () => selectPlayer(btn.dataset.playerId));
      });
    }

    function renderAllPlayersDialog() {
      let zonePlayers = homeContextPlayers();
      const cpblDialog = homeRootSection !== 'international' && homeProCountry === 'TW';

      els.allCpblFilters?.classList.toggle('hidden', !cpblDialog);
      if (cpblDialog) {
        if (els.allLevelFilters) els.allLevelFilters.value = homeLevelFilter;
        if (els.allTeamFilters) els.allTeamFilters.value = homeTeamFilter;
        syncAllFilterTriggerLabels();

        zonePlayers = zonePlayers.filter(player => {
          const levelOk = homeLevelFilter === 'ALL' || homePlayerLevel(player) === homeLevelFilter;
          const teamOk = !homeTeamFilter || homePlayerTeam(player) === homeTeamFilter;
          return levelOk && teamOk;
        });
      }

      const pitchers = zonePlayers.filter(p => p.type === 'pitcher');
      const hitters = zonePlayers.filter(p => p.type === 'hitter');

      const allPlayerDialogLines = p => {
        const scope = playerScope(p);
        const role = p.type === 'pitcher' ? '投手' : '打者';
        const competition = scope === 'cpbl' ? '中職' : playerSpecialCompetition(p);
        const team = scope === 'international'
          ? internationalTeam(p)
          : (scope === 'cpbl'
              ? normalizeTeamName(p.cpblTeam || '')
              : (isUsPlayer(p)
                  ? mlbTeamZh(String(p.externalCurrentOrganization || p.externalCurrentTeam || p.externalTeam || '').trim())
                  : homeLocalizedAsiaTeamName(p.externalTeam || '')));
        const crossRole = (p.externalTwoWay || p.hasCrossRoleStats || p.cpblDualRole) ? '投打皆有紀錄' : '';
        const year = scope === 'cpbl' ? '' : (Number(p.externalYear) || '');
        const cpblLevel = scope === 'cpbl'
          ? (String(p.cpblCurrentLevel || '').toUpperCase() === 'D' ? '二軍' : (p.cpblCurrentLevel ? '一軍' : ''))
          : '';
        return {
          first: `#${p.number || '—'} ${p.name || '未命名球員'}`,
          second: [role, competition, team].filter(Boolean).join('｜'),
          third: [crossRole, isUsPlayer(p) ? (p.externalCurrentLevel || '') : (year || cpblLevel)].filter(Boolean).join('｜') || ' '
        };
      };

      const make = list => list.length ? list.map(p => {
        const lines = allPlayerDialogLines(p);
        return `
          <button class="player-btn all-player-card ${p.id === selectedPlayerId ? 'active' : ''}" data-player-id="${p.id}">
            <span class="all-player-line all-player-line-main">${escapeHtml(lines.first)}</span>
            <span class="all-player-line all-player-line-meta">${escapeHtml(lines.second)}</span>
            <span class="all-player-line all-player-line-extra">${escapeHtml(lines.third)}</span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有符合篩選條件的球員。</div>';

      els.allPitchers.innerHTML = make(pitchers);
      els.allHitters.innerHTML = make(hitters);
      els.allDialog.querySelectorAll('[data-player-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await selectPlayer(btn.dataset.playerId);
          els.allDialog.close();
        });
      });
    }
