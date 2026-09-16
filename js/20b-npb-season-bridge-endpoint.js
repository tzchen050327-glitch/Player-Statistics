    // Verified NPB bridge endpoint. Kept separate so the bridge module can stay focused on state/calculation logic.
    const NPB_SEASON_BRIDGE_V2_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-season-bridge-v2';

    npbSeasonBridgeRequest = async function(player, {
      year = selectedSeason,
      date = npbBridgeViewDate()
    } = {}) {
      const response = await fetch(NPB_SEASON_BRIDGE_V2_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          action:'status',
          id:String(player.externalPlayerId || ''),
          year:Number(year) || CURRENT_YEAR,
          date:String(date || npbBridgeTokyoDate()),
          team:String(player.externalTeam || player.externalCurrentTeam || ''),
          name:String(player.externalOfficialName || player.name || '')
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data?.stats) {
        throw new Error(data?.error || `NPB 賽前橋接查詢失敗（${response.status}）`);
      }
      return data;
    };
