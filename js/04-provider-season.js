    function externalHitterStatsToLocal(stats = {}) {
      const next = hitterDefaults();
      for (const key of ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp','k','errors']) {
        next[key] = Math.max(0, Number(stats?.[key]) || 0);
      }
      return next;
    }

    function cpblOfficialTypeFromPosition(position = '') {
      const value = String(position || '').trim();
      if (/投手/.test(value)) return 'pitcher';

      // CPBL 官方球員頁常回傳實際守位名稱，而不一定是「內野手／外野手」大分類。
      // 所有非投手守備位置都應歸為 hitter 主分類。
      if (/(?:捕手|一壘手|二壘手|三壘手|游擊手|左外野手|中外野手|右外野手|內野手|内野手|外野手|指定打擊|DH|工具人)/i.test(value)) {
        return 'hitter';
      }
      return '';
    }

    function rebuildCpblPrimaryProfilesFromRoles(player, officialType) {
      const roleProfiles = ensureRoleStatsProfiles(player);
      const profiles = ensureStatsProfiles(player);
      let wrote = false;

      for (const [key, pair] of Object.entries(roleProfiles)) {
        const roleStats = officialType === 'pitcher' ? pair?.pitcher : pair?.hitter;
        const hasData = officialType === 'pitcher'
          ? pitcherRoleHasData(roleStats)
          : hitterRoleHasData(roleStats);
        if (!hasData) continue;
        profiles[key] = { ...roleStats };
        wrote = true;
      }

      const activeKey = statsProfileKey(selectedSeason, selectedLevel);
      if (profiles[activeKey]) {
        player.stats = { ...profiles[activeKey] };
      } else if (wrote) {
        const first = Object.keys(profiles)
          .sort((a,b) => String(b).localeCompare(String(a)))
          .find(key => profiles[key]);
        player.stats = first ? { ...profiles[first] } : (officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults());
      } else {
        player.stats = officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults();
      }
    }

    function repairStoredCpblPlayerType(player, officialPosition = '') {
      if (!player || playerScope(player) !== 'cpbl' || !player.cpblAcnt) return false;

      const position = String(officialPosition || player.cpblPosition || '').trim();
      const officialType = cpblOfficialTypeFromPosition(position);
      let changed = false;

      if (position && player.cpblPosition !== position) {
        player.cpblPosition = position;
        changed = true;
      }
      if (position) player.cpblPositionSource = 'CPBL 官方球員頁';
      if (!officialType) return changed;

      if (player.primaryType !== officialType) {
        player.primaryType = officialType;
        changed = true;
      }

      if (player.type !== officialType) {
        player.type = officialType;
        rebuildCpblPrimaryProfilesFromRoles(player, officialType);
        if (officialType === 'pitcher') {
          player.pitcherLastMetric = normalizePitcherLastMetric(player.pitcherLastMetric);
        }
        player.cpblRoleCorrectedAt = Date.now();
        changed = true;
      }
      return changed;
    }

    function externalPositionType(position = '') {
      const value = String(position || '').trim();
      if (/投手|pitcher|투수/i.test(value)) return 'pitcher';
      if (/捕手|内野手|外野手|catcher|infielder|outfielder|포수|내야수|외야수/i.test(value)) return 'hitter';
      return '';
    }

    function officialExternalPlayerType(player, profile = {}) {
      if (['pitcher','hitter'].includes(player?.primaryType)) return player.primaryType;
      const explicit = ['pitcher','hitter'].includes(profile?.type) ? profile.type : '';
      return explicit || externalPositionType(
        profile?.position || profile?.jpPosition || player?.externalPosition || ''
      ) || (['pitcher','hitter'].includes(player?.type) ? player.type : '');
    }

    function repairStoredExternalPlayerType(player) {
      if (!player || playerScope(player) !== 'overseas') return false;
      const officialType = externalPositionType(player.externalPosition || '') || player.primaryType || '';
      let changed = false;
      if (officialType && player.primaryType !== officialType) {
        player.primaryType = officialType;
        changed = true;
      }
      if (officialType && player.type !== officialType) {
        player.type = officialType;
        player.stats = officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults();
        if (officialType === 'pitcher') player.pitcherLastMetric = normalizePitcherLastMetric(player.pitcherLastMetric);
        changed = true;
      }
      return changed;
    }

    function externalPitcherStatsToLocal(stats = {}) {
      const next = pitcherDefaults();
      for (const key of ['cg','sho','noWalkHbp','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']) {
        next[key] = Math.max(0, Math.round(Number(stats?.[key]) || 0));
      }
      const era = Number(stats?.era);
      const whip = Number(stats?.whip);
      if (Number.isFinite(era) && Number.isFinite(whip)) {
        next.cpblEra = era;
        next.cpblWhip = whip;
        next.cpblRatesOfficial = true;
      }
      return next;
    }

    function ensureRoleStatsProfiles(player) {
      if (!player.roleStatsProfiles || typeof player.roleStatsProfiles !== 'object' || Array.isArray(player.roleStatsProfiles)) {
        player.roleStatsProfiles = {};
      }
      return player.roleStatsProfiles;
    }

    function roleStatsPair(player, year = selectedSeason, level = selectedLevel) {
      return ensureRoleStatsProfiles(player)[statsProfileKey(year, level)] || { hitter:null, pitcher:null };
    }

    function hitterRoleHasData(stats) {
      if (!stats) return false;
      return ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp']
        .some(key => Number(stats?.[key]) > 0);
    }

    function pitcherRoleHasData(stats) {
      if (!stats) return false;
      return ['cg','sho','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']
        .some(key => Number(stats?.[key]) > 0);
    }

    function storeRoleStatsProfile(player, year, level, hitterStats = null, pitcherStats = null) {
      const profiles = ensureRoleStatsProfiles(player);
      profiles[statsProfileKey(year, level)] = {
        hitter: hitterStats ? { ...hitterStats } : null,
        pitcher: pitcherStats ? { ...pitcherStats } : null
      };
      player.hasCrossRoleStats = Boolean(
        player.hasCrossRoleStats
        || (player.type === 'pitcher' && hitterRoleHasData(hitterStats))
        || (player.type === 'hitter' && pitcherRoleHasData(pitcherStats))
      );
    }

    function readonlyStatField(label, value) {
      return `<label class="field">${escapeHtml(label)}<input type="text" value="${escapeAttr(String(value ?? 0))}" readonly /></label>`;
    }

    function secondarySeasonStatsHtml(player) {
      if (!player || !supportsLeagueLevelTabs(player)) return '';
      const pair = roleStatsPair(player);
      const secondaryType = player.type === 'pitcher' ? 'hitter' : 'pitcher';
      const stats = pair?.[secondaryType] || null;

      if (secondaryType === 'hitter') {
        if (!hitterRoleHasData(stats)) return '';
        const d = hitterDerived(stats);
        return `
          <div class="dual-role-season-block">
            <div class="dual-role-season-head">
              <h3>同季打擊成績</h3>
              <span class="small">主要守位仍為投手</span>
            </div>
            <div class="metrics">
              <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
              <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
              <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
            </div>
            <div class="grid four">
              ${readonlyStatField('打席', stats.pa)}
              ${readonlyStatField('打數', stats.ab)}
              ${readonlyStatField('安打', d.hits)}
              ${readonlyStatField('得分', stats.runs)}
              ${readonlyStatField('打點', stats.rbi)}
              ${readonlyStatField('一安', stats.single)}
              ${readonlyStatField('二安', stats.double)}
              ${readonlyStatField('三安', stats.triple)}
              ${readonlyStatField('全壘打', stats.hr)}
              ${readonlyStatField('四壞球', stats.bb)}
              ${readonlyStatField('死球', stats.hbp)}
              ${readonlyStatField('犧牲短打', stats.sacBunt)}
            </div>
          </div>`;
      }

      if (!pitcherRoleHasData(stats)) return '';
      const d = pitcherDerived(stats);
      return `
        <div class="dual-role-season-block">
          <div class="dual-role-season-head">
            <h3>同季投球成績</h3>
            <span class="small">主要守位仍為打者</span>
          </div>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${stats.w || 0}／${stats.l || 0}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('投球局數', outsToIP(stats.outs || 0))}
            ${readonlyStatField('被安打', stats.h)}
            ${readonlyStatField('保送', stats.bb)}
            ${readonlyStatField('死球', stats.hbp)}
            ${readonlyStatField('三振', stats.k)}
            ${readonlyStatField('自責分', stats.er)}
            ${readonlyStatField('完投', stats.cg)}
            ${readonlyStatField('完封', stats.sho)}
            ${readonlyStatField('救援成功', stats.sv)}
            ${readonlyStatField('中繼成功', stats.hld)}
          </div>
        </div>`;
    }

    function secondaryRoleAvailableYears(player) {
      if (!player || !supportsLeagueLevelTabs(player)) return [];
      const years = new Set([
        ...availableSeasonYears(player, 'A'),
        ...availableSeasonYears(player, 'D')
      ]);
      const profiles = ensureRoleStatsProfiles(player);
      for (const [key, pair] of Object.entries(profiles)) {
        const [yearText] = String(key).split(':');
        const year = Number(yearText);
        if (!Number.isInteger(year)) continue;
        const secondary = player.type === 'pitcher' ? pair?.hitter : pair?.pitcher;
        if ((player.type === 'pitcher' ? hitterRoleHasData(secondary) : pitcherRoleHasData(secondary))) years.add(year);
      }
      return [...years].filter(y => Number.isInteger(y) && y >= 1990 && y <= 2100).sort((a,b)=>b-a);
    }

    function crossRoleLevelHtml(player, year, level) {
      const pair = roleStatsPair(player, year, level);
      const secondaryType = player.type === 'pitcher' ? 'hitter' : 'pitcher';
      const stats = pair?.[secondaryType] || null;
      const levelLabel = level === 'D' ? '二軍' : '一軍';

      if (secondaryType === 'hitter') {
        if (!hitterRoleHasData(stats)) {
          return `<section class="cross-role-level-card"><h3>${levelLabel}</h3><div class="cross-role-empty">${year} 年目前沒有可確認的打擊紀錄。</div></section>`;
        }
        const d = hitterDerived(stats);
        return `
          <section class="cross-role-level-card">
            <h3>${levelLabel}｜打擊成績</h3>
            <div class="metrics">
              <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
              <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
              <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
            </div>
            <div class="grid four">
              ${readonlyStatField('打席', stats.pa || 0)}
              ${readonlyStatField('打數', stats.ab || 0)}
              ${readonlyStatField('安打', d.hits || 0)}
              ${readonlyStatField('得分', stats.runs || 0)}
              ${readonlyStatField('打點', stats.rbi || 0)}
              ${readonlyStatField('一安', stats.single || 0)}
              ${readonlyStatField('二安', stats.double || 0)}
              ${readonlyStatField('三安', stats.triple || 0)}
              ${readonlyStatField('全壘打', stats.hr || 0)}
              ${readonlyStatField('四壞球', stats.bb || 0)}
              ${readonlyStatField('故意四壞', stats.ibb || 0)}
              ${readonlyStatField('死球', stats.hbp || 0)}
              ${readonlyStatField('三振', stats.k || 0)}
              ${readonlyStatField('犧牲短打', stats.sacBunt || 0)}
              ${readonlyStatField('犧牲高飛', stats.sacFly || 0)}
            </div>
          </section>`;
      }

      if (!pitcherRoleHasData(stats)) {
        return `<section class="cross-role-level-card"><h3>${levelLabel}</h3><div class="cross-role-empty">${year} 年目前沒有可確認的投球紀錄。</div></section>`;
      }
      const d = pitcherDerived(stats);
      return `
        <section class="cross-role-level-card">
          <h3>${levelLabel}｜投球成績</h3>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${stats.w || 0}／${stats.l || 0}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('投球局數', outsToIP(stats.outs || 0))}
            ${readonlyStatField('被安打', stats.h || 0)}
            ${readonlyStatField('保送', stats.bb || 0)}
            ${readonlyStatField('死球', stats.hbp || 0)}
            ${readonlyStatField('三振', stats.k || 0)}
            ${readonlyStatField('自責分', stats.er || 0)}
            ${readonlyStatField('勝場', stats.w || 0)}
            ${readonlyStatField('敗場', stats.l || 0)}
            ${readonlyStatField('完投', stats.cg || 0)}
            ${readonlyStatField('完封', stats.sho || 0)}
            ${readonlyStatField('救援成功', stats.sv || 0)}
            ${readonlyStatField('中繼成功', stats.hld || 0)}
          </div>
        </section>`;
    }

    function renderSecondaryRolePage(player) {
      const secondaryLabel = player.type === 'pitcher' ? '打擊成績' : '投球成績';
      const primaryLabel = player.type === 'pitcher' ? '投手' : '野手';
      els.content.innerHTML = `
        <div class="cross-role-page-head">
          <div>
            <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${secondaryLabel}</h2>
            <div class="small" style="margin-top:6px">主要守位仍為${primaryLabel}；這一頁只整理正式比賽中出現的另一種角色成績，不會改變球員身分。</div>
          </div>
          <div class="small">${selectedSeason} 年</div>
        </div>
        <div class="cross-role-level-grid">
          ${crossRoleLevelHtml(player, selectedSeason, 'A')}
          ${crossRoleLevelHtml(player, selectedSeason, 'D')}
        </div>
        ${playerSourceInfoHtml(player)}`;
    }

    async function syncSecondaryRoleSeason(player, year = selectedSeason, onProgress = null) {
      if (!player || playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const provider = String(player.externalProvider || '').toUpperCase();

      if (['NPB','KBO'].includes(provider)) {
        const lastChecked = Number(player?.externalLevelYearsCheckedAt?.D || 0);
        const historyStale = !lastChecked || (Date.now() - lastChecked > 24 * 60 * 60 * 1000);
        if (historyStale) {
          report(8, `正在確認 ${provider} 二軍歷年出賽…`);
          try { await syncExternalLevelYears(player, 'D', (p,s)=>report(Math.min(35, Math.round(p * .7)), s)); }
          catch (error) { console.warn(`${provider} 跨角色頁二軍年份同步失敗`, error); }
        }
      }

      const jobs = [];
      const majorYears = availableSeasonYears(player, 'A');
      const farmYears = availableSeasonYears(player, 'D');
      if (majorYears.includes(Number(year))) jobs.push('A');
      if (farmYears.includes(Number(year))) jobs.push('D');
      if (!jobs.length) jobs.push('A');

      let completed = 0;
      for (const level of jobs) {
        try {
          await syncExternalSeason(player, year, null, level);
        } catch (error) {
          console.warn(`跨角色頁 ${year} ${level} 同步失敗`, error);
        }
        completed++;
        report(40 + Math.round(completed / jobs.length * 48), `正在整理 ${year} ${level === 'D' ? '二軍' : '一軍'}投打資料…`);
      }
      await savePlayer(player);
    }

    function secondaryDailyRoleHtml(player) {
      const pair = currentRecord?.externalRoleDaily;
      if (!player || !pair) return '';
      if (player.type === 'pitcher') {
        const h = pair.hitter;
        if (!h || !(
          Number(h.pa)>0 || Number(h.ab)>0 || Number(h.hits)>0 || Number(h.runs)>0 || Number(h.rbi)>0
          || Number(h.bb)>0 || Number(h.hbp)>0 || Number(h.hr)>0
        )) return '';
        return `
          <div class="dual-role-season-block">
            <div class="dual-role-season-head"><h3>本場打擊成績</h3><span class="small">同一場投打紀錄合併顯示</span></div>
            <div class="grid four">
              ${readonlyStatField('打席', h.pa || 0)}
              ${readonlyStatField('打數', h.ab || 0)}
              ${readonlyStatField('安打', h.hits || 0)}
              ${readonlyStatField('得分', h.runs || 0)}
              ${readonlyStatField('打點', h.rbi || 0)}
              ${readonlyStatField('全壘打', h.hr || 0)}
              ${readonlyStatField('保送', h.bb || 0)}
              ${readonlyStatField('死球', h.hbp || 0)}
              ${readonlyStatField('三振', h.k || 0)}
            </div>
          </div>`;
      }

      const p = pair.pitcher;
      if (!p || !(
        Number(p.outs)>0 || String(p.innings || '0.0') !== '0.0' || Number(p.h)>0 || Number(p.k)>0
        || Number(p.bb)>0 || Number(p.hbp)>0 || Number(p.r)>0 || Number(p.er)>0
      )) return '';
      return `
        <div class="dual-role-season-block">
          <div class="dual-role-season-head"><h3>本場投球成績</h3><span class="small">同一場投打紀錄合併顯示</span></div>
          <div class="grid four">
            ${readonlyStatField('投球局數', p.innings || outsToIP(Number(p.outs)||0) || '0.0')}
            ${readonlyStatField('被安打', p.h || 0)}
            ${readonlyStatField('保送', p.bb || 0)}
            ${readonlyStatField('死球', p.hbp || 0)}
            ${readonlyStatField('三振', p.k || 0)}
            ${readonlyStatField('失分', p.r || 0)}
            ${readonlyStatField('自責分', p.er || 0)}
            ${readonlyStatField('用球數', p.pitchCount || 0)}
          </div>
        </div>`;
    }

    function applyExternalSeasonStats(player, remote, requestedYear, level = selectedLevel) {
      if (!player || !remote) throw new Error('國外聯盟賽季資料格式錯誤。');
      level = level === 'D' ? 'D' : 'A';

      const profile = remote.profile || {};
      const hitter = remote.hitter || null;
      const pitcher = remote.pitcher || null;

      player.externalTwoWay = Boolean(player.externalTwoWay || profile.twoWay);

      // type/primaryType 只代表主要守位；同一球員可同時保存打擊與投球資料。
      const officialType = officialExternalPlayerType(player, profile);
      if (officialType) {
        player.primaryType = officialType;
        player.type = officialType;
      } else if (!player.primaryType) {
        player.primaryType = player.type;
      }

      if (!hitter && !pitcher) {
        throw new Error(`${requestedYear} 年找不到此球員的例行賽成績。`);
      }

      const hitterLocal = hitter ? externalHitterStatsToLocal(hitter) : null;
      const pitcherLocal = pitcher ? externalPitcherStatsToLocal(pitcher) : null;
      storeRoleStatsProfile(player, requestedYear, level, hitterLocal, pitcherLocal);

      const official = player.type === 'pitcher' ? pitcher : hitter;
      const nextStats = player.type === 'pitcher'
        ? (pitcherLocal || pitcherDefaults())
        : (hitterLocal || hitterDefaults());

      const profiles = ensureStatsProfiles(player);
      profiles[statsProfileKey(requestedYear, level)] = { ...nextStats };
      if (player.id === selectedPlayerId && Number(requestedYear) === Number(selectedSeason) && level === selectedLevel) {
        player.stats = { ...nextStats };
      }

      player.externalTeam = profile.team || player.externalTeam || '';
      player.externalPosition = profile.position || player.externalPosition || '';
      player.externalOfficialName = profile.name || player.externalOfficialName || '';

      const localizedName = String(profile.zhName || '').replace(/\s+/g, '');
      if (localizedName && /[\u3400-\u9fff]/.test(localizedName)) {
        const currentName = String(player.name || '').replace(/\s+/g, '');
        const preferredAliases = new Set(
          (Array.isArray(profile.zhNameAliases) ? profile.zhNameAliases : [])
            .map(value => String(value || '').replace(/\s+/g, ''))
            .filter(Boolean)
        );
        const shouldUpgradeName = !currentName
          || !/[\u3400-\u9fff]/.test(currentName)
          || localizedName === currentName
          || localizedName.includes(currentName)
          || currentName === String(player.externalOfficialName || '').replace(/\s+/g, '')
          || (Boolean(profile.zhNamePreferred) && preferredAliases.has(currentName));
        if (shouldUpgradeName) player.name = localizedName;
      }

      const remoteYears = Array.isArray(profile.years)
        ? profile.years.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
        : [];
      player.externalAvailableYears = [...new Set([
        ...remoteYears,
        ...(Array.isArray(player.externalAvailableYears) ? player.externalAvailableYears.map(Number) : []),
        Number(requestedYear)
      ].filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100))].sort((a,b)=>b-a);

      player.externalAvailableYearsByLevel ||= { A: [], D: [] };
      const providerCode = String(player.externalProvider || '').toUpperCase();
      const levelYears = (level === 'A' || (level === 'D' && providerCode === 'KBO'))
        ? remoteYears
        : [Number(requestedYear)];
      player.externalAvailableYearsByLevel[level] = [...new Set([
        ...(Array.isArray(player.externalAvailableYearsByLevel[level]) ? player.externalAvailableYearsByLevel[level].map(Number) : []),
        ...levelYears,
        Number(requestedYear)
      ].filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100))].sort((a,b)=>b-a);

      player.externalYear = Number(requestedYear) || player.externalYear || CURRENT_YEAR;
      player.externalLastSyncSource = remote?.sourceMode || '';
      player.externalLastUpdatedAt = Date.now();
      return official;
    }

    async function syncExternalLevelYears(player, level = 'D', onProgress = null) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return [];
      level = level === 'D' ? 'D' : 'A';
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(10, `正在搜尋 ${overseasProviderLabel(player.externalProvider)} ${level === 'D' ? '二軍' : '一軍'}歷年出賽…`);
      const data = await baseballRequest('season-years', {
        provider:player.externalProvider,
        id:player.externalPlayerId,
        level
      });
      const years = Array.isArray(data?.history?.years)
        ? data.history.years.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
        : [];
      player.externalAvailableYearsByLevel ||= { A:[], D:[] };
      player.externalAvailableYearsByLevel[level] = [...new Set(years)].sort((a,b)=>b-a);
      player.externalLevelYearsCheckedAt ||= {};
      player.externalLevelYearsCheckedAt[level] = Date.now();
      report(48, `${level === 'D' ? '二軍' : '一軍'}找到 ${years.length} 個有出賽的賽季…`);
      await savePlayer(player);
      return player.externalAvailableYearsByLevel[level];
    }

    async function syncExternalSeason(player, requestedYear = selectedSeason, onProgress = null, level = selectedLevel) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return null;
      if (isUsPlayer(player)) {
        return await syncUsCareer(player, onProgress, requestedYear);
      }
      level = level === 'D' ? 'D' : 'A';
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(18, `正在連線 ${overseasProviderLabel(player.externalProvider)}…`);
      const data = await baseballRequest('season-stats', {
        provider: player.externalProvider,
        id: player.externalPlayerId,
        year: requestedYear,
        level: supportsLeagueLevelTabs(player) ? level : 'A'
      });
      report(76, `正在整理 ${requestedYear} 賽季資料…`);
      const remote = data.stats;
      applyExternalSeasonStats(player, remote, requestedYear, level);
      await savePlayer(player);
      report(94, '正在更新球員資料…');
      return remote;
    }

