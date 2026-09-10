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

        const hitterLocal = hitter ? externalHitterStatsToLocal(hitter) : null;
        const pitcherLocal = pitcher ? externalPitcherStatsToLocal(pitcher) : null;
        storeRoleStatsProfile(player, year, 'A', hitterLocal, pitcherLocal);

        const official = player.type === 'pitcher' ? pitcher : hitter;
        if (official) {
          player.stats = player.type === 'pitcher'
            ? (pitcherLocal || pitcherDefaults())
            : (hitterLocal || hitterDefaults());
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

      player.internationalGamesLastCheckedAt = Date.now();
      player.internationalGameCount = saved;
      await savePlayer(player);
      report(94, `單場戰績已更新｜${saved} 場`);
      return games;
    }

