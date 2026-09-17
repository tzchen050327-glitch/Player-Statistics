(() => {
  'use strict';

  const DETAIL_URL_RE = /\/(?:cpbl-game-detail|cpbl-postseason-detail)(?:\?|$)/i;
  const nativeFetch = window.fetch.bind(window);
  const FIELD_POSITIONS = new Set(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);

  const compact = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normName = (value) => compact(value).replace(/[・·.\s]/g, '').toLowerCase();
  const sameName = (a, b) => {
    const x = normName(a);
    const y = normName(b);
    return !!x && !!y && x === y;
  };

  function positionCode(value) {
    const p = compact(value).toUpperCase();
    if (/^(P|投|投手|PITCHER)$/.test(p)) return 'P';
    if (/^(C|捕|捕手|CATCHER)$/.test(p)) return 'C';
    if (/^(1B|一|一壘|一塁|FIRST)$/.test(p)) return '1B';
    if (/^(2B|二|二壘|二塁|SECOND)$/.test(p)) return '2B';
    if (/^(3B|三|三壘|三塁|THIRD)$/.test(p)) return '3B';
    if (/^(SS|遊|游|遊撃|遊擊|游擊|SHORT)$/.test(p)) return 'SS';
    if (/^(LF|左|左翼|LEFT|左外野手)$/.test(p)) return 'LF';
    if (/^(CF|中|中堅|CENTER|中外野手)$/.test(p)) return 'CF';
    if (/^(RF|右|右翼|RIGHT|右外野手)$/.test(p)) return 'RF';
    return '';
  }

  function roleAndName(value) {
    const text = compact(value).replace(/[()（）]/g, '').replace(/^[-：:]+|[-：:]+$/g, '');
    const role = '(投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|P|C|1B|2B|3B|SS|LF|CF|RF)';
    let match = text.match(new RegExp(`^${role}[-：:]?(.*)$`, 'i'));
    if (match) return { position: positionCode(match[1]), name: compact(match[2]) };
    match = text.match(new RegExp(`^(.*?)[-：:]?${role}$`, 'i'));
    if (match) return { position: positionCode(match[2]), name: compact(match[1]) };
    return { position: '', name: text };
  }

  function playerName(player) {
    return compact(player?.name || player?.fullName || player?.chName || '');
  }

  function playerIndex(raw) {
    const map = new Map();
    for (const group of ['fielders', 'batters', 'roster']) {
      for (const player of Array.isArray(raw?.[group]) ? raw[group] : []) {
        const name = playerName(player);
        if (name && !map.has(normName(name))) map.set(normName(name), player);
      }
    }
    return map;
  }

  function setBatterPosition(raw, name, position) {
    if (!name || !position || !Array.isArray(raw?.batters)) return;
    const batter = raw.batters.find((player) => sameName(playerName(player), name));
    if (batter) batter.position = position;
  }

  function applyDefenseChanges(detail, side) {
    const raw = detail?.lineups?.[side];
    if (!raw || typeof raw !== 'object') return false;

    const players = playerIndex(raw);
    const state = new Map();
    const source = Array.isArray(raw.fielders) && raw.fielders.length
      ? raw.fielders
      : Array.isArray(raw.batters) ? raw.batters : [];

    for (const player of source) {
      const pos = positionCode(player?.position || player?.pos || '');
      const name = playerName(player);
      if (FIELD_POSITIONS.has(pos) && name) state.set(pos, { ...player, position: pos });
    }

    const findPlayer = (name) => {
      const key = normName(name);
      const base = players.get(key);
      return base ? { ...base } : { name: compact(name) };
    };

    const removePlayer = (name) => {
      if (!name) return;
      for (const [pos, player] of state) {
        if (sameName(playerName(player), name)) state.delete(pos);
      }
    };

    const assign = (name, position) => {
      if (!name || !FIELD_POSITIONS.has(position)) return;
      removePlayer(name);
      const player = findPlayer(name);
      player.position = position;
      state.set(position, player);
      setBatterPosition(raw, name, position);
    };

    let changed = false;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    for (const play of plays) {
      const fieldingSide = String(play?.half || '').toLowerCase() === 'top'
        ? 'home'
        : String(play?.half || '').toLowerCase() === 'bottom' ? 'away' : '';
      if (fieldingSide !== side) continue;

      const description = String(play?.description || '');
      let match;

      const replacementRe = /更換選手：([^。]+?)=>([^。]+?)(?=。|$)/g;
      while ((match = replacementRe.exec(description))) {
        const from = roleAndName(match[1]);
        const to = roleAndName(match[2]);
        if (!to.name || !FIELD_POSITIONS.has(to.position)) continue;
        if (from.name) removePlayer(from.name);
        assign(to.name, to.position);
        changed = true;
      }

      const defenseRe = /更換守備：([^。]+?)=>([^。]+?)(?=。|$)/g;
      while ((match = defenseRe.exec(description))) {
        const from = roleAndName(match[1]);
        const to = roleAndName(match[2]);
        const name = to.name || from.name;
        if (!name || !FIELD_POSITIONS.has(to.position)) continue;
        assign(name, to.position);
        changed = true;
      }
    }

    if (changed) raw.fielders = [...state.values()];
    return changed;
  }

  function normalizeCpblDefense(detail) {
    if (String(detail?.league || '').toUpperCase() !== 'CPBL') return false;
    const awayChanged = applyDefenseChanges(detail, 'away');
    const homeChanged = applyDefenseChanges(detail, 'home');
    return awayChanged || homeChanged;
  }

  window.fetch = async function cpblDefenseSubstitutionFetch(input, init) {
    const response = await nativeFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      if (!DETAIL_URL_RE.test(url) || !response.ok) return response;

      const payload = await response.clone().json();
      if (!payload?.ok || !payload?.game || !normalizeCpblDefense(payload)) return response;

      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn('[cpbl-defense] defensive substitution normalization failed', error);
      return response;
    }
  };
})();
