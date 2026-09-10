    async function cpblRequest(action, payload = {}) {
      const response = await fetch(CPBL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          appKey: CPBL_APP_KEY,
          anonKey: CPBL_ANON_KEY,
          action,
          ...payload
        })
      });
      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data?.ok) throw new Error(data?.error || `中職官網連線失敗（${response.status}）`);
      return data;
    }

    async function baseballRequest(action, payload = {}) {
      const response = await fetch(BASEBALL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          appKey: CPBL_APP_KEY,
          anonKey: CPBL_ANON_KEY,
          action,
          ...payload
        })
      });
      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `國外聯盟資料連線失敗（${response.status}）`);
      }
      return data;
    }

    function overseasProvider(competition = '') {
      const value = String(competition || '').trim();
      if (value === '美國職棒') return 'US';
      if (value === 'MLB') return 'MLB';
      if (value === 'MiLB') return 'MILB';
      if (value === 'NPB') return 'NPB';
      if (value === 'KBO') return 'KBO';
      return '';
    }

    function overseasProviderLabel(provider = '') {
      const value = String(provider || '').toUpperCase();
      if (value === 'US') return 'MLB / MiLB';
      return value === 'MILB' ? 'MiLB' : value;
    }

    function isUsPlayer(player) {
      if (!player || playerScope(player) !== 'overseas') return false;
      const provider = String(player.externalProvider || '').toUpperCase();
      const competition = String(player.externalCompetition || '').trim();
      return ['US','MLB','MILB'].includes(provider)
        || ['美國職棒','MLB','MiLB'].includes(competition);
    }

    function usCareerEntries(player) {
      return Array.isArray(player?.usCareerEntries) ? player.usCareerEntries : [];
    }

    function currentUsCareerEntry(player) {
      const entries = usCareerEntries(player);
      if (!entries.length) return null;
      const selectedKey = String(player?.usSelectedCareerKey || '');
      return entries.find(entry => String(entry.key) === selectedKey) || entries[0] || null;
    }

    function usCareerOptionLabel(entry) {
      if (!entry) return '';
      return [
        Number(entry.year) || '',
        String(entry.organizationName || entry.teamName || '').trim() || '球隊未提供',
        String(entry.level || '').trim() || 'MiLB'
      ].filter(Boolean).join('｜');
    }

    function applyUsCareerEntry(player, entry) {
      if (!player || !entry) return null;
      const year = Number(entry.year) || CURRENT_YEAR;
      const hitterLocal = entry.hitter ? externalHitterStatsToLocal(entry.hitter) : null;
      const pitcherLocal = entry.pitcher ? externalPitcherStatsToLocal(entry.pitcher) : null;

      player.usSelectedCareerKey = String(entry.key || '');
      player.externalYear = year;
      selectedSeason = year;
      selectedLevel = 'A';

      storeRoleStatsProfile(player, year, 'A', hitterLocal, pitcherLocal);
      const nextStats = player.type === 'pitcher'
        ? (pitcherLocal || pitcherDefaults())
        : (hitterLocal || hitterDefaults());
      ensureStatsProfiles(player)[statsProfileKey(year, 'A')] = { ...nextStats };
      player.stats = { ...nextStats };
      return entry;
    }

    async function syncUsCareer(player, onProgress = null, preferredYear = null) {
      if (!isUsPlayer(player) || !player?.externalPlayerId) return null;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(12, '正在同步 MLB / MiLB 生涯球隊與層級…');
      const data = await baseballRequest('career-stats', {
        provider:'US',
        id:player.externalPlayerId
      });
      const career = data?.career || {};
      const profile = career.profile || {};
      const current = career.current || {};
      const entries = Array.isArray(career.entries) ? career.entries : [];

      player.externalCompetition = '美國職棒';
      player.externalCurrentTeam = String(current.team || profile.team || player.externalCurrentTeam || player.externalTeam || '').trim();
      player.externalCurrentOrganization = String(current.organization || profile.currentOrganization || profile.organization || player.externalCurrentOrganization || '').trim();
      player.externalCurrentLevel = String(current.level || profile.currentLevel || player.externalCurrentLevel || '').trim();
      player.externalCurrentSportId = Number(current.sportId || profile.sportId || player.externalCurrentSportId || 0) || 0;
      player.externalTeam = player.externalCurrentTeam || player.externalTeam || '';
      player.externalPosition = profile.position || player.externalPosition || '';
      player.externalOfficialName = profile.name || player.externalOfficialName || '';
      if (profile.number) player.number = String(profile.number);

      player.usCareerEntries = entries.map(entry => ({
        ...entry,
        key:String(entry.key || [entry.year,entry.sportId,entry.teamId||entry.teamName||''].join('|')),
        year:Number(entry.year)||0,
        sportId:Number(entry.sportId)||0,
        level:String(entry.level||''),
        teamId:String(entry.teamId||''),
        teamName:String(entry.teamName||''),
        organizationName:String(entry.organizationName||'')
      })).filter(entry => entry.year && (entry.hitter || entry.pitcher));

      player.externalAvailableYears = [...new Set(
        player.usCareerEntries.map(entry => Number(entry.year)).filter(Number.isInteger)
      )].sort((a,b)=>b-a);

      const oldKey = String(player.usSelectedCareerKey || '');
      let active = player.usCareerEntries.find(entry => entry.key === oldKey) || null;
      const targetYear = Number(preferredYear) || 0;
      if (!active && targetYear) {
        active = player.usCareerEntries.find(entry => Number(entry.year) === targetYear) || null;
      }
      if (!active) {
        active = player.usCareerEntries.find(entry => Number(entry.year) === CURRENT_YEAR)
          || player.usCareerEntries[0]
          || null;
      }
      if (active) applyUsCareerEntry(player, active);

      player.externalLastUpdatedAt = Date.now();
      await savePlayer(player);
      report(94, `已整理 ${player.usCareerEntries.length} 筆年份／球隊／層級成績…`);
      return career;
    }

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

    async function syncInternationalTournamentStats(player, onProgress = null) {
      if (playerScope(player) !== 'international') return null;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const competition = playerSpecialCompetition(player);
      const year = Number(player.externalYear) || CURRENT_YEAR;
      const team = internationalTeam(player);
      const playerName = String(player.externalOfficialName || player.name || '').trim();

      report(12, `正在連線 ${competition} ${year} 賽事資料…`);
      const data = await baseballRequest('international-player-stats', {
        competition,
        year,
        team,
        playerId: String(player.externalPlayerId || ''),
        playerName
      });
      report(42, `正在整理 ${player.name} 的賽事成績…`);

      const remote = data?.stats || {};
      const hitter = remote?.hitter || null;
      const pitcher = remote?.pitcher || null;

      // 有官方資料時才覆蓋，避免尚未開打／來源暫時沒資料時把既有成績洗成 0。
      if (hitter || pitcher) {
        if (player.type === 'pitcher' && !pitcher && hitter) player.type = 'hitter';
        if (player.type === 'hitter' && !hitter && pitcher) player.type = 'pitcher';

        const official = player.type === 'pitcher' ? pitcher : hitter;
        if (official) {
          player.stats = player.type === 'pitcher'
            ? externalPitcherStatsToLocal(official)
            : externalHitterStatsToLocal(official);
        }

        player.internationalSource = remote.source || player.internationalSource || '';
        player.internationalSourceUrl = remote.sourceUrl || player.internationalSourceUrl || '';
        player.externalLastUpdatedAt = Date.now();
        player.internationalStatsFound = true;
        await savePlayer(player);
      } else {
        player.internationalSource = remote.source || player.internationalSource || '';
        player.internationalSourceUrl = remote.sourceUrl || player.internationalSourceUrl || '';
        player.externalLastCheckedAt = Date.now();
        player.internationalStatsFound = false;
        await savePlayer(player);
      }

      report(52, '賽事總成績已整理完成…');
      return remote;
    }


    function internationalHitterTotalsFromGames(games = []) {
      const next = hitterDefaults();
      for (const game of games) {
        const h = game?.hitter;
        if (!h) continue;
        for (const key of ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp']) {
          next[key] += Math.max(0, Number(h?.[key]) || 0);
        }
      }
      return next;
    }

    function internationalPitcherTotalsFromGames(games = []) {
      const next = pitcherDefaults();
      let totalRuns = 0;
      for (const game of games) {
        const p = game?.pitcher;
        if (!p) continue;
        for (const key of ['cg','sho','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']) {
          next[key] += Math.max(0, Number(p?.[key]) || 0);
        }
        totalRuns += Math.max(0, Number(p?.r) || 0);
      }
      next.noWalkHbp = 0;
      return next;
    }

    function internationalGameRecordFromRemote(player, game) {
      const date = String(game?.date || '').slice(0, 10);
      if (!date) return null;

      const record = {
        key: `${date}:${player.id}:A`,
        playerId: player.id,
        date,
        level: 'A',
        opponent: normalizeInternationalTeamName(game?.opponent || ''),
        hitterPAs: [],
        hitterAppearance: {
          mode: 'bat',
          inning: '1',
          half: 'top',
          battingOrder: '1',
          continueDefense: false,
          position: '游擊'
        },
        pitcherGame: {
          innings: '0.0', k: 0, bb: 0, h: 0, hbp: 0, otherReach: 0, r: 0, er: 0,
          pitchTens: 0, pitchOnes: 0,
          cg: false, sho: false, noWalkHbp: false,
          hld: false, sv: false, bsv: false, rainCalled: false,
          decision: 'ND', result: 'ND'
        },
        cpblGameSummary: {
          runs: 0,
          hits: 0,
          errors: 0,
          official: true
        },
        committedStats: null,
        committedAt: Date.now(),
        cpblReadOnlyImport: false,
        externalReadOnlyImport: true,
        internationalOfficialImport: true,
        internationalGameId: String(game?.gameId || ''),
        internationalPartialGame: Boolean(game?.partial),
        internationalHasVerifiedStats: Boolean(game?.hitter || game?.pitcher),
        internationalSources: Array.isArray(game?.sources) ? game.sources : [],
        externalSource: `INT:${game?.source || player.internationalSource || 'international'}`,
        externalImportedAt: Date.now(),
        updatedAt: Date.now()
      };

      if (game?.hitter) {
        const h = game.hitter;
        const list = Array.isArray(h.plateAppearances) ? h.plateAppearances : [];
        record.hitterPAs = list.map(pa => ({
          id: uid(),
          code: pa.code || 'OUT',
          position: pa.position || '',
          rbi: Math.max(0, Number(pa.rbi) || 0),
          cpblOfficialAction: pa.officialAction || ''
        }));
        record.internationalHitterGame = {
          pa: Math.max(0, Number(h.pa) || 0),
          ab: Math.max(0, Number(h.ab) || 0),
          runs: Math.max(0, Number(h.runs) || 0),
          hits: Math.max(0, Number(h.hits) || (
            (Number(h.single)||0)+(Number(h.double)||0)+(Number(h.triple)||0)+(Number(h.hr)||0)
          )),
          single: Math.max(0, Number(h.single) || 0),
          double: Math.max(0, Number(h.double) || 0),
          triple: Math.max(0, Number(h.triple) || 0),
          hr: Math.max(0, Number(h.hr) || 0),
          rbi: Math.max(0, Number(h.rbi) || 0),
          bb: Math.max(0, Number(h.bb) || 0),
          ibb: Math.max(0, Number(h.ibb) || 0),
          hbp: Math.max(0, Number(h.hbp) || 0),
          k: Math.max(0, Number(h.k) || 0),
          sacBunt: Math.max(0, Number(h.sacBunt) || 0),
          sacFly: Math.max(0, Number(h.sacFly) || 0),
          errors: Math.max(0, Number(h.errors) || 0)
        };
        record.cpblGameSummary = {
          runs: record.internationalHitterGame.runs,
          hits: record.internationalHitterGame.hits,
          errors: record.internationalHitterGame.errors,
          official: true
        };
        record.committedStats = record.hitterPAs.length
          ? deriveHitterGame(record.hitterPAs)
          : {
              pa:record.internationalHitterGame.pa,
              ab:record.internationalHitterGame.ab,
              rbi:record.internationalHitterGame.rbi,
              runs:record.internationalHitterGame.runs,
              single:record.internationalHitterGame.single,
              double:record.internationalHitterGame.double,
              triple:record.internationalHitterGame.triple,
              hr:record.internationalHitterGame.hr,
              sacBunt:record.internationalHitterGame.sacBunt,
              sacFly:record.internationalHitterGame.sacFly,
              bb:record.internationalHitterGame.bb,
              ibb:record.internationalHitterGame.ibb,
              hbp:record.internationalHitterGame.hbp
            };
      }

      if (game?.pitcher) {
        const p = game.pitcher;
        const g = record.pitcherGame;
        g.innings = p.innings || outsToIP(Number(p.outs)||0) || '0.0';
        g.k = Math.max(0, Number(p.k) || 0);
        g.bb = Math.max(0, Number(p.bb) || 0);
        g.h = Math.max(0, Number(p.h) || 0);
        g.hbp = Math.max(0, Number(p.hbp) || 0);
        g.r = Math.max(0, Number(p.r) || 0);
        g.er = Math.min(g.r, Math.max(0, Number(p.er) || 0));
        const pitchCount = Math.max(0, Number(p.pitchCount) || 0);
        g.pitchTens = Math.floor(Math.min(159, pitchCount) / 10);
        g.pitchOnes = Math.min(159, pitchCount) % 10;
        g.cg = Boolean(Number(p.cg) || p.cg);
        g.sho = Boolean(Number(p.sho) || p.sho);
        g.hld = Boolean(Number(p.hld) || p.hld);
        g.sv = Boolean(Number(p.sv) || p.sv);
        g.bsv = Boolean(Number(p.bsv) || p.bsv);
        g.decision = Number(p.w)>0 ? 'W' : Number(p.l)>0 ? 'L' : 'ND';
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        record.committedStats = derivePitcherGame(g);
      }

      return record;
    }

    async function syncInternationalTournamentGames(player, onProgress = null) {
      if (playerScope(player) !== 'international') return [];
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const competition = playerSpecialCompetition(player);
      const year = Number(player.externalYear) || CURRENT_YEAR;
      const team = internationalTeam(player);

      report(58, '正在搜尋本屆每場出賽資料…');
      const data = await baseballRequest('international-player-games', {
        competition,
        year,
        team,
        playerId: String(player.externalPlayerId || ''),
        playerName: String(player.externalOfficialName || player.name || '').trim()
      });
      const games = Array.isArray(data?.games) ? data.games : [];
      report(82, `找到 ${games.length} 場出賽，正在寫入單場戰績…`);

      let saved = 0;
      for (const game of games) {
        const record = internationalGameRecordFromRemote(player, game);
        if (!record) continue;
        const existing = await idbGet(STORES.games, record.key);
        // 使用者自己手動建立的同日紀錄不覆蓋；只更新我們自己的官方國際賽匯入。
        if (existing && !existing.internationalOfficialImport) continue;
        await idbPut(STORES.games, record);
        saved += 1;
      }

      // 只有完整官方逐場 Box 才可拿來回填整屆總成績。
      // 新聞交叉驗證 fallback 只顯示單場，不參與賽事總成績加總。
      const completeGames = games.filter(game => !game?.partial);
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

      player.internationalGamesLastCheckedAt = Date.now();
      player.internationalGameCount = saved;
      await savePlayer(player);
      report(94, `單場戰績已更新｜${saved} 場`);
      return games;
    }

    function cpblLevelLabel(kindCode) {
      return kindCode === 'D' ? '二軍' : '一軍';
    }

    function promiseTimeout(promise, ms, message = '操作逾時') {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
      ]);
    }

    async function refreshCurrentRosterStatus() {
      const linked = players.filter(player => player.cpblAcnt);
      if (!linked.length) return;

      try {
        const data = await promiseTimeout(
          cpblRequest('current-rosters', {
            acnts: linked.map(player => player.cpblAcnt)
          }),
          4500,
          '目前一二軍狀態查詢逾時'
        );
        const rows = Array.isArray(data.players) ? data.players : [];
        const byAcnt = new Map(rows.filter(row => row?.ok && row.acnt).map(row => [String(row.acnt), row]));

        for (const player of linked) {
          const current = byAcnt.get(String(player.cpblAcnt));
          if (!current?.team) continue;

          player.cpblTeam = normalizeTeamName(current.team);
          if (current.teamCode) player.cpblTeamCode = String(current.teamCode);
          if (current.number) player.number = String(current.number);
          player.cpblCurrentLevel = current.level === 'D' ? 'D' : 'A';

          const roleChanged = repairStoredCpblPlayerType(player, current.position || '');
          player.cpblRosterUpdatedAt = Date.now();

          if (roleChanged && player.id === selectedPlayerId) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await idbPut(STORES.players, player);
        }
      } catch (error) {
        console.warn('目前一二軍名單更新失敗', error);
      }
    }

    function pitcherInningsTextToOuts(value) {
      const text = String(value ?? '0.0');
      const m = text.match(/^(\d+)\.([012])$/);
      if (!m) return 0;
      return Number(m[1]) * 3 + Number(m[2]);
    }

    function applyCpblSeasonHistory(player, history, kindCode) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      player.cpblAvailableYears ||= { A: [], D: [] };
      player.cpblHistorySynced ||= { A: false, D: false };

      const sourceYears = Array.isArray(history?.years)
        ? history.years.map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR).sort((a, b) => b - a)
        : [];

      const appliedYears = [];
      for (const season of history?.seasons || []) {
        const year = Number(season?.year);
        if (!Number.isInteger(year)) continue;
        try {
          applyCpblSeasonStatsToPlayer(player, season, year, kindCode);
          appliedYears.push(year);
        } catch (error) {
          console.warn(`略過 ${year} ${cpblLevelLabel(kindCode)}資料`, error);
        }
      }

      // 只有真的成功寫進 statsProfiles 的年份才提供給軍別／年份切換。
      player.cpblAvailableYears[kindCode] = [...new Set(appliedYears)].sort((a,b)=>b-a);
      player.cpblHistorySynced[kindCode] = sourceYears.length === 0 || appliedYears.length > 0;
    }

    function syncProgressTitleForPlayer(player = selectedPlayer()) {
      if (!player) return '正在同步資料';
      const scope = playerScope(player);
      if (scope === 'cpbl') return '正在同步中職資料';
      if (scope === 'international') return '正在同步國際賽資料';
      const provider = String(player.externalProvider || playerSpecialCompetition(player) || '').toUpperCase();
      if (provider === 'NPB') return '正在同步 NPB 日職資料';
      if (provider === 'KBO') return '正在同步 KBO 韓職資料';
      if (provider === 'MILB') return '正在同步 MiLB 小聯盟資料';
      if (provider === 'MLB') return '正在同步 MLB 資料';
      return '正在同步國外聯盟資料';
    }

    function setSyncProgress(percent, status, { error = false } = {}) {
      setSyncUiLocked(true);
      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      if (els.syncProgressOverlay) els.syncProgressOverlay.classList.remove('hidden');
      if (els.syncProgressCard) els.syncProgressCard.classList.toggle('error', Boolean(error));
      if (els.syncProgressTitle) els.syncProgressTitle.textContent = syncProgressTitleForPlayer();
      if (els.syncProgressPercent) els.syncProgressPercent.textContent = `${value}%`;
      if (els.syncProgressStatus) els.syncProgressStatus.textContent = status || '';
      if (els.syncProgressBar) els.syncProgressBar.style.width = `${value}%`;
    }

    function hideSyncProgress() {
      els.syncProgressOverlay?.classList.add('hidden');
      els.syncProgressCard?.classList.remove('error');
      setSyncUiLocked(false);
    }

    async function finishSyncProgress(status = '同步完成') {
      setSyncProgress(100, status);
      await markSuccessfulSeasonSyncMeta();
      await new Promise(resolve => setTimeout(resolve, 420));
      hideSyncProgress();
    }

    async function syncPlayerCpblHistory(player, onProgress = null) {
      if (!player?.cpblAcnt) return;

      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };

      report(12, '正在連線中職官網…');
      report(24, '正在一次抓取一軍＋二軍歷年資料…');

      const data = await cpblRequest('season-histories', { acnt: player.cpblAcnt });
      const histories = data?.histories || {};
      const remoteErrors = data?.errors || {};
      const errors = [];

      report(76, '正在整理一軍＋二軍賽季資料…');

      for (const kindCode of ['A', 'D']) {
        const history = histories[kindCode];
        if (history) {
          applyCpblSeasonHistory(player, history, kindCode);
        } else {
          player.cpblAvailableYears ||= { A: [], D: [] };
          player.cpblHistorySynced ||= { A: false, D: false };
          player.cpblHistorySynced[kindCode] = false;
          errors.push(`${cpblLevelLabel(kindCode)}：${remoteErrors[kindCode] || '資料取得失敗'}`);
        }
      }

      const majorYears = availableSeasonYears(player, 'A');
      const minorYears = availableSeasonYears(player, 'D');

      if (histories.D?.years?.length && !minorYears.length) {
        errors.push('二軍：官網有資料，但前端寫入失敗');
      }

      report(92, '正在儲存球員資料…');
      await savePlayer(player);
      report(97, `一軍 ${majorYears.length} 季／二軍 ${minorYears.length} 季`);

      return { partialErrors: errors, majorYears, minorYears };
    }

    async function updatePlayerFromCpbl(player, silent = false, year = selectedSeason, kindCode = selectedLevel) {
      if (!player?.cpblAcnt) throw new Error('此球員尚未連結中職官網。');
      year = Math.max(1990, Math.floor(Number(year) || CURRENT_YEAR));
      kindCode = kindCode === 'D' ? 'D' : 'A';

      const data = await cpblRequest('season-stats', { acnt: player.cpblAcnt, year, kindCode });
      applyCpblSeasonStatsToPlayer(player, data.stats, year, kindCode);
      await savePlayer(player);
      if (!silent) setStatus(`已更新 ${year} 年中職官網${cpblLevelLabel(kindCode)}累積成績。`);
      return data;
    }

    function applyCpblSeasonStatsToPlayer(player, stats, year, kindCode = selectedLevel) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      const official = player.type === 'hitter' ? stats?.batting : stats?.pitching;
      if (!official) throw new Error(`${year} 年找不到此球員的${cpblLevelLabel(kindCode)}例行賽成績。`);

      let next;
      if (player.type === 'hitter') {
        next = { ...hitterDefaults(), ...official };
      } else {
        next = { ...pitcherDefaults(), ...official };
        next.outs = Number.isFinite(Number(official.outs))
          ? Number(official.outs)
          : pitcherInningsTextToOuts(official.innings);
        delete next.innings;

        const rawPitching = stats?.raw?.pitching || null;
        const officialEra = Number(rawPitching?.Era);
        const officialWhip = Number(rawPitching?.Whip);
        if (Number.isFinite(officialEra) && Number.isFinite(officialWhip)) {
          next.cpblEra = officialEra;
          next.cpblWhip = officialWhip;
          next.cpblRatesOfficial = true;
        } else {
          delete next.cpblEra;
          delete next.cpblWhip;
          delete next.cpblRatesOfficial;
        }
      }

      const cpblHitterRole = stats?.batting
        ? { ...hitterDefaults(), ...stats.batting }
        : null;
      let cpblPitcherRole = null;
      if (stats?.pitching) {
        cpblPitcherRole = { ...pitcherDefaults(), ...stats.pitching };
        cpblPitcherRole.outs = Number.isFinite(Number(stats.pitching.outs))
          ? Number(stats.pitching.outs)
          : pitcherInningsTextToOuts(stats.pitching.innings);
        delete cpblPitcherRole.innings;
      }
      storeRoleStatsProfile(player, year, kindCode, cpblHitterRole, cpblPitcherRole);

      const profiles = ensureStatsProfiles(player);
      const key = statsProfileKey(year, kindCode);
      profiles[key] = { ...next };
      if (player.id === selectedPlayerId && Number(year) === Number(selectedSeason) && kindCode === selectedLevel) {
        player.stats = { ...next };
      }

      player.cpblLastUpdatedByProfile ||= {};
      player.cpblLastUpdatedByProfile[key] = Date.now();
      player.cpblLastUpdatedAt = Date.now();
    }

    function currentOfficialDailyRolePair() {
      const pair = currentRecord?.externalRoleDaily;
      return pair && typeof pair === 'object'
        ? { hitter: pair.hitter || null, pitcher: pair.pitcher || null }
        : { hitter:null, pitcher:null };
    }

    function todayAvailableRoles(player) {
      const pair = currentOfficialDailyRolePair();
      const roles = [];
      if (dailyHitterRoleHasData(pair.hitter)) roles.push('hitter');
      if (dailyPitcherRoleHasData(pair.pitcher)) roles.push('pitcher');
      return roles.length ? roles : [player?.type === 'pitcher' ? 'pitcher' : 'hitter'];
    }

    function activeTodayRole(player) {
      const roles = todayAvailableRoles(player);
      if (roles.includes(todayRoleView)) return todayRoleView;
      if (roles.includes(player?.type)) return player.type;
      return roles[0] || (player?.type === 'pitcher' ? 'pitcher' : 'hitter');
    }

    function projectedPlayerStatsForRole(player, role) {
      if (!player) return {};
      role = role === 'pitcher' ? 'pitcher' : 'hitter';

      const pair = currentOfficialDailyRolePair();
      const hasOfficialDailyRole = role === 'pitcher'
        ? dailyPitcherRoleHasData(pair.pitcher)
        : dailyHitterRoleHasData(pair.hitter);

      // Official daily imports are already included in the synced season totals.
      // When viewing the player's secondary role, use that role's season profile
      // instead of treating the primary-role stats object as the wrong shape.
      if (hasOfficialDailyRole) {
        return seasonStatsForOutputRole(player, role);
      }

      if (role === player.type) return projectedPlayerStats(player);

      const originalType = player.type;
      const originalStats = player.stats;
      try {
        player.type = role;
        player.stats = seasonStatsForOutputRole(player, role);
        return projectedPlayerStats(player);
      } finally {
        player.type = originalType;
        player.stats = originalStats;
      }
    }

    async function applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite = true } = {}) {
      const hitter = daily?.hitter || null;
      const pitcher = daily?.pitcher || null;

      currentRecord.externalRoleDaily = {
        hitter: hitter ? { ...hitter } : null,
        pitcher: pitcher ? { ...pitcher } : null
      };

      if (hitter) {
        const list = Array.isArray(hitter.plateAppearances) ? hitter.plateAppearances : [];
        if (confirmHitterOverwrite && list.length && currentRecord.hitterPAs.length) {
          const overwrite = await showAppConfirm(
            '目前已有逐打席紀錄。\n要用官方資料覆蓋目前紀錄嗎？',
            {
              title:'覆蓋逐打席紀錄',
              confirmText:'覆蓋資料',
              cancelText:'保留目前資料',
              tone:'warning'
            }
          );
          if (!overwrite) return false;
        }

        currentRecord.hitterAppearance.mode = 'bat';
        if (list.length) {
          currentRecord.hitterPAs = list.map(pa => ({
            id:uid(),
            code:pa.code || 'OUT',
            position:pa.position || '',
            rbi:Number(pa.rbi) || 0,
            cpblOfficialAction:pa.officialAction || ''
          }));
        }

        currentRecord.cpblGameSummary = {
          runs:Math.max(0,Number(hitter.runs)||0),
          hits:Math.max(0,Number(hitter.hits)||0),
          errors:Math.max(0,Number(hitter.errors)||0),
          official:true
        };

        // Keep the official aggregate as a fallback when the source has no
        // verifiable plate-appearance sequence.
        currentRecord.internationalHitterGame = { ...hitter };
      }

      if (pitcher) {
        const g = currentRecord.pitcherGame;
        g.innings = pitcher.innings || outsToIP(Number(pitcher.outs)||0) || '0.0';
        g.k = Number(pitcher.k)||0;
        g.bb = Number(pitcher.bb)||0;
        g.h = Number(pitcher.h)||0;
        g.hbp = Number(pitcher.hbp)||0;
        g.r = Number(pitcher.r)||0;
        g.er = Math.min(g.r,Math.max(0,Number(pitcher.er)||0));
        const pitchCount = Math.max(0,Math.min(150,Number(pitcher.pitchCount)||0));
        g.pitchTens = Math.floor(pitchCount/10);
        g.pitchOnes = pitchCount>=150 ? 0 : pitchCount%10;
        g.cg = Boolean(Number(pitcher.cg)||pitcher.cg);
        g.sho = Boolean(Number(pitcher.sho)||pitcher.sho);
        g.hld = Boolean(Number(pitcher.hld)||pitcher.hld);
        g.sv = Boolean(Number(pitcher.sv)||pitcher.sv);
        g.bsv = Boolean(Number(pitcher.bsv)||pitcher.bsv);
        g.decision = Number(pitcher.w)>0 ? 'W' : Number(pitcher.l)>0 ? 'L'
          : (['W','L'].includes(pitcher.decision) ? pitcher.decision : 'ND');
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        currentRecord.externalWalksCombined = Boolean(pitcher.walksCombined);
        standardizePitcherSpecialRecords(g);
      }

      return true;
    }

    async function importExternalDaily(player) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) {
        throw new Error('此球員尚未連結國外聯盟資料。');
      }

      const data = await baseballRequest('daily', {
        provider:isUsPlayer(player) ? 'US' : player.externalProvider,
        id:player.externalPlayerId,
        date:els.gameDate.value
      });
      const daily = data.daily;
      if (!daily?.found) {
        const requestedDate = String(els.gameDate.value || '').replaceAll('-', '/');
        const last = daily?.lastAppearance;
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄。\n\n上一次出賽：${lastDate}${lastLevel ? `（${lastLevel}）` : ''}`;
          await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastLevel ? `（${lastLevel}）` : ''}。`);
          return false;
        }
        const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄，近期也找不到可確認的上一次出賽資料。`;
        await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
        setStatus('當日一軍、二軍皆無出賽資料。');
        return false;
      }

      currentRecord.externalLeagueLevel = String(daily.leagueLevel || '一軍');
      currentRecord.externalWalksCombined = false;
      currentRecord.externalRoleDaily = {
        hitter: daily.hitter ? { ...daily.hitter } : null,
        pitcher: daily.pitcher ? { ...daily.pitcher } : null
      };

      const localizedDailyName = String(daily.profile?.zhName || '').replace(/\s+/g, '');
      if (localizedDailyName && /[\u3400-\u9fff]/.test(localizedDailyName)) {
        const currentName = String(player.name || '').replace(/\s+/g, '');
        const preferredAliases = new Set(
          (Array.isArray(daily.profile?.zhNameAliases) ? daily.profile.zhNameAliases : [])
            .map(value => String(value || '').replace(/\s+/g, ''))
            .filter(Boolean)
        );
        if (!currentName
          || !/[\u3400-\u9fff]/.test(currentName)
          || localizedDailyName.includes(currentName)
          || (Boolean(daily.profile?.zhNamePreferred) && preferredAliases.has(currentName))) {
          player.name = localizedDailyName;
          player.externalOfficialName = daily.profile?.name || player.externalOfficialName || '';
          await savePlayer(player);
        }
      }

      if (daily.opponent) currentRecord.opponent = String(daily.opponent).trim();

      // If this date was already imported from an external provider, the old
      // record may contain a role that the corrected official parser no longer
      // reports. Clear only previously imported stale role data; manual records
      // that have not been imported remain untouched.
      if (currentRecord.externalReadOnlyImport) {
        if (!daily.hitter) {
          currentRecord.hitterPAs = [];
          currentRecord.internationalHitterGame = null;
          currentRecord.cpblGameSummary = {
            runs:0,hits:0,errors:0,official:false
          };
        }
        if (!daily.pitcher) {
          currentRecord.pitcherGame = {
            ...defaultGameRecord(player).pitcherGame
          };
        }
      }

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      currentRecord.externalReadOnlyImport = true;
      currentRecord.cpblReadOnlyImport = false;
      currentRecord.externalSource = player.externalProvider;
      currentRecord.externalImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.externalImportedAt };

      const importedHasHitter = dailyHitterRoleHasData(daily.hitter);
      const importedHasPitcher = dailyPitcherRoleHasData(daily.pitcher);
      if (importedHasPitcher && !importedHasHitter) todayRoleView = 'pitcher';
      else if (importedHasHitter && !importedHasPitcher) todayRoleView = 'hitter';

      currentRecord.committedStats = importedHasPitcher && !importedHasHitter
        ? derivePitcherGame(currentRecord.pitcherGame)
        : importedHasHitter
          ? deriveHitterGame(currentRecord.hitterPAs)
          : (player.type === 'hitter'
              ? deriveHitterGame(currentRecord.hitterPAs)
              : derivePitcherGame(currentRecord.pitcherGame));
      currentRecord.committedAt = Date.now();

      await saveRecord();
      renderAll();

      const noPa = importedHasHitter
        && !(Array.isArray(daily.hitter?.plateAppearances) && daily.hitter.plateAppearances.length);
      const sourceMode = String(daily.sourceMode || '');
      const levelLabel = String(daily.leagueLevel || '');
      const sourceLabel = `${overseasProviderLabel(player.externalProvider)}${levelLabel ? ` ${levelLabel}` : ''}`;
      const combinedNote = currentRecord.externalWalksCombined
        ? ' KBO Futures 官方 Box 僅提供四死球合計，戰報會以「四死球」標示。'
        : '';
      const roleNote = importedHasPitcher && !importedHasHitter
        ? ' 本場僅以投手身分出賽。'
        : importedHasHitter && !importedHasPitcher
          ? ' 本場以打者身分出賽。'
          : importedHasHitter && importedHasPitcher
            ? ' 本場同時有打擊與投球紀錄。'
            : '';
      setStatus(noPa
        ? sourceMode === 'eng-box'
          ? `已確認 ${els.gameDate.value} 有出賽並匯入 NPB 一軍官方英文 Box 彙總；日文詳細 Box 暫時無法讀取，所以逐打席未自動帶入。${roleNote}`
          : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日彙總；該來源未提供可解析的逐打席順序，可手動補逐打席。${roleNote}`
        : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日資料。${roleNote}${combinedNote}`);
      return true;
    }

    async function importCpblDaily(player) {
      if (!player?.cpblAcnt || !player?.cpblTeamCode) throw new Error('此球員尚未連結中職官網。');

      const gameYear = Number(els.gameDate.value?.slice(0, 4)) || CURRENT_YEAR;
      const levels = ['A','D'];
      let daily = null;
      let kindCode = 'A';
      let lastReason = '';

      for (const level of levels) {
        const knownYears = player?.cpblAvailableYears?.[level];
        if (Array.isArray(knownYears) && knownYears.length && !knownYears.includes(gameYear)) continue;

        try {
          const data = await cpblRequest('daily', {
            acnt: player.cpblAcnt,
            date: els.gameDate.value,
            teamCode: player.cpblTeamCode,
            kindCode: level
          });
          if (data?.daily?.found) {
            daily = data.daily;
            kindCode = level;
            break;
          }
          lastReason = data?.daily?.reason || lastReason;
        } catch (error) {
          lastReason = error?.message || lastReason;
        }
      }

      if (!daily?.found) {
        await showAppAlert(
          `${els.gameDate.value.replaceAll('-', '/')} 一軍、二軍都找不到此球員的出賽資料。`,
          { title:'當日無出賽', tone:'warning' }
        );
        setStatus(lastReason || '當日一軍、二軍皆無出賽資料。');
        return false;
      }

      // 找到哪個軍別就自動切到該軍別的本機紀錄，不需使用者手動選。
      if (selectedLevel !== kindCode) {
        persistActiveStatsProfile(player);
        selectedLevel = kindCode;
        const years = availableSeasonYears(player, kindCode);
        selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);
        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
        await loadRecord();
      }
      currentRecord.level = kindCode;

      if (daily.game?.opponent) currentRecord.opponent = normalizeTeamName(daily.game.opponent);

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      const isToday = els.gameDate.value === localISODate();
      currentRecord.cpblReadOnlyImport = !isToday;

      if (isToday) {
        try {
          await updatePlayerFromCpbl(player, true, gameYear, kindCode);
          currentRecord.committedStats = player.type === 'hitter'
            ? deriveHitterGame(currentRecord.hitterPAs)
            : derivePitcherGame(currentRecord.pitcherGame);
          currentRecord.committedAt = Date.now();
        } catch (error) {
          console.warn('CPBL cumulative sync after daily import failed', error);
        }
      } else {
        currentRecord.committedStats = player.type === 'hitter'
          ? deriveHitterGame(currentRecord.hitterPAs)
          : derivePitcherGame(currentRecord.pitcherGame);
        currentRecord.committedAt = Date.now();
      }

      currentRecord.cpblImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.cpblImportedAt };
      await saveRecord();
      renderAll();

      const levelLabel = kindCode === 'D' ? '二軍' : '一軍';
      setStatus(isToday
        ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料並同步今日累積數據。`
        : `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；歷史日期不會寫入球員累積數據。`);
      return true;
    }

