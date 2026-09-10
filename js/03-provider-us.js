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

