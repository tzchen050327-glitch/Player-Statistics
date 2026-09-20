
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-baseball-proxy-key',
  'content-type': 'application/json; charset=utf-8'
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36';
const BASEBALL_PROXY_KEY = '__BASEBALL_PROXY_KEY__';
const SUPABASE_PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY')||'';
const MLB_BASE = 'https://statsapi.mlb.com/api/v1';
const NPB_BASE = 'https://npb.jp';
const KBO_BASE = 'https://www.koreabaseball.com';
const INTERNATIONAL_BOT_DATA_URL = 'https://raw.githubusercontent.com/tzchen050327-glitch/Player-Statistics/main/data/international-stats.json';
const MILB_SPORT_IDS = [11,12,13,14,15,16];
const MILB_SEARCH_SPORT_IDS = [11,12,13,14,15,16,21];
const US_SPORT_IDS = [1,...MILB_SPORT_IDS];

const textCache = new Map();
const jsonCache = new Map();
const nameCache = new Map();

function send(data, status=200){
  return new Response(JSON.stringify(data), {status, headers:CORS});
}
function clean(v){
  return String(v == null ? '' : v).replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
}
function decodeHtml(v){
  return clean(String(v||'')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&#x27;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)||32))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)||32))
  );
}
function strip(v){
  return decodeHtml(String(v||'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<\/(?:p|div|li|tr|td|th|h\d)>/gi,' ')
    .replace(/<[^>]+>/g,' ')
  );
}
function norm(v){
  return clean(v).normalize('NFKC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[·・.'’\-_,()\[\]{}#]/g,'')
    .replace(/\s+/g,'');
}
function num(v){
  const x = Number(String(v == null ? '' : v).replace(/,/g,'').trim());
  return Number.isFinite(x) ? x : 0;
}
function yearOf(v){
  const y = Math.floor(num(v));
  return y >= 1900 && y <= 2100 ? y : new Date().getFullYear();
}
function ipToOuts(v){
  // NPB may render partial innings as "30 .2", "30. 2", or "30 2/3".
  const s = clean(v)
    .replace(/\s*\.\s*/g,'.')
    .replace(/(\d)\s+([12]\/3)$/,'$1 $2');
  let m = s.match(/^(\d+)(?:\.([012]))?$/);
  if(m) return Number(m[1])*3 + Number(m[2]||0);
  m = s.match(/^(\d+)\s*([12])\/3$/);
  return m ? Number(m[1])*3 + Number(m[2]) : 0;
}
function outsToIp(v){
  const x = Math.max(0, Math.round(num(v)));
  return String(Math.floor(x/3)) + '.' + String(x%3);
}
function singles(h,d,t,hr){
  return Math.max(0, num(h)-num(d)-num(t)-num(hr));
}
function playerType(position){
  return /投手|pitcher|투수/i.test(clean(position)) ? 'pitcher' : 'hitter';
}
function dateParts(date){
  const m = String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) throw new Error('date must be YYYY-MM-DD');
  return {year:Number(m[1]), mm:m[2], dd:m[3], mmdd:m[2]+m[3], dot:m[2]+'.'+m[3]};
}
function rows(html){
  return [...String(html||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>{
    const cells = [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>strip(c[1]));
    return {html:m[0], cells};
  }).filter(r=>r.cells.length);
}
function tables(html){
  return [...String(html||'').matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
}
function headerMap(cells){
  const m = new Map();
  cells.forEach((c,i)=>m.set(norm(c),i));
  return m;
}
function pick(row,map,...labels){
  for(const label of labels){
    const i = map.get(norm(label));
    if(i !== undefined && i < row.length) return row[i];
  }
  return '';
}
async function getText(url, ttl=60000){
  const c = textCache.get(url);
  if(c && Date.now()-c.at < ttl) return c.value;
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 12000);
  try{
    const parsedUrl=new URL(url);
    const isWbsc=/(^|\.)wbsc(?:asia)?\.org$/i.test(parsedUrl.hostname);
    const isMlbStats=parsedUrl.hostname==='statsapi.mlb.com';
    const useOfficialDbProxy=isWbsc||isMlbStats;

    // WBSC and MLB Stats API are fetched through a restricted Postgres HTTP proxy.
    // The RPC only accepts official WBSC / statsapi.mlb.com hosts.
    if(useOfficialDbProxy){
      try{
        const sbUrl=Deno.env.get('SUPABASE_URL')||'';
        const sbKey=SUPABASE_PUBLIC_KEY;
        if(sbUrl && sbKey){
          const rpc=await fetch(sbUrl+'/rest/v1/rpc/baseball_official_http_get',{
            method:'POST',
            headers:{
              'content-type':'application/json',
              'apikey':sbKey
            },
            body:JSON.stringify({p_url:url}),
            signal:ctrl.signal
          });
          if(rpc.ok){
            const value=await rpc.json();
            if(typeof value==='string' && value.length){
              textCache.set(url,{at:Date.now(),value});
              return value;
            }
          }else{
            console.warn('official baseball database proxy HTTP',rpc.status,await rpc.text());
          }
        }
      }catch(e){
        console.warn('official baseball database proxy failed',e);
      }
    }

    const headers:Record<string,string>={
      'user-agent':UA,
      'accept-language':'zh-TW,zh;q=.9,en;q=.8,ja;q=.8,ko;q=.8'
    };
    if(isWbsc){
      headers['accept']='text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
      headers['cache-control']='no-cache';
      const parts=parsedUrl.pathname.split('/').filter(Boolean);
      const eventIndex=parts.indexOf('events');
      const eventPath=eventIndex>=0 && parts[eventIndex+1] ? '/'+parts.slice(0,eventIndex+2).join('/') : '';
      headers['referer']=parsedUrl.origin+(eventPath?eventPath+'/schedule-and-results':'/');
    }
    const r = await fetch(url,{
      headers,
      cache:'no-store',
      redirect:'follow',
      signal:ctrl.signal
    });
    if(!r.ok) throw new Error('HTTP '+r.status+' '+new URL(url).hostname);
    const value = await r.text();
    textCache.set(url,{at:Date.now(),value});
    return value;
  } finally {
    clearTimeout(timer);
  }
}
async function getJson(url, ttl=60000){
  const c = jsonCache.get(url);
  if(c && Date.now()-c.at < ttl) return c.value;
  const value = JSON.parse(await getText(url,ttl));
  jsonCache.set(url,{at:Date.now(),value});
  return value;
}
async function postFormJson(url, data, ttl=60000){
  const body = new URLSearchParams();
  for(const [key,value] of Object.entries(data||{})){
    if(value !== undefined && value !== null) body.set(key,String(value));
  }
  const cacheKey='POST '+url+'?'+body.toString();
  const c=jsonCache.get(cacheKey);
  if(c && Date.now()-c.at < ttl) return c.value;

  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{
        'user-agent':UA,
        'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
        'accept':'application/json, text/javascript, */*; q=0.01',
        'x-requested-with':'XMLHttpRequest',
        'referer':KBO_BASE+'/Schedule/GameCenter/Main.aspx'
      },
      body:body.toString(),
      cache:'no-store',
      redirect:'follow',
      signal:ctrl.signal
    });
    if(!r.ok) throw new Error('HTTP '+r.status+' '+new URL(url).hostname);
    const value=JSON.parse(await r.text());
    jsonCache.set(cacheKey,{at:Date.now(),value});
    return value;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Chinese / multilingual names ---------- */
async function resolveNameGroups(query){
  query = clean(query);
  if(!query) return [];
  if(nameCache.has(query)) return await nameCache.get(query);

  const task = (async()=>{
    const groups = [{zhName:/[\u3400-\u9fff]/.test(query)?query:'', variants:[query]}];
    if(!/[\u3400-\u9fff]/.test(query)) return groups;

    try{
      const searchUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities'
        +'&search='+encodeURIComponent(query)
        +'&language=zh&uselang=zh&limit=6&format=json&origin=*';
      const search = await getJson(searchUrl,600000);
      const ids = (search.search||[]).map(x=>x.id).filter(Boolean).slice(0,6);
      if(!ids.length) return groups;

      const entityUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities'
        +'&ids='+encodeURIComponent(ids.join('|'))
        +'&props=labels|aliases&languages=zh|zh-hant|zh-tw|ja|ko|en&format=json&origin=*';
      const data = await getJson(entityUrl,600000);

      for(const id of ids){
        const e = data.entities && data.entities[id];
        if(!e) continue;
        const zh = (e.labels?.['zh-hant']?.value)
          || (e.labels?.['zh-tw']?.value)
          || (e.labels?.zh?.value)
          || query;
        const variants = new Set([query,zh]);
        for(const lang of ['zh-hant','zh-tw','zh','ja','ko','en']){
          if(e.labels?.[lang]?.value) variants.add(e.labels[lang].value);
          for(const a of e.aliases?.[lang]||[]) if(a?.value) variants.add(a.value);
        }
        groups.push({zhName:zh, variants:[...variants].slice(0,30)});
      }
    }catch(e){
      console.warn('multilingual name resolver failed',e);
    }
    return groups;
  })();

  nameCache.set(query,task);
  return await task;
}
function chineseNameFor(groups, official){
  const b = norm(official);
  for(const g of groups){
    const ok = (g.variants||[]).some(v=>{
      const a=norm(v);
      return a && b && (a===b || a.includes(b) || b.includes(a));
    });
    if(ok) return g.zhName || '';
  }
  return '';
}

/* ---------- MLB / MiLB ---------- */
const MLB_PREFERRED_ZH_BY_ID = {
  '660271':'大谷翔平',
  '808967':'山本由伸'
};
const MLB_STALE_ZH_ALIASES_BY_ID = {
  '660271':['大谷'],
  '808967':['山本']
};
function mlbPreferredChineseName(id,fallback=''){
  return MLB_PREFERRED_ZH_BY_ID[String(id||'')] || fallback || '';
}
function mlbStaleChineseAliases(id){
  return MLB_STALE_ZH_ALIASES_BY_ID[String(id||'')] || [];
}
function mlbIsTwoWayPosition(position){
  const code=String(position?.code||'').toUpperCase();
  const abbr=String(position?.abbreviation||'').toUpperCase();
  const name=String(position?.name||'');
  return code==='Y' || abbr==='TWP' || /two[- ]?way/i.test(name);
}
async function mlbHasMilbSeason(id,y){
  const [h,p]=await Promise.all([
    mlbSplits(id,'hitting','season',y,MILB_SPORT_IDS).catch(()=>[]),
    mlbSplits(id,'pitching','season',y,MILB_SPORT_IDS).catch(()=>[])
  ]);
  return Boolean((h&&h.length)||(p&&p.length));
}
async function mlbSearch(provider, query, y){
  const groups = await resolveNameGroups(query);
  const variants = [...new Set(groups.flatMap(g=>g.variants||[]))].filter(Boolean).slice(0,14);
  const out = [];
  const seen = new Set();

  const addPlayer=(p)=>{
    if(!p?.id || seen.has(p.id)) return false;
    const official=clean(p.fullName);
    const match=variants.some(v=>{
      const a=norm(v),b=norm(official);
      return a&&b&&(a===b||a.includes(b)||b.includes(a));
    });
    if(!match) return false;

    const wikiName=chineseNameFor(groups,official);
    const preferredName=mlbPreferredChineseName(p.id,'');
    seen.add(p.id);
    out.push({
      provider,
      id:String(p.id),
      name:official,
      zhName:preferredName||wikiName,
      zhNamePreferred:Boolean(preferredName),
      zhNameAliases:preferredName?mlbStaleChineseAliases(p.id):[],
      number:p.primaryNumber||'',
      team:p.currentTeam?.name||'',
      position:p.primaryPosition?.name||'',
      type:p.primaryPosition?.code==='1'?'pitcher':'hitter',
      twoWay:mlbIsTwoWayPosition(p.primaryPosition)
    });
    return true;
  };

  // 第一層：依聯盟直接做 people search。
  // MLB 限 sportId=1；MiLB 不使用 active=true，並指定各小聯盟層級，
  // 避免小聯盟球員被 MLB 的 active 篩選排除。
  for(const variant of variants){
    try{
      const qs=new URLSearchParams({
        names:variant,
        hydrate:'currentTeam,primaryPosition'
      });
      if(provider==='MLB'){
        qs.set('active','true');
        qs.set('sportIds','1');
      }else{
        qs.set('sportIds',MILB_SEARCH_SPORT_IDS.join(','));
      }
      const data=await getJson(MLB_BASE+'/people/search?'+qs.toString(),120000);
      for(const p of data.people||[]){
        addPlayer(p);
        if(out.length>=12) break;
      }
    }catch{}
    if(out.length>=12) break;
  }

  // 第二層（MiLB）：有些球員目前已升上 MLB，但查詢年份仍有 MiLB 成績。
  // 再做一次不限制目前 sport 的姓名搜尋，並用指定年份的小聯盟成績驗證。
  if(provider==='MILB' && out.length<12){
    for(const variant of variants){
      let data=null;
      try{
        const qs=new URLSearchParams({
          names:variant,
          hydrate:'currentTeam,primaryPosition'
        });
        data=await getJson(MLB_BASE+'/people/search?'+qs.toString(),120000);
      }catch{
        continue;
      }

      for(const p of data?.people||[]){
        if(!p?.id || seen.has(p.id)) continue;
        const official=clean(p.fullName);
        const match=variants.some(v=>{
          const a=norm(v),b=norm(official);
          return a&&b&&(a===b||a.includes(b)||b.includes(a));
        });
        if(!match) continue;

        let hasMilb=false;
        try{hasMilb=await mlbHasMilbSeason(p.id,y)}catch{}
        if(!hasMilb) continue;

        addPlayer(p);
        if(out.length>=12) break;
      }
      if(out.length>=12) break;
    }
  }

  // 第三層：以該年份各層級球員名冊作最後 fallback。
  if(!out.length){
    const sports = provider==='MLB' ? [1] : MILB_SPORT_IDS;
    for(const sportId of sports){
      try{
        const data = await getJson(
          MLB_BASE+'/sports/'+sportId+'/players?season='+y+'&hydrate=currentTeam,primaryPosition',
          300000
        );
        for(const p of data.people||[]){
          addPlayer(p);
          if(out.length>=12) break;
        }
      }catch{}
      if(out.length>=12) break;
    }
  }
  return out.slice(0,12);
}
async function mlbProfile(provider,id){
  const data = await getJson(MLB_BASE+'/people/'+encodeURIComponent(id)+'?hydrate=currentTeam,primaryPosition',120000);
  const p = data.people?.[0];
  if(!p) throw new Error('MLB/MiLB player not found');

  let team=p.currentTeam?.name||'';
  let sportId=provider==='MLB'?1:0;
  let organization='';
  if(p.currentTeam?.id){
    try{
      const td=await getJson(MLB_BASE+'/teams/'+p.currentTeam.id+'?hydrate=sport',120000);
      const t=td.teams?.[0];
      team=t?.name||team;
      sportId=Number(t?.sport?.id)||sportId;
      organization=clean(t?.parentOrgName||'');
      if(!organization && sportId===1) organization=team;
    }catch{}
  }
  const preferredName=mlbPreferredChineseName(p.id,'');
  return {
    provider,id:String(p.id),name:p.fullName||'',number:p.primaryNumber||'',team,organization,
    position:p.primaryPosition?.name||'',type:p.primaryPosition?.code==='1'?'pitcher':'hitter',
    twoWay:mlbIsTwoWayPosition(p.primaryPosition),
    sportId,active:Boolean(p.active),
    zhName:preferredName,
    zhNamePreferred:Boolean(preferredName),
    zhNameAliases:preferredName?mlbStaleChineseAliases(p.id):[]
  };
}
async function mlbHydratedSplits(id,group,kind,y,sportId){
  const hydrate='stats('
    +'group=['+group+'],'
    +'type=['+kind+'],'
    +'season='+String(y)+','
    +'sportId='+String(sportId)+','
    +'gameType=[R]'
    +')';
  const data=await getJson(
    MLB_BASE+'/people/'+encodeURIComponent(id)+'?hydrate='+encodeURIComponent(hydrate),
    90000
  );
  const person=data.people?.[0];
  return (person?.stats||[]).flatMap(block=>Array.isArray(block?.splits)?block.splits:[]);
}

async function mlbSplits(id,group,kind,y,sportIds){
  const ids=[...new Set((sportIds||[]).map(Number).filter(Boolean))];

  const fetchSplits=async(targetIds)=>{
    const qs = new URLSearchParams({stats:kind,group,season:String(y),gameType:'R'});
    if(targetIds.length) qs.set('sportIds',targetIds.join(','));
    const data = await getJson(
      MLB_BASE+'/people/'+encodeURIComponent(id)+'/stats?'+qs.toString(),
      90000
    );
    return (data.stats||[]).flatMap(block=>Array.isArray(block?.splits)?block.splits:[]);
  };

  // MLB 仍優先走原本的個人 stats endpoint。
  if(ids.length===1 && ids[0]===1){
    return await fetchSplits(ids);
  }

  // MiLB：先用官方 hydrate(stats(...,sportId=N))，逐層級抓。
  // 這條對小聯盟比 /people/{id}/stats?sportIds=... 穩定。
  const hydratedResults=await Promise.all(
    ids.map(async sportId=>{
      try{return await mlbHydratedSplits(id,group,kind,y,sportId)}
      catch{return []}
    })
  );
  const hydrated=hydratedResults.flat();
  if(hydrated.length){
    const seen=new Set();
    const out=[];
    for(const split of hydrated){
      const key=[
        split?.date||split?.game?.gameDate||'',
        split?.game?.gamePk||'',
        split?.team?.id||split?.team?.name||'',
        split?.sport?.id||'',
        JSON.stringify(split?.stat||{})
      ].join('|');
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(split);
    }
    return out;
  }

  // 最後才回退舊 stats endpoint。
  try{
    const combined=await fetchSplits(ids);
    if(combined.length || ids.length<=1) return combined;
  }catch(e){
    if(ids.length<=1) throw e;
  }

  const results=await Promise.all(
    ids.map(async sportId=>{
      try{return await fetchSplits([sportId])}
      catch{return []}
    })
  );

  const seen=new Set();
  const out=[];
  for(const split of results.flat()){
    const key=[
      split?.date||split?.game?.gameDate||'',
      split?.game?.gamePk||'',
      split?.team?.id||split?.team?.name||'',
      split?.sport?.id||'',
      JSON.stringify(split?.stat||{})
    ].join('|');
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(split);
  }
  return out;
}
function mlbHitter(s,errors=0){
  if(!s) return null;
  const h=num(s.hits), d=num(s.doubles), t=num(s.triples), hr=num(s.homeRuns);
  return {
    pa:num(s.plateAppearances),ab:num(s.atBats),runs:num(s.runs),hits:h,
    single:singles(h,d,t,hr),double:d,triple:t,hr,rbi:num(s.rbi),
    bb:num(s.baseOnBalls),ibb:num(s.intentionalWalks),hbp:num(s.hitByPitch),
    sacBunt:num(s.sacBunts),sacFly:num(s.sacFlies),k:num(s.strikeOuts),
    avg:num(s.avg),obp:num(s.obp),slg:num(s.slg),errors:num(errors)
  };
}
function mlbPitcher(s){
  if(!s) return null;
  const outs=ipToOuts(s.inningsPitched),h=num(s.hits),bb=num(s.baseOnBalls),er=num(s.earnedRuns);
  return {
    outs,innings:outsToIp(outs),h,bb,hbp:num(s.hitBatsmen),k:num(s.strikeOuts),
    r:num(s.runs),er,w:num(s.wins),l:num(s.losses),sv:num(s.saves),hld:num(s.holds),
    bsv:num(s.blownSaves),cg:num(s.completeGames),sho:num(s.shutouts),
    era:num(s.era),whip:num(s.whip)||(outs?(h+bb)/(outs/3):0)
  };
}
async function mlbSeason(provider,id,y){
  const profile=await mlbProfile(provider,id);
  let sports=provider==='MLB'?[1]:MILB_SPORT_IDS;
  if(provider==='MILB' && profile.sportId && profile.sportId!==1){
    sports=[profile.sportId,...MILB_SPORT_IDS.filter(x=>x!==profile.sportId)];
  }
  const [h,p,f]=await Promise.all([
    mlbSplits(id,'hitting','season',y,sports).catch(()=>[]),
    mlbSplits(id,'pitching','season',y,sports).catch(()=>[]),
    mlbSplits(id,'fielding','season',y,sports).catch(()=>[])
  ]);
  const errors=(f||[]).reduce((sum,x)=>sum+num(x?.stat?.errors),0);
  const hitter=mlbHitter(h[0]?.stat,errors);
  const pitcher=mlbPitcher(p[0]?.stat);
  if(hitter && pitcher && String(id)==='660271') profile.twoWay=true;
  return {provider,year:y,profile,hitter,pitcher};
}
function mlbPaCode(eventType,description=''){
  const type=String(eventType||'').toLowerCase();
  const raw=clean(description);
  const map={
    single:'1B',double:'2B',triple:'3B',home_run:'HR',
    walk:'BB',intent_walk:'IBB',hit_by_pitch:'HBP',catcher_interf:'CI',
    sac_bunt:'SH',sac_fly:'SF',sac_fly_double_play:'SF',field_error:'E',
    fielders_choice:'FC',fielders_choice_out:'FC',
    strikeout:'K',strikeout_double_play:'K',
    groundout:'GO',force_out:'GO',double_play:'DP',
    grounded_into_double_play:'DP',triple_play:'TP',
    flyout:'FO',lineout:'FO',pop_out:'FO'
  };
  if(map[type]) return map[type];
  if(/strikes? out|struck out|called out on strikes/i.test(raw)) return 'K';
  if(/grounds? out|groundout|force out/i.test(raw)) return 'GO';
  if(/flies? out|flyout|pops? out|pop out|lines? out|lineout/i.test(raw)) return 'FO';
  if(/double play/i.test(raw)) return 'DP';
  if(/triple play/i.test(raw)) return 'TP';
  return 'OUT';
}
function mlbPaPosition(description=''){
  const raw=clean(description);
  const tests=[
    ['投',/\bpitcher\b/i],
    ['捕',/\bcatcher\b/i],
    ['一',/\bfirst baseman\b/i],
    ['二',/\bsecond baseman\b/i],
    ['三',/\bthird baseman\b/i],
    ['游',/\bshortstop\b/i],
    ['左',/\bleft fielder\b/i],
    ['中',/\bcenter fielder\b/i],
    ['右',/\bright fielder\b/i]
  ];
  let best='',bestIndex=Infinity;
  for(const [pos,re] of tests){
    const m=re.exec(raw);
    if(m && m.index<bestIndex){best=pos;bestIndex=m.index}
  }
  return best;
}
function mlbPaAction(eventType,description=''){
  const code=mlbPaCode(eventType,description);
  const pos=mlbPaPosition(description);
  const raw=clean(description);
  if(code==='1B') return '一安';
  if(code==='2B') return '二安';
  if(code==='3B') return '三安';
  if(code==='HR') return '全壘打';
  if(code==='BB') return '四壞';
  if(code==='IBB') return '故意四壞';
  if(code==='HBP') return '死球';
  if(code==='CI') return '礙打';
  if(code==='SH') return '犧短';
  if(code==='SF') return '犧飛';
  if(code==='E') return '失誤';
  if(code==='FC') return '野選';
  if(code==='K') return '三振';
  if(code==='DP') return '雙殺';
  if(code==='TP') return '三殺';
  if(code==='GO') return pos ? pos+'滾' : '滾地出局';
  if(code==='FO'){
    if(/lines? out|lineout/i.test(raw)) return pos ? pos+'直' : '平飛出局';
    return pos ? pos+'飛' : '飛球出局';
  }
  return '出局';
}
async function mlbDaily(provider,id,date){
  const y=dateParts(date).year;
  const profile=await mlbProfile(provider,id);
  let sports=provider==='MLB'?[1]:MILB_SPORT_IDS;
  if(provider==='MILB' && profile.sportId && profile.sportId!==1){
    sports=[profile.sportId,...MILB_SPORT_IDS.filter(x=>x!==profile.sportId)];
  }

  const [hl,pl,fl]=await Promise.all([
    mlbSplits(id,'hitting','gameLog',y,sports).catch(()=>[]),
    mlbSplits(id,'pitching','gameLog',y,sports).catch(()=>[]),
    mlbSplits(id,'fielding','gameLog',y,sports).catch(()=>[])
  ]);
  const same=x=>String(x?.date||x?.game?.gameDate||'').slice(0,10)===date;
  const hs=hl.find(same), ps=pl.find(same), fs=fl.filter(same);
  if(!hs&&!ps) return {found:false,provider,date,profile};

  const gamePk=hs?.game?.gamePk||ps?.game?.gamePk||null;
  const errors=fs.reduce((sum,x)=>sum+num(x?.stat?.errors),0);
  let plateAppearances=[];
  let opponent=hs?.opponent?.name||ps?.opponent?.name||'';

  if(gamePk){
    try{
      const feed=await getJson('https://statsapi.mlb.com/api/v1.1/game/'+gamePk+'/feed/live',60000);
      plateAppearances=(feed.liveData?.plays?.allPlays||[])
        .filter(x=>String(x?.matchup?.batter?.id||'')===String(id))
        .map(x=>{
          const description=x?.result?.description||x?.result?.event||'';
          return {
            code:mlbPaCode(x?.result?.eventType,description),
            position:mlbPaPosition(description),
            rbi:num(x?.result?.rbi),
            officialAction:mlbPaAction(x?.result?.eventType,description)
          };
        });
    }catch{}
  }

  const sportId=Number(hs?.sport?.id||ps?.sport?.id||fs?.[0]?.sport?.id||0)||0;
  const team=hs?.team?.name||ps?.team?.name||'';
  return {
    found:true,provider,date,profile,gamePk,opponent,sportId,team,
    leagueLevel:usLevelLabel(sportId || (provider==='MLB'?1:profile?.sportId)),
    hitter:hs?Object.assign(mlbHitter(hs.stat,errors),{plateAppearances}):null,
    pitcher:ps?mlbPitcher(ps.stat):null
  };
}


function usLevelLabel(sportId){
  const id=Number(sportId)||0;
  const map={
    1:'MLB',
    11:'AAA',
    12:'AA',
    13:'High-A',
    14:'A',
    15:'Short-A',
    16:'Rookie',
    21:'MiLB'
  };
  return map[id] || (id ? 'MiLB' : '');
}
function usLevelRank(level){
  const map={'MLB':700,'AAA':600,'AA':500,'High-A':400,'A':300,'Short-A':200,'Rookie':100,'MiLB':50};
  return map[String(level||'')]||0;
}
async function usSearch(query,y){
  const [major,minor]=await Promise.all([
    mlbSearch('MLB',query,y).catch(()=>[]),
    mlbSearch('MILB',query,y).catch(()=>[])
  ]);
  const out=[],seen=new Set();
  for(const item of [...major,...minor]){
    const id=String(item?.id||'');
    if(!id||seen.has(id)) continue;
    seen.add(id);
    out.push({...item,provider:'US'});
  }
  return out.slice(0,12);
}
async function usProfile(id){
  const profile=await mlbProfile('MILB',id);
  profile.provider='US';
  profile.currentLevel=usLevelLabel(profile.sportId);
  profile.currentOrganization=profile.organization || (profile.sportId===1 ? profile.team : '');
  return profile;
}
async function usCareerSplits(id,group,sportId){
  const sid=Number(sportId)||0;
  if(!sid) return [];
  const hydrate='stats('
    +'group=['+group+'],'
    +'type=[yearByYear],'
    +'sportId='+String(sid)+','
    +'gameType=[R]'
    +')';
  try{
    const data=await getJson(
      MLB_BASE+'/people/'+encodeURIComponent(id)+'?hydrate='+encodeURIComponent(hydrate),
      180000
    );
    const person=data.people?.[0];
    const splits=(person?.stats||[]).flatMap(block=>Array.isArray(block?.splits)?block.splits:[]);
    if(splits.length) return splits.map(split=>({...split,__sportId:sid}));
  }catch{}

  try{
    const qs=new URLSearchParams({
      stats:'yearByYear',
      group,
      gameType:'R',
      sportIds:String(sid),
      hydrate:'team(league),sport'
    });
    const data=await getJson(
      MLB_BASE+'/people/'+encodeURIComponent(id)+'/stats?'+qs.toString(),
      180000
    );
    return (data.stats||[])
      .flatMap(block=>Array.isArray(block?.splits)?block.splits:[])
      .map(split=>({...split,__sportId:sid}));
  }catch{
    return [];
  }
}
function usCareerSplitKey(split){
  const year=Number(split?.season||String(split?.date||'').slice(0,4))||0;
  const sportId=Number(split?.sport?.id||split?.__sportId||0)||0;
  const teamId=String(split?.team?.id||'');
  const teamName=clean(split?.team?.name||'');
  return [year,sportId,teamId||teamName||'unknown'].join('|');
}
async function usCareerGroupSplits(id,group){
  const fetchRows=async(params)=>{
    const qs=new URLSearchParams({
      stats:'yearByYear',
      group,
      gameType:'R',
      hydrate:'team(league),sport',
      language:'en',
      ...params
    });
    const data=await getJson(
      MLB_BASE+'/people/'+encodeURIComponent(id)+'/stats?'+qs.toString(),
      180000
    );
    return (data.stats||[]).flatMap(block=>Array.isArray(block?.splits)?block.splits:[]);
  };

  const [major,minor]=await Promise.all([
    fetchRows({sportId:'1'}).catch(()=>[]),
    fetchRows({leagueListId:'milb_all'}).catch(()=>[])
  ]);
  const direct=[...major,...minor];
  if(direct.length && direct.some(split=>split?.team?.id||split?.team?.name)){
    return direct;
  }

  const profile=await usProfile(id).catch(()=>({}));
  const sports=[...new Set([
    Number(profile?.sportId)||0,
    ...US_SPORT_IDS
  ].filter(Boolean))];
  const groups=await Promise.all(sports.map(sid=>usCareerSplits(id,group,sid)));
  return groups.flat();
}
async function usCareer(id){
  const profile=await usProfile(id);
  const [h,p,f]=await Promise.all([
    usCareerGroupSplits(id,'hitting'),
    usCareerGroupSplits(id,'pitching'),
    usCareerGroupSplits(id,'fielding')
  ]);
  const entries=new Map();

  const ensureEntry=split=>{
    const key=usCareerSplitKey(split);
    const year=Number(split?.season||String(split?.date||'').slice(0,4))||0;
    const sportId=Number(split?.sport?.id||split?.__sportId||0)||0;
    const teamId=String(split?.team?.id||'');
    const teamName=clean(split?.team?.name||'');
    if(!year || !sportId) return null;
    if(!entries.has(key)){
      entries.set(key,{
        key,
        year,
        sportId,
        level:usLevelLabel(sportId),
        teamId,
        teamName,
        organizationName:clean(split?.team?.parentOrgName || (sportId===1 ? teamName : '')),
        leagueId:String(split?.league?.id||split?.team?.league?.id||''),
        leagueName:clean(split?.league?.name||split?.team?.league?.name||''),
        hitter:null,
        pitcher:null,
        errors:0
      });
    }
    return entries.get(key);
  };

  for(const split of h){
    const entry=ensureEntry(split);
    if(!entry) continue;
    entry.hitter=mlbHitter(split?.stat,entry.errors);
  }
  for(const split of p){
    const entry=ensureEntry(split);
    if(!entry) continue;
    entry.pitcher=mlbPitcher(split?.stat);
  }
  for(const split of f){
    const entry=ensureEntry(split);
    if(!entry) continue;
    entry.errors+=num(split?.stat?.errors);
  }
  for(const entry of entries.values()){
    if(entry.hitter) entry.hitter.errors=entry.errors;
  }

  const rows=[...entries.values()]
    .filter(entry=>entry.hitter||entry.pitcher)
    .sort((a,b)=>
      b.year-a.year
      || usLevelRank(b.level)-usLevelRank(a.level)
      || String(a.teamName||'').localeCompare(String(b.teamName||''))
    );

  const years=[...new Set(rows.map(entry=>entry.year))].sort((a,b)=>b-a);
  return {
    provider:'US',
    profile,
    current:{
      team:profile.team||'',
      organization:profile.currentOrganization||profile.organization||'',
      sportId:Number(profile.sportId)||0,
      level:profile.currentLevel||usLevelLabel(profile.sportId)
    },
    years,
    entries:rows
  };
}
async function usSeason(id,y){
  const career=await usCareer(id);
  const year=Number(y)||new Date().getFullYear();
  const entry=career.entries.find(row=>row.year===year)
    || career.entries[0]
    || null;
  return {
    provider:'US',
    year,
    profile:{...career.profile,years:career.years},
    hitter:entry?.hitter||null,
    pitcher:entry?.pitcher||null,
    careerEntry:entry
  };
}
async function usDaily(id,date){
  const [major,minor]=await Promise.all([
    mlbDaily('MLB',id,date).catch(()=>null),
    mlbDaily('MILB',id,date).catch(()=>null)
  ]);
  const daily=major?.found ? major : (minor?.found ? minor : null);
  const profile=await usProfile(id).catch(()=>major?.profile||minor?.profile||null);
  if(!daily){
    return {found:false,provider:'US',date,profile};
  }
  const sportId=Number(
    daily?.sportId
    || (major?.found?1:0)
    || daily?.profile?.sportId
  )||0;
  return {
    ...daily,
    provider:'US',
    profile,
    sportId,
    leagueLevel:usLevelLabel(sportId || (major?.found?1:daily?.profile?.sportId))
  };
}

/* ---------- NPB ---------- */
const NPB_ENG_BASE=NPB_BASE+'/bis/eng';
const NPB_ENG_TEAMS=[
  'Hanshin Tigers','YOKOHAMA DeNA BAYSTARS','Yomiuri Giants','Chunichi Dragons',
  'Hiroshima Toyo Carp','Tokyo Yakult Swallows','Fukuoka SoftBank Hawks',
  'Hokkaido Nippon-Ham Fighters','ORIX Buffaloes','Tohoku Rakuten Golden Eagles',
  'Saitama Seibu Lions','Chiba Lotte Marines'
];
const NPB_SCORE_CODES={
  'Hanshin Tigers':'t',
  'YOKOHAMA DeNA BAYSTARS':'db',
  'Yomiuri Giants':'g',
  'Chunichi Dragons':'d',
  'Hiroshima Toyo Carp':'c',
  'Tokyo Yakult Swallows':'s',
  'Fukuoka SoftBank Hawks':'h',
  'Hokkaido Nippon-Ham Fighters':'f',
  'ORIX Buffaloes':'b',
  'Tohoku Rakuten Golden Eagles':'e',
  'Saitama Seibu Lions':'l',
  'Chiba Lotte Marines':'m'
};
const NPB_JP_TEAM_NAMES={
  'Hanshin Tigers':'阪神タイガース',
  'YOKOHAMA DeNA BAYSTARS':'横浜DeNAベイスターズ',
  'Yomiuri Giants':'読売ジャイアンツ',
  'Chunichi Dragons':'中日ドラゴンズ',
  'Hiroshima Toyo Carp':'広島東洋カープ',
  'Tokyo Yakult Swallows':'東京ヤクルトスワローズ',
  'Fukuoka SoftBank Hawks':'福岡ソフトバンクホークス',
  'Hokkaido Nippon-Ham Fighters':'北海道日本ハムファイターズ',
  'ORIX Buffaloes':'オリックス・バファローズ',
  'Tohoku Rakuten Golden Eagles':'東北楽天ゴールデンイーグルス',
  'Saitama Seibu Lions':'埼玉西武ライオンズ',
  'Chiba Lotte Marines':'千葉ロッテマリーンズ'
};

function personTokens(value){
  return clean(value)
    .replace(/[,.()]/g,' ')
    .split(/\s+/)
    .map(x=>norm(x))
    .filter(Boolean)
    .sort()
    .join('|');
}
function npbNameMatches(variants,official){
  const key=personTokens(official);
  const compact=norm(official);
  return variants.some(v=>{
    const a=personTokens(v),b=norm(v);
    return (a&&key&&a===key) || (b&&compact&&(b===compact||b.includes(compact)||compact.includes(b)));
  });
}
function npbSearchLetters(variants){
  const letters=new Set();
  for(const raw of variants){
    const words=clean(raw).replace(/[,().]/g,' ').split(/\s+/).filter(Boolean);
    for(const word of [words[0],words[words.length-1]]){
      const c=String(word||'').charAt(0).toLowerCase();
      if(/[a-z]/.test(c))letters.add(c);
    }
  }
  return [...letters].slice(0,6);
}
function parseNpbEnglishRosterLink(label){
  let value=clean(label).replace(/\(\*\)/g,'');
  const number=(value.match(/^(\d{1,3})\b/)||[])[1]||'';
  value=value.replace(/^\d{1,3}\s*/,'');
  const position=(value.match(/^(Pitcher|Catcher|Infielder|Outfielder)\b/i)||[])[1]||'';
  if(position)value=value.replace(new RegExp('^'+position+'\\s*','i'),'');
  const team=NPB_ENG_TEAMS.find(t=>value.endsWith(t))||NPB_ENG_TEAMS.find(t=>value.includes(t))||'';
  let name=value;
  if(team)name=clean(value.slice(0,value.lastIndexOf(team)));
  return {number,position,team,name};
}
async function npbSearch(query){
  const groups=await resolveNameGroups(query);
  const variants=[...new Set(groups.flatMap(g=>g.variants||[]))].filter(Boolean).slice(0,20);
  const letters=npbSearchLetters(variants);
  const out=[],seen=new Set();

  for(const letter of letters){
    let html='';
    try{
      html=await getText(NPB_ENG_BASE+'/players/active/index_'+letter+'.html',180000);
    }catch{continue}

    const re=/<a\b[^>]*href=["']\/bis\/eng\/players\/(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while((m=re.exec(html))){
      const id=m[1];
      if(!id||seen.has(id))continue;
      const parsed=parseNpbEnglishRosterLink(strip(m[2]));
      if(!parsed.name||!npbNameMatches(variants,parsed.name))continue;
      seen.add(id);
      out.push({
        provider:'NPB',
        id,
        name:parsed.name,
        zhName:chineseNameFor(groups,parsed.name)||(/[\u3400-\u9fff]/.test(query)?query:''),
        number:parsed.number,
        team:parsed.team,
        position:parsed.position,
        type:playerType(parsed.position)
      });
      if(out.length>=12)break;
    }
    if(out.length>=12)break;
  }
  return out;
}
function npbEnglishProfileTop(html,id){
  const title=strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
  let name=clean(title.split('（')[0].split('|')[0]);
  const plain=strip(html.slice(0,26000));
  const team=NPB_ENG_TEAMS.find(t=>title.includes(t))||'';
  const position=(plain.match(/Position\s+(Pitcher|Catcher|Infielder|Outfielder)/i)||[])[1]||'';
  let number='';
  if(team){
    const safe=team.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
    number=(plain.match(new RegExp('(?:^|\\s)(\\d{1,3})\\s+'+safe))||[])[1]||'';
  }
  if(!number)number=(plain.match(/(?:^|\s)(\d{1,3})(?:\s|$)/)||[])[1]||'';
  return {provider:'NPB',id,name,number,team,position,type:playerType(position)};
}
function npbYears(html){
  const s=new Set();
  for(const r of rows(html)){
    const y=Number(String(r.cells[0]||'').trim());
    if(Number.isInteger(y)&&y>=1936&&y<=2100)s.add(y);
  }
  return [...s].sort((a,b)=>b-a);
}
function npbFlattenInningTables(html){
  return String(html||'').replace(
    /<table\b[^>]*class=["'][^"']*table_inning[^"']*["'][^>]*>[\s\S]*?<\/table>/gi,
    block=>strip(block).replace(/\s+/g,'')
  );
}
function npbNormalizeSplitIpRow(cells,hm){
  const ipIndex = hm.get(norm('IP')) ?? hm.get(norm('投球回'));
  if(ipIndex===undefined || ipIndex<0 || ipIndex>=cells.length) return cells;
  const out=[...cells];
  let whole=clean(out[ipIndex]||'');
  const fraction=clean(out[ipIndex+1]||'');

  // Same-cell form: "30 .2" -> "30.2"
  whole=whole.replace(/\s*\.\s*/g,'.');
  out[ipIndex]=whole;

  // Split-cell form: ["30", ".2"] or ["30", "2/3"] -> one IP cell.
  if(/^\d+$/.test(whole) && /^\.[12]$/.test(fraction)){
    out[ipIndex]=whole+fraction;
    out.splice(ipIndex+1,1);
  }else if(/^\d+$/.test(whole) && /^[12]\/3$/.test(fraction)){
    out[ipIndex]=whole+' '+fraction;
    out.splice(ipIndex+1,1);
  }
  return out;
}
function npbEnglishSeasonStats(html,y){
  let hitter=null,pitcher=null;
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2)continue;
    const hm=headerMap(rs[0].cells);
    const r=rs.find(x=>String(x.cells[0]||'').trim()===String(y));
    if(!r)continue;
    const hdr=rs[0].cells.join('|');

    if(/\bPA\b/.test(hdr)&&/\bAB\b/.test(hdr)&&/\bAVG\b/.test(hdr)){
      const h=num(pick(r.cells,hm,'H'));
      const d=num(pick(r.cells,hm,'2B'));
      const t=num(pick(r.cells,hm,'3B'));
      const hr=num(pick(r.cells,hm,'HR'));
      hitter={
        pa:num(pick(r.cells,hm,'PA')),ab:num(pick(r.cells,hm,'AB')),
        runs:num(pick(r.cells,hm,'R')),hits:h,
        single:singles(h,d,t,hr),double:d,triple:t,hr,
        rbi:num(pick(r.cells,hm,'RBI')),bb:num(pick(r.cells,hm,'BB')),
        ibb:0,hbp:num(pick(r.cells,hm,'HP')),sacBunt:num(pick(r.cells,hm,'SH')),
        sacFly:num(pick(r.cells,hm,'SF')),k:num(pick(r.cells,hm,'SO')),
        avg:num(pick(r.cells,hm,'AVG')),obp:num(pick(r.cells,hm,'OBP')),
        slg:num(pick(r.cells,hm,'SLG')),errors:0
      };
    }else if(/\bERA\b/.test(hdr)&&/\bIP\b/.test(hdr)&&/\bBF\b/.test(hdr)){
      // NPB 的 30.2 局有時會拆成「30」「.2」兩個 td；先合併再依 header 取值，
      // 否則 .2 會被誤當成 H，之後所有欄位整排右移。
      const pitchingCells=npbNormalizeSplitIpRow(r.cells,hm);
      const ip=pick(pitchingCells,hm,'IP');
      const outs=ipToOuts(ip),h=num(pick(pitchingCells,hm,'H'));
      const bb=num(pick(pitchingCells,hm,'BB')),er=num(pick(pitchingCells,hm,'ER'));
      pitcher={
        outs,innings:outsToIp(outs),h,bb,hbp:num(pick(pitchingCells,hm,'HB')),
        k:num(pick(pitchingCells,hm,'SO')),r:num(pick(pitchingCells,hm,'R')),er,
        w:num(pick(pitchingCells,hm,'W')),l:num(pick(pitchingCells,hm,'L')),
        sv:num(pick(pitchingCells,hm,'SV')),hld:num(pick(pitchingCells,hm,'HLD')),
        bsv:0,cg:num(pick(pitchingCells,hm,'CG')),sho:num(pick(pitchingCells,hm,'SHO')),
        era:num(pick(pitchingCells,hm,'ERA')),whip:outs?(h+bb)/(outs/3):0
      };
    }
  }
  return {hitter,pitcher};
}
function npbJapaneseSeasonStats(html,y){
  let hitter=null,pitcher=null;
  const normalizedHtml=npbFlattenInningTables(html);
  for(const table of tables(normalizedHtml)){
    const rs=rows(table);
    if(rs.length<2) continue;

    // Header is the first row containing 年度; some NPB tables include decorative rows first.
    const headerIndex=rs.findIndex(row=>row.cells.includes('年度'));
    if(headerIndex<0) continue;
    const head=rs[headerIndex].cells;
    const hm=headerMap(head);
    const row=rs.slice(headerIndex+1).find(x=>String(x.cells[0]||'').trim()===String(y));
    if(!row) continue;

    const joined=head.join('|');

    if(head.includes('登板') && head.includes('投球回') && head.includes('防御率')){
      const cells=npbNormalizeSplitIpRow(row.cells,hm);
      const ip=pick(cells,hm,'投球回');
      const outs=ipToOuts(ip);
      const h=num(pick(cells,hm,'安打'));
      const bb=num(pick(cells,hm,'四球'));
      const er=num(pick(cells,hm,'自責点'));
      pitcher={
        outs,innings:outsToIp(outs),
        h,bb,hbp:num(pick(cells,hm,'死球')),
        k:num(pick(cells,hm,'三振')),
        r:num(pick(cells,hm,'失点')),er,
        w:num(pick(cells,hm,'勝利')),
        l:num(pick(cells,hm,'敗北')),
        sv:num(pick(cells,hm,'セーブ')),
        hld:num(pick(cells,hm,'H')),
        bsv:0,
        cg:num(pick(cells,hm,'完投')),
        sho:num(pick(cells,hm,'完封勝')),
        noWalkHbp:num(pick(cells,hm,'無四球')),
        era:num(pick(cells,hm,'防御率')),
        whip:outs?(h+bb)/(outs/3):0
      };
      continue;
    }

    if(head.includes('試合') && head.includes('打席') && head.includes('打率')){
      const h=num(pick(row.cells,hm,'安打'));
      const d=num(pick(row.cells,hm,'二塁打'));
      const t=num(pick(row.cells,hm,'三塁打'));
      const hr=num(pick(row.cells,hm,'本塁打'));
      hitter={
        pa:num(pick(row.cells,hm,'打席')),
        ab:num(pick(row.cells,hm,'打数')),
        runs:num(pick(row.cells,hm,'得点')),
        hits:h,
        single:singles(h,d,t,hr),
        double:d,triple:t,hr,
        rbi:num(pick(row.cells,hm,'打点')),
        bb:num(pick(row.cells,hm,'四球')),
        ibb:0,
        hbp:num(pick(row.cells,hm,'死球')),
        sacBunt:num(pick(row.cells,hm,'犠打')),
        sacFly:num(pick(row.cells,hm,'犠飛')),
        k:num(pick(row.cells,hm,'三振')),
        avg:num(pick(row.cells,hm,'打率')),
        slg:num(pick(row.cells,hm,'長打率')),
        obp:num(pick(row.cells,hm,'出塁率')),
        errors:0
      };
    }
  }
  return {hitter,pitcher};
}
function npbJapaneseProfileTop(html,id){
  const plain=strip(html.slice(0,22000));
  const title=strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
  let name=clean(title.split('（')[0].split('|')[0]);
  if(!name){
    const m=plain.match(/\b\d{1,3}\s+[^\n|]+/);
    if(m)name=clean(m[0].replace(/^\d{1,3}\s+/,''));
  }
  const number=(plain.match(/(?:^|\s)(\d{1,3})(?:\s|$)/)||[])[1]||'';
  const team=Object.values(NPB_JP_TEAM_NAMES).find(t=>title.includes(t))||'';
  const position=(plain.match(/ポジション\s*(投手|捕手|内野手|外野手)/)||[])[1]||'';
  return {id,name,number,team,position,type:playerType(position)};
}
async function npbProfile(id){
  const engHtml=await getText(NPB_ENG_BASE+'/players/'+encodeURIComponent(id)+'.html',180000);
  const profile=Object.assign(npbEnglishProfileTop(engHtml,id),{years:npbYears(engHtml)});
  try{
    const jpHtml=await getText(NPB_BASE+'/bis/players/'+encodeURIComponent(id)+'.html',180000);
    const jp=npbJapaneseProfileTop(jpHtml,id);
    if(jp.name && /[\u3400-\u9fff]/.test(jp.name))profile.zhName=jp.name.replace(/\s+/g,'');
    if(jp.number)profile.number=jp.number;
    profile.jpTeam=jp.team||'';
    if(jp.team){
      const mappedEnglishTeam=Object.entries(NPB_JP_TEAM_NAMES)
        .find(([,jpName])=>jpName===jp.team)?.[0]||'';
      if(mappedEnglishTeam)profile.team=mappedEnglishTeam;
    }
    profile.jpPosition=jp.position||'';
    // 日文官網守位與年度資料比英文頁面更即時。
    // 2026 新球員／當季資料必須從這裡補入 years，否則前端可能一直停在 2025。
    const jpYears=npbYears(jpHtml);
    if(jpYears.length) profile.years=jpYears;
    if(jp.position){
      profile.position=jp.position;
      profile.type=playerType(jp.position);
    }
  }catch(e){
    console.warn('NPB Japanese profile fallback failed',e);
  }
  return profile;
}
async function npbSeason(id,y){
  const profile=await npbProfile(id);

  // 2026 onward the Japanese official player page is the canonical season source.
  // It exposes stable Japanese headers and correctly includes current-season rows.
  let jpHtml='';
  try{
    jpHtml=await getText(NPB_BASE+'/bis/players/'+encodeURIComponent(id)+'.html',60000);
  }catch(e){
    console.warn('NPB Japanese season page failed',e);
  }

  if(jpHtml){
    const parsed=npbJapaneseSeasonStats(jpHtml,y);
    if(parsed.pitcher || parsed.hitter){
      return {provider:'NPB',year:y,profile,...parsed,sourceMode:'jp-player-season'};
    }
  }

  // Fallback for historical/temporary Japanese-page failures.
  const engHtml=await getText(NPB_ENG_BASE+'/players/'+encodeURIComponent(id)+'.html',120000);
  return {
    provider:'NPB',year:y,profile,
    ...npbEnglishSeasonStats(engHtml,y),
    sourceMode:'eng-player-season'
  };
}

function npbFarmTeamSeasonStats(html,profile,type){
  const rs=rows(npbFlattenInningTables(html));
  if(!rs.length) return null;

  const headerRow=rs.find(row=>{
    const joined=row.cells.join('|');
    if(type==='hitter') return /\bPA\b/.test(joined)&&/\bAB\b/.test(joined)&&/\bRBI\b/.test(joined);
    return /\bIP\b/.test(joined)&&/\bERA\b/.test(joined)&&/\bCG\b/.test(joined);
  });
  if(!headerRow) return null;

  const hm=headerMap(headerRow.cells);

  for(const row of rs){
    // Farm tables may have a leading "*" / handedness marker before the player name.
    const nameCell=(row.cells||[]).slice(0,3).find(cell=>npbEnglishRowMatchesPlayer(profile,cell));
    if(!nameCell) continue;

    if(type==='hitter'){
      const h=num(pick(row.cells,hm,'H'));
      const d=num(pick(row.cells,hm,'2B'));
      const t=num(pick(row.cells,hm,'3B'));
      const hr=num(pick(row.cells,hm,'HR'));
      return {
        pa:num(pick(row.cells,hm,'PA')),ab:num(pick(row.cells,hm,'AB')),
        runs:num(pick(row.cells,hm,'R')),hits:h,
        single:singles(h,d,t,hr),double:d,triple:t,hr,
        rbi:num(pick(row.cells,hm,'RBI')),
        bb:num(pick(row.cells,hm,'BB')),ibb:num(pick(row.cells,hm,'IBB')),
        hbp:num(pick(row.cells,hm,'HP')),
        sacBunt:num(pick(row.cells,hm,'SH')),sacFly:num(pick(row.cells,hm,'SF')),
        k:num(pick(row.cells,hm,'SO')),
        avg:num(pick(row.cells,hm,'AVG')),slg:num(pick(row.cells,hm,'SLG')),obp:num(pick(row.cells,hm,'OBP')),
        errors:0
      };
    }

    const pitchingCells=npbNormalizeSplitIpRow(row.cells,hm);
    const ip=pick(pitchingCells,hm,'IP');
    const outs=ipToOuts(ip),h=num(pick(pitchingCells,hm,'H')),bb=num(pick(pitchingCells,hm,'BB')),er=num(pick(pitchingCells,hm,'ER'));
    return {
      outs,innings:outsToIp(outs),h,bb,hbp:num(pick(pitchingCells,hm,'HB')),
      k:num(pick(pitchingCells,hm,'SO')),r:num(pick(pitchingCells,hm,'R')),er,
      w:num(pick(pitchingCells,hm,'W')),l:num(pick(pitchingCells,hm,'L')),
      sv:num(pick(pitchingCells,hm,'SV')),hld:0,bsv:0,
      cg:num(pick(pitchingCells,hm,'CG')),sho:num(pick(pitchingCells,hm,'SHO')),
      era:num(pick(pitchingCells,hm,'ERA')),
      whip:outs?(h+bb)/(outs/3):0
    };
  }
  return null;
}
function npbFarmTeamCodeVariants(profile,y){
  const code=String(NPB_SCORE_CODES[profile?.team]||'').toLowerCase();
  if(!code) return [];
  // ORIX used "Bs" in older English farm-stat URLs.
  if(code==='b' && Number(y)<=2018) return ['bs','b'];
  return [code];
}

async function npbFarmSeasonWithProfile(profile,y){
  const codes=npbFarmTeamCodeVariants(profile,y);
  if(!codes.length) return {provider:'NPB',year:y,level:'D',profile,hitter:null,pitcher:null,sourceMode:'eng-farm-season'};
  for(const code of codes){
    const [bh,ph]=await Promise.all([
      getText(NPB_ENG_BASE+'/'+y+'/stats/idb2_'+code+'.html',120000).catch(()=>''),
      getText(NPB_ENG_BASE+'/'+y+'/stats/idp2_'+code+'.html',120000).catch(()=>'')
    ]);
    const hitter=bh?npbFarmTeamSeasonStats(bh,profile,'hitter'):null;
    const pitcher=ph?npbFarmTeamSeasonStats(ph,profile,'pitcher'):null;
    if(hitter || pitcher){
      return {provider:'NPB',year:y,level:'D',profile,hitter,pitcher,sourceMode:'eng-farm-season'};
    }
  }
  return {provider:'NPB',year:y,level:'D',profile,hitter:null,pitcher:null,sourceMode:'eng-farm-season'};
}
async function npbFarmSeason(id,y){
  const profile=await npbProfile(id);
  return await npbFarmSeasonWithProfile(profile,y);
}
async function npbFarmYears(id){
  const profile=await npbProfile(id);
  const majorYears=(Array.isArray(profile?.years)?profile.years:[])
    .map(Number).filter(y=>Number.isInteger(y)&&y>=1990&&y<=2100);
  const now=new Date().getFullYear();
  const earliestMajor=majorYears.length?Math.min(...majorYears):now;
  const start=Math.max(1990,earliestMajor-3);
  const candidates=[];
  for(let y=now;y>=start;y--) candidates.push(y);

  const years=[];
  // Small batches avoid hammering NPB while still keeping the first farm-history lookup responsive.
  for(let i=0;i<candidates.length;i+=3){
    const batch=candidates.slice(i,i+3);
    const results=await Promise.all(batch.map(async y=>{
      try{return await npbFarmSeasonWithProfile(profile,y)}
      catch(e){console.warn('NPB farm history year failed',y,e);return null}
    }));
    for(let j=0;j<results.length;j++){
      const season=results[j];
      if(season?.hitter || season?.pitcher) years.push(batch[j]);
    }
  }
  return {provider:'NPB',level:'D',profile,years:[...new Set(years)].sort((a,b)=>b-a)};
}

function npbJapanesePa(textValue){
  const raw=clean(textValue),s=raw.replace(/\s/g,'');
  let code='OUT';
  if(/本/.test(s))code='HR';
  else if(/３|3|三塁打/.test(s)&&/安|３|3/.test(s))code='3B';
  else if(/２|2|二塁打/.test(s)&&!/併/.test(s))code='2B';
  else if(/安/.test(s))code='1B';
  else if(/敬遠/.test(s))code='IBB';
  else if(/四球/.test(s))code='BB';
  else if(/死球/.test(s))code='HBP';
  else if(/犠打/.test(s))code='SH';
  else if(/犠飛/.test(s))code='SF';
  else if(/併打/.test(s))code='DP';
  else if(/三振/.test(s))code='K';
  else if(/失|エラー/.test(s))code='E';
  else if(/選/.test(s))code='FC';
  else if(/ゴロ/.test(s))code='GO';
  else if(/飛|直/.test(s))code='FO';
  const rbiMap={'①':1,'②':2,'③':3,'④':4};
  const mark=(s.match(/[①②③④]/)||[])[0]||'';
  const position=(s.match(/^(投|捕|一|二|三|遊|左|中|右)/)||[])[1]||'';
  return {code,position,rbi:rbiMap[mark]||0,officialAction:raw};
}
async function npbModernScoreBoxPaths(date,teamCode=''){
  const d=dateParts(date);
  const scheduleUrl=NPB_BASE+'/games/'+d.year+'/schedule_'+d.mm+'.html';
  let html='';
  try{
    html=await getText(scheduleUrl,60000);
  }catch(e){
    console.warn('NPB schedule lookup failed',e);
    return [];
  }
  const escaped='\\/scores\\/'+d.year+'\\/'+d.mmdd+'\\/([a-z0-9]+-[a-z0-9]+-\\d+)\\/?';
  const re=new RegExp(escaped,'gi');
  const code=clean(teamCode).toLowerCase();
  const paths=[...new Set([...html.matchAll(re)]
    .filter(m=>!code || String(m[1]||'').toLowerCase().split('-').includes(code))
    .map(m=>'/scores/'+d.year+'/'+d.mmdd+'/'+m[1]+'/box.html'))];
  return paths;
}
function npbPitcherCompleteFlags(html,id,runs=0){
  const playerRe=new RegExp('/bis/(?:eng/)?players/'+String(id)+'\\.html','i');
  const pitcherTable=tables(String(html||'')).find(table=>{
    const plain=strip(table);
    return playerRe.test(table) && /投球数/.test(plain) && /投球回/.test(plain);
  });
  if(!pitcherTable)return {cg:0,sho:0};
  const used=rows(pitcherTable).filter(row=>/\/bis\/(?:eng\/)?players\/\d+\.html/i.test(row.html));
  const cg=used.length===1?1:0;
  return {cg,sho:cg && Number(runs||0)===0?1:0};
}
function npbDirectJapaneseDaily(html,id,date,profile){
  if(!new RegExp('/bis/(?:eng/)?players/'+id+'\\.html','i').test(html))return null;
  const title=strip(html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'');
  const vs=title.match(/(.+?)\s+vs\s+(.+?)(?:\s+\d+回戦|$)/i);
  let opponent='';
  if(vs){
    const stripGameLabel=value=>clean(value)
      .replace(/^【[^】]*】\s*/,'')
      .replace(/^\[[^\]]*\]\s*/,'')
      .replace(/^［[^］]*］\s*/,'')
      .replace(/^.*?〗\s*/,'');
    const a=stripGameLabel(vs[1]);
    const b=stripGameLabel(vs[2]);
    const jpTeam=clean(profile?.jpTeam||NPB_JP_TEAM_NAMES[profile?.team]||'');
    if(jpTeam){
      if(a.includes(jpTeam)||jpTeam.includes(a)) opponent=b;
      else if(b.includes(jpTeam)||jpTeam.includes(b)) opponent=a;
      else opponent=a;
    }else{
      opponent=a;
    }
    opponent=stripGameLabel(opponent);
  }
  const normalizedBoxHtml=String(html||'').replace(
    /<table\b[^>]*class=["'][^"']*table_inning[^"']*["'][^>]*>[\s\S]*?<\/table>/gi,
    block=>strip(block).replace(/\s+/g,'')
  );
  const rs=rows(normalizedBoxHtml);
  let hitter=null,pitcher=null;

  // Modern Japanese NPB box tables (first team and Farm) have a stable column order.
  // IMPORTANT: decide whether the matched player row belongs to the batting or
  // pitching table from the nearby table header, not from the player's normal
  // registered position. A position player can pitch (and a pitcher can bat).
  // Using profile.type here previously interpreted a pitching row as batting:
  // e.g. Shintoh's 0.1 IP on 2026-09-08 became R=0.1 plus several fake OUT PAs.
  for(let i=0;i<rs.length;i++){
    const r=rs[i];
    if(!new RegExp('/bis/(?:eng/)?players/'+id+'\\.html','i').test(r.html))continue;
    const c=r.cells||[];

    let nearbyHead=[];
    for(let j=i-1;j>=0&&j>=i-8;j--){
      if(rs[j].cells.includes('選手')||rs[j].cells.includes('投手')){
        nearbyHead=rs[j].cells;
        break;
      }
    }
    const rowKind=nearbyHead.includes('投手')
      ? 'pitcher'
      : nearbyHead.includes('選手')
        ? 'hitter'
        : '';

    if(rowKind==='hitter' && c.length>=8){
      const ab=num(c[3]),runs=num(c[4]),hits=num(c[5]),rbi=num(c[6]);
      if(Number.isFinite(ab)&&Number.isFinite(hits)){
        const pa=c.slice(8)
          .filter(x=>x&&x!=='-'&&x!=='－')
          .map(npbJapanesePa);
        const cc={single:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sacBunt:0,sacFly:0,k:0};
        for(const x of pa){
          if(x.code==='1B')cc.single++;
          if(x.code==='2B')cc.double++;
          if(x.code==='3B')cc.triple++;
          if(x.code==='HR')cc.hr++;
          if(x.code==='BB')cc.bb++;
          if(x.code==='IBB')cc.ibb++;
          if(x.code==='HBP')cc.hbp++;
          if(x.code==='SH')cc.sacBunt++;
          if(x.code==='SF')cc.sacFly++;
          if(x.code==='K')cc.k++;
        }
        hitter={
          pa:pa.length,ab,runs,hits,
          single:Math.max(0,hits-cc.double-cc.triple-cc.hr),
          double:cc.double,triple:cc.triple,hr:cc.hr,rbi,
          bb:cc.bb,ibb:cc.ibb,hbp:cc.hbp,sacBunt:cc.sacBunt,sacFly:cc.sacFly,k:cc.k,
          errors:0,plateAppearances:pa
        };
        continue;
      }
    }

    if(rowKind==='pitcher' && c.length>=14){
      // NPB renders partial innings (e.g. 1 1/3) as two adjacent cells in some
      // Japanese/Farm boxes. Normalize that split before reading later columns.
      const splitFraction=/^\.[12]$/.test(clean(c[5]));
      const shift=splitFraction?1:0;
      const ip=(clean(c[4])+(splitFraction?clean(c[5]):'')).replace(/\s+/g,'');
      const outs=ipToOuts(ip);
      const h=num(c[5+shift]),bb=num(c[7+shift]),hbp=num(c[8+shift]),er=num(c[13+shift]);
      const runs=num(c[12+shift]);
      const complete=npbPitcherCompleteFlags(normalizedBoxHtml,id,runs);
      pitcher={
        outs,innings:outsToIp(outs),pitchCount:num(c[2]),
        h,hrAllowed:num(c[6+shift]),bb,hbp,k:num(c[9+shift]),
        r:runs,er,
        w:/○/.test(c[0]||'')?1:0,l:/●/.test(c[0]||'')?1:0,
        sv:/S/.test(c[0]||'')?1:0,hld:/H/.test(c[0]||'')?1:0,
        bsv:0,cg:complete.cg,sho:complete.sho,
        era:outs?er*9/(outs/3):0,
        whip:outs?(h+bb)/(outs/3):0
      };
      if(outs || h || bb || hbp || pitcher.k || runs || er){
        continue;
      }
      pitcher=null;
    }
  }

  for(let i=0;i<rs.length;i++){
    const r=rs[i];
    if(!new RegExp('/bis/(?:eng/)?players/'+id+'\\.html','i').test(r.html))continue;
    let head=[];
    for(let j=i-1;j>=0&&j>=i-8;j--){
      if(rs[j].cells.includes('選手')||rs[j].cells.includes('投手')){head=rs[j].cells;break}
    }
    if(!head.length)continue;
    const hm=headerMap(head);
    if(head.includes('選手')){
      const ab=num(pick(r.cells,hm,'打数'));
      const runs=num(pick(r.cells,hm,'得点'));
      const hits=num(pick(r.cells,hm,'安打'));
      const rbi=num(pick(r.cells,hm,'打点'));
      const start=Math.max(0,head.findIndex(x=>x==='1'));
      const pa=r.cells.slice(start).filter(x=>x&&x!=='-').map(npbJapanesePa);
      const c={single:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sacBunt:0,sacFly:0,k:0};
      for(const x of pa){
        if(x.code==='1B')c.single++;
        if(x.code==='2B')c.double++;
        if(x.code==='3B')c.triple++;
        if(x.code==='HR')c.hr++;
        if(x.code==='BB')c.bb++;
        if(x.code==='IBB')c.ibb++;
        if(x.code==='HBP')c.hbp++;
        if(x.code==='SH')c.sacBunt++;
        if(x.code==='SF')c.sacFly++;
        if(x.code==='K')c.k++;
      }
      hitter={pa:pa.length,ab,runs,hits,single:c.single,double:c.double,triple:c.triple,hr:c.hr,rbi,bb:c.bb,ibb:c.ibb,hbp:c.hbp,sacBunt:c.sacBunt,sacFly:c.sacFly,k:c.k,errors:0,plateAppearances:pa};
    }else if(head.includes('投手')){
      const pitchingCells=npbNormalizeSplitIpRow(r.cells,hm);
      const ip=pick(pitchingCells,hm,'投球回');
      const outs=ipToOuts(ip),h=num(pick(pitchingCells,hm,'安打'));
      const bb=num(pick(pitchingCells,hm,'四球')),er=num(pick(pitchingCells,hm,'自責点'));
      const runs=num(pick(pitchingCells,hm,'失点'));
      const complete=npbPitcherCompleteFlags(normalizedBoxHtml,id,runs);
      pitcher={outs,innings:outsToIp(outs),pitchCount:num(pick(pitchingCells,hm,'投球数')),h,bb,hbp:num(pick(pitchingCells,hm,'死球')),k:num(pick(pitchingCells,hm,'三振')),r:runs,er,w:/○/.test(pitchingCells[0]||'')?1:0,l:/●/.test(pitchingCells[0]||'')?1:0,sv:/S/.test(pitchingCells[0]||'')?1:0,hld:/H/.test(pitchingCells[0]||'')?1:0,bsv:0,cg:complete.cg,sho:complete.sho,era:outs?er*9/(outs/3):0,whip:outs?(h+bb)/(outs/3):0};
    }
  }
  return hitter||pitcher?{found:true,provider:'NPB',date,profile,opponent,hitter,pitcher}:null;
}
function npbEnglishSurname(name){
  const raw=clean(name);
  if(raw.includes(','))return clean(raw.split(',')[0]);
  const words=raw.split(/\s+/).filter(Boolean);
  return words[words.length-1]||raw;
}
function npbEnglishRowMatchesPlayer(profile,first){
  const raw=clean(first);
  const official=clean(profile?.name||'');
  if(!raw||!official)return false;

  // Season/farm tables normally expose the full "Surname, Given" name.
  // Match the full token set first so players sharing a surname are never mixed.
  const rawTokens=personTokens(raw.replace(/^\*\s*/,''));
  const officialTokens=personTokens(official);
  if(rawTokens && officialTokens && rawTokens===officialTokens)return true;

  // When both sides contain a comma they are full names; a surname-only fallback
  // would create false positives (e.g. a different Itoh).
  if(raw.includes(',') && official.includes(','))return false;

  const rowName=clean(raw.split(',')[0]);
  const surname=npbEnglishSurname(official);
  if(!rowName||!surname)return false;
  const a=norm(rowName),b=norm(surname);
  if(!a||!b)return false;
  if(a===b)return true;
  // Game boxes can abbreviate foreign-player given names, e.g. AK.Lin.
  if(a.endsWith(b) && a.length<=b.length+4)return true;
  const full=norm(official);
  return Boolean(full && (a===full || full.endsWith(a)));
}
function npbEnglishGameMeta(html){
  const plain=strip(html);
  const gameIndex=plain.search(/Game\s+\d+/i);
  const region=gameIndex>=0
    ? plain.slice(Math.max(0,gameIndex-900),Math.min(plain.length,gameIndex+240))
    : plain.slice(0,5000);
  const teams=NPB_ENG_TEAMS.filter(t=>region.includes(t));
  const gameNo=Number((region.match(/Game\s+(\d+)/i)||[])[1]||0);
  const away=teams[0]||'';
  const home=teams[1]||'';
  return {
    gameNo,
    away,
    home,
    opponentFor(team){
      if(team===home)return away;
      if(team===away)return home;
      return teams.find(t=>t!==team)||'';
    }
  };
}
function npbEnglishDailyFromGame(html,date,profile){
  const surname=npbEnglishSurname(profile.name);
  if(!surname)return null;
  const meta=npbEnglishGameMeta(html);
  const opponent=meta.opponentFor(profile.team);
  const rs=rows(html);
  let hitter=null,pitcher=null;
  for(let i=0;i<rs.length;i++){
    const r=rs[i];
    const first=clean(r.cells[0]||'');
    if(!npbEnglishRowMatchesPlayer(profile,first))continue;
    let head=[];
    for(let j=i-1;j>=0&&j>=i-6;j--){
      const joined=rs[j].cells.join('|');
      if(/\bAB\b/.test(joined)&&/\bRBI\b/.test(joined)){head=rs[j].cells;break}
      if(/\bIP\b/.test(joined)&&/\bBF\b/.test(joined)&&/\bER\b/.test(joined)){head=rs[j].cells;break}
    }
    if(!head.length)continue;
    const hm=headerMap(head);
    const joined=head.join('|');
    if(/\bAB\b/.test(joined)&&/\bRBI\b/.test(joined)){
      const ab=num(pick(r.cells,hm,'AB'));
      const hits=num(pick(r.cells,hm,'H'));
      const bb=num(pick(r.cells,hm,'BB'));
      const hbp=num(pick(r.cells,hm,'HP'));
      const k=num(pick(r.cells,hm,'SO'));
      hitter={pa:ab+bb+hbp,ab,runs:0,hits,single:hits,double:0,triple:0,hr:0,rbi:num(pick(r.cells,hm,'RBI')),bb,ibb:0,hbp,sacBunt:0,sacFly:0,k,errors:0,plateAppearances:[]};
    }else if(/\bIP\b/.test(joined)&&/\bBF\b/.test(joined)){
      const ip=pick(r.cells,hm,'IP');
      const outs=ipToOuts(ip),h=num(pick(r.cells,hm,'H'));
      const bb=num(pick(r.cells,hm,'BB')),er=num(pick(r.cells,hm,'ER'));
      pitcher={outs,innings:outsToIp(outs),h,bb,hbp:num(pick(r.cells,hm,'HB')),k:num(pick(r.cells,hm,'SO')),r:er,er,w:/\(W\)/i.test(first)?1:0,l:/\(L\)/i.test(first)?1:0,sv:/\(S\)/i.test(first)?1:0,hld:/\(H\)/i.test(first)?1:0,bsv:0,cg:0,sho:0,era:outs?er*9/(outs/3):0,whip:outs?(h+bb)/(outs/3):0};
    }
  }
  return hitter||pitcher?{found:true,provider:'NPB',date,profile,opponent,hitter,pitcher}:null;
}
async function npbDaily(id,date){
  const d=dateParts(date);
  const profile=await npbProfile(id);

  // Preferred path for modern NPB games:
  // read the official monthly schedule, collect only this date's real score pages,
  // then identify the correct game by the player's official NPB player ID.
  const modernBoxes=await npbModernScoreBoxPaths(date,NPB_SCORE_CODES[profile.team]||'');
  let modernLastError=null;
  for(const boxPath of modernBoxes){
    try{
      const jpHtml=await getText(NPB_BASE+boxPath,60000);
      const parsed=npbDirectJapaneseDaily(jpHtml,id,date,profile);
      if(parsed){
        parsed.sourceMode='jp-box';
        parsed.sourceUrl=NPB_BASE+boxPath;
        return parsed;
      }
    }catch(e){
      modernLastError=e;
    }
  }

  const indexUrl=NPB_ENG_BASE+'/'+d.year+'/games/gm'+d.year+d.mm+d.dd+'.html';
  const index=await getText(indexUrl,60000);
  const re=new RegExp('/bis/eng/'+d.year+'/games/s'+d.year+d.mm+d.dd+'\\d+\\.html','gi');
  const paths=[...new Set([...index.matchAll(re)].map(x=>x[0]))];
  if(!paths.length)return {found:false,provider:'NPB',date,profile,reason:'當日沒有可讀取的 NPB 官方比賽資料。'};

  let lastError=null;
  for(const engPath of paths){
    let engHtml='';
    try{
      engHtml=await getText(NPB_BASE+engPath,60000);
    }catch(e){
      lastError=e;
      continue;
    }

    const meta=npbEnglishGameMeta(engHtml);
    const participates=profile.team && (profile.team===meta.home || profile.team===meta.away);
    if(!participates)continue;

    // NPB's modern score URL is home-away-gameNo. The English page text is not
    // guaranteed to expose the two clubs in home/away order, so try both
    // orientations and use the first box that actually contains this player.
    if(meta.gameNo && NPB_SCORE_CODES[meta.home] && NPB_SCORE_CODES[meta.away]){
      const homeCode=NPB_SCORE_CODES[meta.home];
      const awayCode=NPB_SCORE_CODES[meta.away];
      const scorePaths=[...new Set([
        '/scores/'+d.year+'/'+d.mmdd+'/'+homeCode+'-'+awayCode+'-'+meta.gameNo+'/box.html',
        '/scores/'+d.year+'/'+d.mmdd+'/'+awayCode+'-'+homeCode+'-'+meta.gameNo+'/box.html'
      ])];
      let jpFetchError=null;
      for(const scorePath of scorePaths){
        try{
          const jpHtml=await getText(NPB_BASE+scorePath,60000);
          const parsed=npbDirectJapaneseDaily(jpHtml,id,date,profile);
          if(parsed){
            parsed.opponent=meta.opponentFor(profile.team)||parsed.opponent||'';
            parsed.sourceMode='jp-box';
            parsed.sourceUrl=NPB_BASE+scorePath;
            return parsed;
          }
        }catch(e){
          jpFetchError=e;
        }
      }
      if(jpFetchError)lastError=jpFetchError;
    }

    const fallback=npbEnglishDailyFromGame(engHtml,date,profile);
    if(fallback){
      fallback.opponent=meta.opponentFor(profile.team)||fallback.opponent||'';
      fallback.sourceMode='eng-box';
      return fallback;
    }
  }

  const finalError=lastError||modernLastError;
  return {found:false,provider:'NPB',date,profile,reason:finalError instanceof Error?'找到當日 NPB 比賽，但該球員沒有可解析的出賽資料。':'當天找不到此球員的 NPB 出賽資料。'};
}


function dateIsoFromYmd(year,mmdd){
  const s=String(mmdd||'').padStart(4,'0');
  return String(year)+'-'+s.slice(0,2)+'-'+s.slice(2,4);
}
function monthShift(year,month,offset){
  const d=new Date(Date.UTC(Number(year),Number(month)-1+Number(offset||0),1));
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,mm:String(d.getUTCMonth()+1).padStart(2,'0')};
}
function npbBoxHasPlayer(html,id){
  return new RegExp('/bis/(?:eng/)?players/'+String(id)+'\\.html','i').test(String(html||''));
}
async function npbMonthGameCandidates(year,month,profile){
  const mm=String(month).padStart(2,'0');
  const code=String(NPB_SCORE_CODES[profile?.team]||'').toLowerCase();
  const out=[];
  const sources=[
    {level:'一軍',prefix:'scores',url:NPB_BASE+'/games/'+year+'/schedule_'+mm+'.html'},
    {level:'二軍',prefix:'scores_farm',url:NPB_BASE+'/farm/'+year+'/schedule_'+mm+'_detail.html'}
  ];
  for(const source of sources){
    let html='';
    try{html=await getText(source.url,90000)}catch{continue}
    const re=new RegExp('\\/'+source.prefix+'\\/'+year+'\\/(\\d{4})\\/([a-z0-9]+-[a-z0-9]+-\\d+)\\/?','gi');
    let m;
    while((m=re.exec(html))){
      const slug=clean(m[2]).toLowerCase();
      if(code && !slug.split('-').includes(code)) continue;
      out.push({date:dateIsoFromYmd(year,m[1]),level:source.level,path:'/'+source.prefix+'/'+year+'/'+m[1]+'/'+m[2]+'/box.html'});
    }
  }
  const seen=new Set();
  return out.filter(x=>{
    const key=x.level+'|'+x.path;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
async function npbFarmDaily(id,date,profileInput=null){
  const profile=profileInput||await npbProfile(id);
  const d=dateParts(date);
  const candidates=(await npbMonthGameCandidates(d.year,Number(d.mm),profile))
    .filter(x=>x.level==='二軍'&&x.date===date);
  for(const candidate of candidates){
    try{
      const html=await getText(NPB_BASE+candidate.path,60000);
      const parsed=npbDirectJapaneseDaily(html,id,date,profile);
      if(parsed){
        parsed.provider='NPB';
        parsed.leagueLevel='二軍';
        parsed.level='farm';
        parsed.sourceMode='npb-farm-box';
        parsed.sourceUrl=NPB_BASE+candidate.path;
        return parsed;
      }
    }catch(e){console.warn('NPB Farm box failed',candidate.path,e)}
  }
  return {found:false,provider:'NPB',date,profile,level:'farm',leagueLevel:'二軍'};
}
async function npbLastAppearance(id,date,profileInput=null){
  const profile=profileInput||await npbProfile(id);
  const target=String(date||'');
  const d=dateParts(target);
  const candidates=[];
  for(let offset=0;offset>=-3;offset--){
    const m=monthShift(d.year,Number(d.mm),offset);
    try{candidates.push(...await npbMonthGameCandidates(m.year,m.month,profile))}catch{}
  }
  candidates.sort((a,b)=>b.date.localeCompare(a.date)||(a.level==='一軍'?-1:1));
  let checked=0;
  for(const candidate of candidates){
    if(candidate.date>=target)continue;
    if(checked++>=45)break;
    try{
      const html=await getText(NPB_BASE+candidate.path,60000);
      if(npbBoxHasPlayer(html,id)){
        return {date:candidate.date,leagueLevel:candidate.level,level:candidate.level==='二軍'?'farm':'top',sourceUrl:NPB_BASE+candidate.path};
      }
    }catch{}
  }
  return null;
}
async function npbDailyAuto(id,date){
  let top=null;
  try{top=await npbDaily(id,date)}catch(e){console.warn('NPB top daily failed',e)}
  const profile=top?.profile||await npbProfile(id);
  if(top?.found){
    top.leagueLevel='一軍';
    top.level='top';
    return top;
  }
  let farm=null;
  try{farm=await npbFarmDaily(id,date,profile)}catch(e){console.warn('NPB Farm daily failed',e)}
  if(farm?.found)return farm;
  let lastAppearance=null;
  try{lastAppearance=await npbLastAppearance(id,date,profile)}catch(e){console.warn('NPB last appearance lookup failed',e)}
  return {
    found:false,provider:'NPB',date,profile,lastAppearance,
    reason:lastAppearance?'當天一軍、二軍都沒有此球員的出賽資料。':'當天一軍、二軍都沒有此球員的出賽資料，且近期未找到可確認的出賽紀錄。'
  };
}

/* ---------- KBO ---------- */
const KBO_PREFERRED_ZH_BY_ID = {
  '52605':'金倒永'
};
const KBO_STALE_ZH_ALIASES_BY_ID = {
  '52605':['金道英']
};
const KBO_TEAM_CODES = {
  'KIA':'HT','KIA타이거즈':'HT','기아':'HT','기아타이거즈':'HT',
  'KT':'KT','KT위즈':'KT',
  'LG':'LG','LG트윈스':'LG',
  '삼성':'SS','삼성라이온즈':'SS',
  '두산':'OB','두산베어스':'OB',
  'SSG':'SK','SSG랜더스':'SK',
  '롯데':'LT','롯데자이언츠':'LT',
  '한화':'HH','한화이글스':'HH',
  'NC':'NC','NC다이노스':'NC',
  '키움':'WO','키움히어로즈':'WO'
};
function kboPreferredChineseName(id,name,fallback=''){
  return KBO_PREFERRED_ZH_BY_ID[String(id||'')] || fallback || '';
}
function kboStaleChineseAliases(id){
  return KBO_STALE_ZH_ALIASES_BY_ID[String(id||'')] || [];
}
function kboTeamCode(value){
  const key=clean(value).replace(/\s+/g,'');
  return KBO_TEAM_CODES[key] || KBO_TEAM_CODES[key.toUpperCase()] || '';
}
function kboTableRows(value){
  if(!value) return [];
  try{
    const parsed=typeof value==='string'?JSON.parse(value):value;
    return (parsed?.rows||[]).map(r=>(r?.row||[]).map(c=>String(c?.Text??'')));
  }catch{
    return [];
  }
}
function kboBoxCellEvents(value){
  const raw=String(value||'').trim();
  if(!raw || raw==='&nbsp;' || raw==='-') return [];
  return raw
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(?:div|p|li)>\s*<(?:div|p|li)\b[^>]*>/gi,'\n')
    .split(/\n+/)
    .map(v=>strip(v))
    .map(clean)
    .filter(v=>v && v!=='-' && v!=='&nbsp;');
}
function kboResultPosition(s){
  const compact=String(s||'').replace(/\s+/g,'');
  const map={투:'投',포:'捕','1':'一','2':'二','3':'三',유:'游',좌:'左',중:'中',우:'右'};
  return map[compact.charAt(0)]||'';
}
function kboResultDirection(s){
  const compact=String(s||'').replace(/\s+/g,'');
  if(/좌중(?:간)?/.test(compact)) return '左中';
  if(/우중(?:간)?/.test(compact)) return '右中';
  if(/^좌/.test(compact)) return '左';
  if(/^중/.test(compact)) return '中';
  if(/^우/.test(compact)) return '右';
  return '';
}
function kboRbiFromText(value){
  const s=clean(strip(value)).replace(/\s+/g,'');
  const m=s.match(/(?:^|[^0-9])(\d{1,2})타점/) || s.match(/타점(\d{1,2})/);
  if(!m) return 0;
  return Math.max(0,Math.min(4,num(m[1])));
}
function kboPaFromText(value){
  const raw=clean(strip(value));
  const s=raw.replace(/\s+/g,'');
  if(!s || s==='-' || /^(?:교체|대주자|대수비)$/.test(s)) return null;

  const position=kboResultPosition(s);
  const direction=kboResultDirection(s);
  const dirText=direction || position;
  const explicitRbi=kboRbiFromText(raw);

  if(/홈런|홈$/.test(s)){
    return {code:'HR',position:'',rbi:explicitRbi,officialAction:direction?direction+'本':'全壘打'};
  }
  if(/3루타|(?:좌중|우중|좌|중|우)(?:간)?3$/.test(s)){
    return {code:'3B',position:'',rbi:explicitRbi,officialAction:direction?direction+'三':'三安'};
  }
  if(/2루타|(?:좌중|우중|좌|중|우)(?:간)?2$/.test(s)){
    return {code:'2B',position:'',rbi:explicitRbi,officialAction:direction?direction+'二':'二安'};
  }
  if(/안타|안$/.test(s)){
    const infield=/내안|번안/.test(s);
    return {
      code:'1B',
      position:infield?'':position,
      rbi:explicitRbi,
      officialAction:infield?'內安':dirText?dirText+'安':'一安'
    };
  }
  if(/고의4구|자동고의4구|고4/.test(s)) return {code:'IBB',position:'',rbi:explicitRbi,officialAction:'故意四壞'};
  if(/4구|볼넷/.test(s)) return {code:'BB',position:'',rbi:explicitRbi,officialAction:'四壞'};
  if(/사구|몸에맞/.test(s)) return {code:'HBP',position:'',rbi:explicitRbi,officialAction:'死球'};
  if(/낫아웃/.test(s)) return {code:'K',position:'',rbi:0,officialAction:'三振'};
  if(/삼진/.test(s)) return {code:'K',position:'',rbi:0,officialAction:'三振'};
  if(/희생번트|희번|희타/.test(s)) return {code:'SH',position,rbi:explicitRbi,officialAction:'犧短'};
  if(/희생플라이|희플|희비/.test(s)) return {code:'SF',position,rbi:explicitRbi,officialAction:'犧飛'};
  if(/삼중살/.test(s)) return {code:'TP',position,rbi:0,officialAction:'三殺'};
  if(/병살|병$/.test(s)) return {code:'DP',position,rbi:0,officialAction:'雙殺'};
  if(/타격방해/.test(s)) return {code:'CI',position:'',rbi:explicitRbi,officialAction:'礙打'};
  if(/수비방해/.test(s)) return {code:'INT',position:'',rbi:0,officialAction:'礙守'};
  if(/야선|야수선택/.test(s)) return {code:'FC',position,rbi:explicitRbi,officialAction:'野選'};
  if(/실책|실$/.test(s)) return {code:'E',position,rbi:explicitRbi,officialAction:position?position+'失':'失誤'};
  if(/인필드플라이|내야플라이/.test(s)) return {code:'FO',position:'',rbi:0,officialAction:'內飛'};
  if(/파울|파$/.test(s)) return {code:'FO',position,rbi:0,officialAction:'界飛'};
  if(/직선타|직$/.test(s)) return {code:'FO',position,rbi:explicitRbi,officialAction:position?position+'直':'飛球出局'};
  if(/땅볼|땅$/.test(s)) return {code:'GO',position,rbi:explicitRbi,officialAction:position?position+'滾':'滾地出局'};
  if(/뜬공|플라이|비$/.test(s)) return {code:'FO',position,rbi:explicitRbi,officialAction:position?position+'飛':'飛球出局'};
  if(/아웃/.test(s)) return {code:'OUT',position,rbi:explicitRbi,officialAction:'出局'};
  return null;
}
async function kboBoxPlateAppearances(profile,opponent,date){
  const teamCode=kboTeamCode(profile?.team);
  const opponentCode=kboTeamCode(opponent);
  if(!teamCode || !opponentCode || teamCode===opponentCode) return {gameId:'',plateAppearances:[]};

  const compact=String(date||'').replace(/-/g,'');
  const season=dateParts(date).year;
  const suffixes=['0','1','2'];
  const candidates=[];
  for(const suffix of suffixes){
    candidates.push(compact+opponentCode+teamCode+suffix);
    candidates.push(compact+teamCode+opponentCode+suffix);
  }

  for(const gameId of [...new Set(candidates)]){
    let box;
    try{
      box=await postFormJson(
        KBO_BASE+'/ws/Schedule.asmx/GetBoxScoreScroll',
        {leId:1,srId:0,seasonId:season,gameId},
        120000
      );
    }catch{
      continue;
    }
    const hitters=Array.isArray(box?.arrHitter)?box.arrHitter:[];
    for(const hitter of hitters){
      const metaRows=kboTableRows(hitter?.table1);
      const inningRows=kboTableRows(hitter?.table2);
      const matches=[];
      for(let i=0;i<metaRows.length;i++){
        const name=strip(metaRows[i]?.[2]||'');
        if(norm(name)===norm(profile?.name||'')) matches.push(i);
      }
      if(!matches.length) continue;

      const plateAppearances=[];
      for(const i of matches){
        const cells=inningRows[i]||[];
        for(const cell of cells){
          for(const eventText of kboBoxCellEvents(cell)){
            const pa=kboPaFromText(eventText);
            if(pa) plateAppearances.push(pa);
          }
        }
      }
      if(plateAppearances.length) return {gameId,plateAppearances};
    }
  }
  return {gameId:'',plateAppearances:[]};
}
async function kboSearch(query){
  const groups=await resolveNameGroups(query);
  const variants=[...new Set(groups.flatMap(g=>g.variants||[]))].filter(Boolean).slice(0,14);
  const out=[],seen=new Set();

  for(const variant of variants){
    let html='';
    try{
      html=await getText(KBO_BASE+'/Player/Search.aspx?searchWord='+encodeURIComponent(variant),120000);
    }catch{continue}

    for(const r of rows(html)){
      const id=(r.html.match(/playerId=(\d+)/i)||[])[1]||'';
      if(!id||seen.has(id)||r.cells.length<4) continue;
      const number=r.cells[0]||'',name=r.cells[1]||'',team=r.cells[2]||'',position=r.cells[3]||'';
      if(!name) continue;
      const match=variants.some(v=>{
        const a=norm(v),b=norm(name);
        return a&&b&&(a===b||a.includes(b)||b.includes(a));
      });
      if(!match) continue;

      const wikiName=chineseNameFor(groups,name);
      const preferredName=kboPreferredChineseName(id,name,'');
      seen.add(id);
      out.push({
        provider:'KBO',id,name,
        zhName:preferredName||wikiName,
        zhNamePreferred:Boolean(preferredName),
        zhNameAliases:preferredName?kboStaleChineseAliases(id):[],
        number:number==='#'?'':number,team,position,type:playerType(position)
      });
      if(out.length>=12) break;
    }
    if(out.length>=12) break;
  }
  return out;
}
function kboTop(html,id){
  const plain=strip(html.slice(0,26000));
  const name=(plain.match(/선수명:\s*([^\s|]+)/)||[])[1]||'';
  const number=(plain.match(/등번호:\s*No\.?\s*([0-9]+)/)||[])[1]||'';
  const position=clean((plain.match(/포지션:\s*([^(|]+)/)||[])[1]||'');
  const team=clean((plain.match(/([A-Za-z가-힣]+)\s*(?:타이거즈|베어스|라이온즈|이글스|자이언츠|다이노스|히어로즈)/)||[])[0]||'');
  const preferredName=kboPreferredChineseName(id,name,'');
  return {
    provider:'KBO',id,name,number,team,position,type:playerType(position),
    zhName:preferredName,
    zhNamePreferred:Boolean(preferredName),
    zhNameAliases:preferredName?kboStaleChineseAliases(id):[]
  };
}
async function kboProfile(id){
  let html='';
  try{
    html=await getText(KBO_BASE+'/Record/Player/HitterDetail/Basic.aspx?playerId='+encodeURIComponent(id),120000);
  }catch{}
  let p=html?kboTop(html,id):null;
  if(!p?.name){
    html=await getText(KBO_BASE+'/Record/Player/PitcherDetail/Basic.aspx?playerId='+encodeURIComponent(id),120000);
    p=kboTop(html,id);
  }
  if(!p?.name) throw new Error('KBO player not found');
  return p;
}
function kboYears(html){
  const s=new Set();
  for(const r of rows(html)){
    const y=Number(String(r.cells[0]||'').trim());
    if(Number.isInteger(y)&&y>=1982&&y<=2100) s.add(y);
  }
  return [...s].sort((a,b)=>b-a);
}
function kboTotal(html,y,type){
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const hm=headerMap(rs[0].cells);
    const r=rs.find(x=>String(x.cells[0]||'').trim()===String(y));
    if(!r) continue;
    const hdr=rs[0].cells.join('|');

    if(type==='hitter' && /\bAVG\b/.test(hdr) && /\bPA\b/.test(hdr)){
      const h=num(pick(r.cells,hm,'H'));
      const d=num(pick(r.cells,hm,'2B'));
      const t=num(pick(r.cells,hm,'3B'));
      const hr=num(pick(r.cells,hm,'HR'));
      return {
        pa:num(pick(r.cells,hm,'PA')),ab:num(pick(r.cells,hm,'AB')),
        runs:num(pick(r.cells,hm,'R')),hits:h,
        single:singles(h,d,t,hr),double:d,triple:t,hr,
        rbi:num(pick(r.cells,hm,'RBI')),bb:num(pick(r.cells,hm,'BB')),
        ibb:num(pick(r.cells,hm,'IBB')),hbp:num(pick(r.cells,hm,'HBP')),
        sacBunt:num(pick(r.cells,hm,'SAC')),sacFly:num(pick(r.cells,hm,'SF')),
        k:num(pick(r.cells,hm,'SO')),avg:num(pick(r.cells,hm,'AVG')),
        obp:num(pick(r.cells,hm,'OBP')),slg:num(pick(r.cells,hm,'SLG')),
        errors:num(pick(r.cells,hm,'E'))
      };
    }

    if(type==='pitcher' && /\bERA\b/.test(hdr) && /\bIP\b/.test(hdr)){
      const ip=pick(r.cells,hm,'IP');
      const outs=ipToOuts(ip),h=num(pick(r.cells,hm,'H')),bb=num(pick(r.cells,hm,'BB'));
      const er=num(pick(r.cells,hm,'ER'));
      return {
        outs,innings:outsToIp(outs),h,bb,hbp:num(pick(r.cells,hm,'HBP')),
        k:num(pick(r.cells,hm,'SO')),r:num(pick(r.cells,hm,'R')),er,
        w:num(pick(r.cells,hm,'W')),l:num(pick(r.cells,hm,'L')),
        sv:num(pick(r.cells,hm,'SV')),hld:num(pick(r.cells,hm,'HLD')),
        bsv:0,cg:num(pick(r.cells,hm,'CG')),sho:num(pick(r.cells,hm,'SHO')),
        era:num(pick(r.cells,hm,'ERA')),whip:outs?(h+bb)/(outs/3):0
      };
    }
  }
  return null;
}
async function kboSeason(id,y){
  const profile=await kboProfile(id);
  const [hh,ph]=await Promise.all([
    getText(KBO_BASE+'/Record/Player/HitterDetail/Total.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
    getText(KBO_BASE+'/Record/Player/PitcherDetail/Total.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>'')
  ]);
  const years=[...new Set([...kboYears(hh),...kboYears(ph)])].sort((a,b)=>b-a);
  return {
    provider:'KBO',year:y,profile:Object.assign(profile,{years}),
    hitter:hh?kboTotal(hh,y,'hitter'):null,
    pitcher:ph?kboTotal(ph,y,'pitcher'):null
  };
}

function kboFuturesCurrentSeasonTotal(html,y,type){
  const plain=strip(html);
  if(!plain.includes(String(y)+' 시즌 퓨처스 성적')) return null;
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const head=rs[0].cells||[];
    const hm=headerMap(head);
    const row=rs.slice(1).find(r=>r.cells?.length>=head.length-2 && !/기록이 없습니다/.test(r.cells.join(' ')));
    if(!row) continue;

    if(type==='hitter' && head.includes('AVG') && head.includes('AB') && head.includes('HR') && head.includes('OBP')){
      const h=num(pick(row.cells,hm,'H')),d=num(pick(row.cells,hm,'2B')),t=num(pick(row.cells,hm,'3B')),hr=num(pick(row.cells,hm,'HR'));
      const ab=num(pick(row.cells,hm,'AB'));
      const bb=num(pick(row.cells,hm,'BB')),hbp=num(pick(row.cells,hm,'HBP'));
      return {
        pa:num(pick(row.cells,hm,'PA')) || (ab+bb+hbp),
        ab,runs:num(pick(row.cells,hm,'R')),hits:h,
        single:singles(h,d,t,hr),double:d,triple:t,hr,
        rbi:num(pick(row.cells,hm,'RBI')),bb,ibb:0,hbp,
        sacBunt:num(pick(row.cells,hm,'SAC')),sacFly:num(pick(row.cells,hm,'SF')),
        k:num(pick(row.cells,hm,'SO')),
        avg:num(pick(row.cells,hm,'AVG')),slg:num(pick(row.cells,hm,'SLG')),obp:num(pick(row.cells,hm,'OBP')),
        errors:num(pick(row.cells,hm,'E'))
      };
    }

    if(type==='pitcher' && head.includes('ERA') && head.includes('IP') && head.includes('SO')){
      const ip=pick(row.cells,hm,'IP');
      const outs=ipToOuts(ip),h=num(pick(row.cells,hm,'H')),bb=num(pick(row.cells,hm,'BB')),er=num(pick(row.cells,hm,'ER'));
      return {
        outs,innings:outsToIp(outs),h,bb,hbp:num(pick(row.cells,hm,'HBP')),
        k:num(pick(row.cells,hm,'SO')),r:num(pick(row.cells,hm,'R')),er,
        w:num(pick(row.cells,hm,'W')),l:num(pick(row.cells,hm,'L')),
        sv:num(pick(row.cells,hm,'SV')),hld:num(pick(row.cells,hm,'HLD')),
        bsv:0,cg:num(pick(row.cells,hm,'CG')),sho:num(pick(row.cells,hm,'SHO')),
        era:num(pick(row.cells,hm,'ERA')),
        whip:outs?(h+bb)/(outs/3):0
      };
    }
  }
  return null;
}
function kboFuturesCareerTotal(html,y,type){
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const headerIndex=rs.findIndex(r=>{
      const head=r.cells||[];
      if(!head.includes('연도')) return false;
      return type==='hitter'
        ? head.includes('AVG') && head.includes('PA') && head.includes('RBI')
        : head.includes('ERA') && head.includes('IP') && head.includes('ER');
    });
    if(headerIndex<0) continue;

    const head=rs[headerIndex].cells||[];
    const hm=headerMap(head);
    const row=rs.slice(headerIndex+1).find(r=>clean(r.cells?.[0]||'')===String(y));
    if(!row) continue;

    if(type==='hitter'){
      const h=num(pick(row.cells,hm,'H')),d=num(pick(row.cells,hm,'2B')),t=num(pick(row.cells,hm,'3B')),hr=num(pick(row.cells,hm,'HR'));
      return {
        pa:num(pick(row.cells,hm,'PA')),ab:num(pick(row.cells,hm,'AB')),
        runs:num(pick(row.cells,hm,'R')),hits:h,
        single:singles(h,d,t,hr),double:d,triple:t,hr,
        rbi:num(pick(row.cells,hm,'RBI')),
        bb:num(pick(row.cells,hm,'BB')),ibb:0,hbp:num(pick(row.cells,hm,'HBP')),
        sacBunt:num(pick(row.cells,hm,'SAC')),sacFly:num(pick(row.cells,hm,'SF')),
        k:num(pick(row.cells,hm,'SO')),
        avg:num(pick(row.cells,hm,'AVG')),slg:num(pick(row.cells,hm,'SLG')),obp:num(pick(row.cells,hm,'OBP')),
        errors:num(pick(row.cells,hm,'E'))
      };
    }

    const ip=pick(row.cells,hm,'IP');
    const outs=ipToOuts(ip),h=num(pick(row.cells,hm,'H')),bb=num(pick(row.cells,hm,'BB')),er=num(pick(row.cells,hm,'ER'));
    return {
      outs,innings:outsToIp(outs),h,bb,hbp:num(pick(row.cells,hm,'HBP')),
      k:num(pick(row.cells,hm,'SO')),r:num(pick(row.cells,hm,'R')),er,
      w:num(pick(row.cells,hm,'W')),l:num(pick(row.cells,hm,'L')),
      sv:num(pick(row.cells,hm,'SV')),hld:num(pick(row.cells,hm,'HLD')),
      bsv:0,cg:num(pick(row.cells,hm,'CG')),sho:num(pick(row.cells,hm,'SHO')),
      era:num(pick(row.cells,hm,'ERA')),
      whip:outs?(h+bb)/(outs/3):0
    };
  }
  return null;
}
async function kboFuturesYears(id){
  const profile=await kboProfile(id);
  const [hh,ph]=await Promise.all([
    getText(KBO_BASE+'/Futures/Player/HitterTotal.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
    getText(KBO_BASE+'/Futures/Player/PitcherTotal.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>'')
  ]);
  const years=[...new Set([...kboYears(hh),...kboYears(ph)])].sort((a,b)=>b-a);
  return {provider:'KBO',level:'D',profile:Object.assign(profile,{years}),years};
}
async function kboFuturesSeason(id,y){
  const profile=await kboProfile(id);
  const [hh,ph,hCurrent,pCurrent]=await Promise.all([
    getText(KBO_BASE+'/Futures/Player/HitterTotal.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
    getText(KBO_BASE+'/Futures/Player/PitcherTotal.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
    getText(KBO_BASE+'/Futures/Player/HitterDetail.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
    getText(KBO_BASE+'/Futures/Player/PitcherDetail.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>'')
  ]);
  const years=[...new Set([...kboYears(hh),...kboYears(ph)])].sort((a,b)=>b-a);
  const hitter=(hh?kboFuturesCareerTotal(hh,y,'hitter'):null)
    || (hCurrent?kboFuturesCurrentSeasonTotal(hCurrent,y,'hitter'):null);
  const pitcher=(ph?kboFuturesCareerTotal(ph,y,'pitcher'):null)
    || (pCurrent?kboFuturesCurrentSeasonTotal(pCurrent,y,'pitcher'):null);
  return {
    provider:'KBO',year:y,level:'D',sourceMode:'kbo-futures-career',
    profile:Object.assign(profile,{years}),
    hitter,pitcher
  };
}
function kboDailyRow(html,date,type){
  const d=dateParts(date);
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const hm=headerMap(rs[0].cells);
    const r=rs.find(x=>clean(x.cells[0])===d.dot);
    if(!r) continue;

    if(type==='hitter'){
      const h=num(pick(r.cells,hm,'H')),db=num(pick(r.cells,hm,'2B'));
      const tr=num(pick(r.cells,hm,'3B')),hr=num(pick(r.cells,hm,'HR'));
      const ab=num(pick(r.cells,hm,'AB'));
      return {
        opponent:pick(r.cells,hm,'상대'),
        hitter:{
          pa:num(pick(r.cells,hm,'PA')),ab,runs:num(pick(r.cells,hm,'R')),hits:h,
          single:singles(h,db,tr,hr),double:db,triple:tr,hr,
          rbi:num(pick(r.cells,hm,'RBI')),bb:num(pick(r.cells,hm,'BB')),
          ibb:0,hbp:num(pick(r.cells,hm,'HBP')),sacBunt:0,sacFly:0,
          k:num(pick(r.cells,hm,'SO')),avg:ab?h/ab:0,obp:0,slg:0,
          errors:0,plateAppearances:[]
        }
      };
    }

    if(type==='pitcher'){
      const ip=pick(r.cells,hm,'IP');
      const outs=ipToOuts(ip),h=num(pick(r.cells,hm,'H')),bb=num(pick(r.cells,hm,'BB'));
      const er=num(pick(r.cells,hm,'ER'));
      const result=pick(r.cells,hm,'결과');
      return {
        opponent:pick(r.cells,hm,'상대'),
        pitcher:{
          outs,innings:outsToIp(outs),h,bb,hbp:num(pick(r.cells,hm,'HBP')),
          k:num(pick(r.cells,hm,'SO')),r:num(pick(r.cells,hm,'R')),er,
          w:/승/.test(result)?1:0,l:/패/.test(result)?1:0,
          sv:/세/.test(result)?1:0,hld:/홀/.test(result)?1:0,
          bsv:0,cg:0,sho:0,era:outs?er*9/(outs/3):0,whip:outs?(h+bb)/(outs/3):0
        }
      };
    }
  }
  return null;
}
async function kboDaily(id,date){
  const profile=await kboProfile(id);
  const [hh,ph]=await Promise.all([
    getText(KBO_BASE+'/Record/Player/HitterDetail/Daily.aspx?playerId='+encodeURIComponent(id),60000).catch(()=>''),
    getText(KBO_BASE+'/Record/Player/PitcherDetail/Daily.aspx?playerId='+encodeURIComponent(id),60000).catch(()=>'')
  ]);
  const h=hh?kboDailyRow(hh,date,'hitter'):null;
  const p=ph?kboDailyRow(ph,date,'pitcher'):null;
  if(!h&&!p) return {found:false,provider:'KBO',date,profile};

  let detail={gameId:'',plateAppearances:[]};
  if(h?.hitter){
    try{
      detail=await kboBoxPlateAppearances(profile,h.opponent,date);
      if(detail.plateAppearances.length) h.hitter.plateAppearances=detail.plateAppearances;
    }catch(e){
      console.warn('KBO box score PA lookup failed',e);
    }
  }

  return {
    found:true,provider:'KBO',date,profile,
    opponent:h?.opponent||p?.opponent||'',
    hitter:h?.hitter||null,
    pitcher:p?.pitcher||null,
    sourceMode:detail.plateAppearances.length?'kbo-box':'kbo-daily',
    sourceGameId:detail.gameId||''
  };
}




function htmlTableById(html,id){
  const source=String(html||'');
  const token1='id="'+String(id||'')+'"';
  const token2="id='"+String(id||'')+"'";
  let pos=source.indexOf(token1);
  if(pos<0)pos=source.indexOf(token2);
  if(pos<0)return '';

  // Some Futures hitter grids put the id on the wrapping div, not the table.
  const tagStart=source.lastIndexOf('<',pos);
  const openTag=tagStart>=0?source.slice(tagStart,source.indexOf('>',tagStart)+1):'';
  const tagName=(openTag.match(/^<\s*([a-z0-9]+)/i)||[])[1]?.toLowerCase()||'';
  let start=tagName==='table'?tagStart:source.indexOf('<table',pos);
  if(start<0)return '';
  const end=source.indexOf('</table>',start);
  if(end<0)return '';
  return source.slice(start,end+8);
}
function tbodyRows(tableHtml){
  const body=String(tableHtml||'').match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]||'';
  return rows(body);
}
function kboFuturesTeamCode(value){
  const base=kboTeamCode(value);
  if(base==='LT')return 'UL';
  return base;
}
function kboFuturesH4Texts(html){
  return [...String(html||'').matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)]
    .map(m=>clean(strip(m[1]))).filter(Boolean);
}
function kboFuturesHitterTeams(html){
  return kboFuturesH4Texts(html)
    .filter(text=>/타자 기록/.test(text))
    .map(text=>clean(text.replace(/타자 기록.*$/,''))).filter(Boolean);
}
function kboFuturesPitcherTeams(html){
  return kboFuturesH4Texts(html)
    .filter(text=>/투수 기록/.test(text))
    .map(text=>clean(text.replace(/투수 기록.*$/,''))).filter(Boolean);
}
function kboPaCounts(list){
  const c={single:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,sacBunt:0,sacFly:0,k:0};
  for(const x of list||[]){
    if(x.code==='1B')c.single++;
    if(x.code==='2B')c.double++;
    if(x.code==='3B')c.triple++;
    if(x.code==='HR')c.hr++;
    if(x.code==='BB')c.bb++;
    if(x.code==='IBB')c.ibb++;
    if(x.code==='HBP')c.hbp++;
    if(x.code==='SH')c.sacBunt++;
    if(x.code==='SF')c.sacFly++;
    if(x.code==='K')c.k++;
  }
  return c;
}
function kboFuturesBoxDaily(html,profile,date,gameId){
  const teamNames=kboFuturesHitterTeams(html);
  let hitter=null,pitcher=null,opponent='';

  // Do not return after finding the hitter row. A position player can also pitch
  // in the same Futures game, so both halves of the box must be collected.
  for(const side of ['Away','Home']){
    const meta=tbodyRows(htmlTableById(html,'tbl'+side+'Hitter1'));
    const result=tbodyRows(htmlTableById(html,'tbl'+side+'Hitter2'));
    const summary=tbodyRows(htmlTableById(html,'tbl'+side+'Hitter3'));
    const idx=meta.findIndex(r=>norm(r.cells?.[2]||'')===norm(profile?.name||''));
    if(idx<0)continue;

    const plateAppearances=[];
    for(const cell of result[idx]?.cells||[]){
      for(const eventText of kboBoxCellEvents(cell)){
        const pa=kboPaFromText(eventText);
        if(pa)plateAppearances.push(pa);
      }
    }
    const stat=summary[idx]?.cells||[];
    const ab=num(stat[0]),hits=num(stat[1]),rbi=num(stat[2]),runs=num(stat[3]);
    const counts=kboPaCounts(plateAppearances);
    hitter={
      pa:plateAppearances.length,ab,runs,hits,
      single:Math.max(0,hits-counts.double-counts.triple-counts.hr),
      double:counts.double,triple:counts.triple,hr:counts.hr,rbi,
      bb:counts.bb,ibb:counts.ibb,hbp:counts.hbp,
      sacBunt:counts.sacBunt,sacFly:counts.sacFly,k:counts.k,
      errors:0,plateAppearances
    };
    const sideIndex=side==='Away'?0:1;
    opponent=teamNames[sideIndex===0?1:0]||opponent;
    break;
  }

  const pitcherTables=tables(html).filter(t=>{
    const plain=strip(t);
    return /선수명/.test(plain)&&/투구수/.test(plain)&&/피안타/.test(plain)&&/자책/.test(plain);
  });
  const pitcherTeams=kboFuturesPitcherTeams(html);
  for(let ti=0;ti<pitcherTables.length;ti++){
    const table=pitcherTables[ti];
    const rs=rows(table);
    const header=rs.find(r=>r.cells.includes('선수명')&&r.cells.includes('투구수'))?.cells||[];
    const hm=headerMap(header);
    const row=tbodyRows(table).find(r=>norm(r.cells?.[0]||'')===norm(profile?.name||''));
    if(!row)continue;

    const ip=pick(row.cells,hm,'이닝');
    const outs=ipToOuts(ip);
    const resultText=pick(row.cells,hm,'결과');
    const freePasses=num(pick(row.cells,hm,'4사구'));
    pitcher={
      outs,innings:outsToIp(outs),pitchCount:num(pick(row.cells,hm,'투구수')),
      h:num(pick(row.cells,hm,'피안타')),hrAllowed:num(pick(row.cells,hm,'피홈런')),
      bb:freePasses,hbp:0,walksCombined:true,k:num(pick(row.cells,hm,'삼진')),
      r:num(pick(row.cells,hm,'실점')),er:num(pick(row.cells,hm,'자책')),
      w:/승/.test(resultText)?1:0,l:/패/.test(resultText)?1:0,
      sv:/세/.test(resultText)?1:0,hld:/홀드/.test(resultText)?1:0,bsv:0,cg:0,sho:0
    };
    opponent=opponent||pitcherTeams[ti===0?1:0]||'';
    break;
  }

  if(!hitter&&!pitcher)return null;
  return {
    found:true,provider:'KBO',date,profile,opponent,hitter,pitcher,
    sourceMode:'kbo-futures-box',sourceGameId:gameId,
    leagueLevel:'二軍',level:'futures'
  };
}
async function kboFuturesScheduleHtml(date){
  const compact=String(date||'').replace(/-/g,'');
  const y=dateParts(date).year;
  return await getText(KBO_BASE+'/Futures/Schedule/GameList.aspx?seasonId='+y+'&gameDate='+compact,60000);
}
async function kboFuturesGameIds(date,profile){
  let html='';
  try{html=await kboFuturesScheduleHtml(date)}catch{return []}
  const compact=String(date||'').replace(/-/g,'');
  const code=kboFuturesTeamCode(profile?.team);
  const re=/gameId=(\d{8}[A-Z0-9]{4,8})/g;
  const ids=[...new Set([...html.matchAll(re)].map(m=>m[1]))];
  return ids.filter(id=>id.startsWith(compact)&&(!code||id.slice(8,12).includes(code)));
}
async function kboFuturesDaily(id,date,profileInput=null){
  const profile=profileInput||await kboProfile(id);
  const gameIds=await kboFuturesGameIds(date,profile);
  for(const gameId of gameIds){
    const url=KBO_BASE+'/Futures/Schedule/BoxScore.aspx?leagueId=2&seriesId=0&seasonId='+dateParts(date).year+'&gameId='+gameId;
    try{
      const html=await getText(url,60000);
      const parsed=kboFuturesBoxDaily(html,profile,date,gameId);
      if(parsed){parsed.sourceUrl=url;return parsed;}
    }catch(e){console.warn('KBO Futures box failed',gameId,e)}
  }
  return {found:false,provider:'KBO',date,profile,leagueLevel:'二軍',level:'futures'};
}
function kboLatestDateInDailyHtml(html,target){
  const y=dateParts(target).year;
  let best='';
  for(const table of tables(html||'')){
    for(const r of rows(table)){
      const raw=clean(r.cells?.[0]||'');
      const m=raw.match(/^(\d{1,2})\.(\d{1,2})$/);
      if(!m)continue;
      const iso=String(y)+'-'+String(m[1]).padStart(2,'0')+'-'+String(m[2]).padStart(2,'0');
      if(iso<target&&iso>best)best=iso;
    }
  }
  return best;
}
async function kboFuturesLastAppearance(profile,target){
  const td=dateParts(target);
  const code=kboFuturesTeamCode(profile?.team);
  let checked=0;
  for(let offset=0;offset>=-3;offset--){
    const m=monthShift(td.year,Number(td.mm),offset);
    const probe=String(m.year)+'-'+m.mm+'-15';
    let html='';
    try{html=await kboFuturesScheduleHtml(probe)}catch{continue}
    const re=/gameId=(\d{8}[A-Z0-9]{4,8})/g;
    const ids=[...new Set([...html.matchAll(re)].map(x=>x[1]))]
      .filter(g=>dateIsoFromYmd(Number(g.slice(0,4)),g.slice(4,8))<target)
      .filter(g=>!code||g.slice(8,12).includes(code))
      .sort().reverse();
    for(const gameId of ids){
      if(checked++>=35)return null;
      const date=dateIsoFromYmd(Number(gameId.slice(0,4)),gameId.slice(4,8));
      const url=KBO_BASE+'/Futures/Schedule/BoxScore.aspx?leagueId=2&seriesId=0&seasonId='+m.year+'&gameId='+gameId;
      try{
        const box=await getText(url,60000);
        if(norm(strip(box)).includes(norm(profile?.name||''))){
          return {date,leagueLevel:'二軍',level:'futures',sourceUrl:url};
        }
      }catch{}
    }
  }
  return null;
}
async function kboLastAppearance(id,date,profileInput=null){
  const profile=profileInput||await kboProfile(id);
  const [hh,ph]=await Promise.all([
    getText(KBO_BASE+'/Record/Player/HitterDetail/Daily.aspx?playerId='+encodeURIComponent(id),60000).catch(()=>''),
    getText(KBO_BASE+'/Record/Player/PitcherDetail/Daily.aspx?playerId='+encodeURIComponent(id),60000).catch(()=>'')
  ]);
  const topDate=[kboLatestDateInDailyHtml(hh,date),kboLatestDateInDailyHtml(ph,date)].filter(Boolean).sort().reverse()[0]||'';
  let futures=null;
  try{futures=await kboFuturesLastAppearance(profile,date)}catch{}
  if(topDate&&(!futures?.date||topDate>=futures.date))return {date:topDate,leagueLevel:'一軍',level:'top'};
  return futures;
}
async function kboDailyAuto(id,date){
  let top=null;
  try{top=await kboDaily(id,date)}catch(e){console.warn('KBO top daily failed',e)}
  const profile=top?.profile||await kboProfile(id);
  if(top?.found){
    top.leagueLevel='一軍';
    top.level='top';
    return top;
  }
  let futures=null;
  try{futures=await kboFuturesDaily(id,date,profile)}catch(e){console.warn('KBO Futures daily failed',e)}
  if(futures?.found)return futures;
  let lastAppearance=null;
  try{lastAppearance=await kboLastAppearance(id,date,profile)}catch(e){console.warn('KBO last appearance lookup failed',e)}
  return {
    found:false,provider:'KBO',date,profile,lastAppearance,
    reason:lastAppearance?'當天一軍、二軍都沒有此球員的出賽資料。':'當天一軍、二軍都沒有此球員的出賽資料，且近期未找到可確認的出賽紀錄。'
  };
}

/* ---------- International tournaments ---------- */
const INTERNATIONAL_TEAM_EN = {
  '中華台北':'Chinese Taipei',
  '日本':'Japan',
  '韓國':'Korea',
  '澳洲':'Australia',
  '捷克':'Czechia',
  '美國':'United States',
  '墨西哥':'Mexico',
  '義大利':'Italy',
  '英國':'Great Britain',
  '巴西':'Brazil',
  '加拿大':'Canada',
  '哥倫比亞':'Colombia',
  '古巴':'Cuba',
  '巴拿馬':'Panama',
  '波多黎各':'Puerto Rico',
  '多明尼加':'Dominican Republic',
  '以色列':'Israel',
  '荷蘭':'Kingdom of the Netherlands',
  '尼加拉瓜':'Nicaragua',
  '委內瑞拉':'Venezuela',
  '西班牙':'Spain',
  '南非':'South Africa',
  '德國':'Germany',
  '中國':'China',
  '法國':'France',
  '紐西蘭':'New Zealand',
  '菲律賓':'Philippines',
  '阿根廷':'Argentina',
  '巴基斯坦':'Pakistan',
  '泰國':'Thailand',
  '香港':'Hong Kong',
  '斯里蘭卡':'Sri Lanka',
  '新加坡':'Singapore',
  '巴勒斯坦':'Palestine',
  '寮國':'Laos',
  '印尼':'Indonesia',
  '蒙古':'Mongolia'
};
const INTERNATIONAL_PREFERRED_ZH = {
  'Yi Chang':'張奕','Chang Yi':'張奕',
  'Kuan-Yu Chen':'陳冠宇','Chen Kuan-yu':'陳冠宇','Chen Kuan-Yu':'陳冠宇',
  'Kuan-Wei Chen':'陳冠偉','Chen Kuan-wei':'陳冠偉','Chen Kuan-Wei':'陳冠偉',
  'Po-Yu Chen':'陳柏毓',
  'Po-Ching Chen':'陳柏清','Chen Po-ching':'陳柏清','Chen Po-Ching':'陳柏清',
  'Hao-Chun Cheng':'鄭浩均',
  'Ruei-Yang Gu Lin':'古林睿煬',
  'Jo-Hsi Hsu':'徐若熙',
  'Chih-Wei Hu':'胡智為',
  'Kai-Wei Lin':'林凱威','Lin Kai-wei':'林凱威','Lin Kai-Wei':'林凱威',
  'Shih-Hsiang Lin':'林詩翔',
  'Wei-En Lin':'林維恩',
  'Yu-Min Lin':'林昱珉','Lin Yu-min':'林昱珉','Lin Yu-Min':'林昱珉',
  'Tzu-Chen Sha':'沙子宸',
  'Yi-Lei Sun':'孫易磊',
  'Jyun-Yue Tseng':'曾峻岳',
  'Jun-Wei Zhang':'張峻瑋',
  'Chen Zhong-Ao Zhuang':'莊陳仲敖',
  'Shao-Hung Chiang':'蔣少宏',
  'Kungkuan Giljegiljaw':'吉力吉撈·鞏冠','Giljegiljaw Kungkuan':'吉力吉撈·鞏冠',
  'Lyle Lin':'林家正',
  'Pei-Fong Tai':'戴培峰','Tai Pei-fong':'戴培峰','Tai Pei-Fong':'戴培峰',
  'Cheng-Yu Chang':'張政禹','Chang Cheng-yu':'張政禹','Chang Cheng-Yu':'張政禹',
  'Yu Chang':'張育成',
  'Tsung-Che Cheng':'鄭宗哲',
  'Kun-Yu Chiang':'江坤宇','Chiang Kun-yu':'江坤宇','Chiang Kun-Yu':'江坤宇',
  'Kuo-Hao Chiang':'江國豪','Chiang Kuo-hao':'江國豪','Chiang Kuo-Hao':'江國豪',
  'Hao-Yu Lee':'李灝宇','Hao Yu Lee':'李灝宇',
  'Tzu-Wei Lin':'林子偉',
  'Nien-Ting Wu':'吳念庭',
  'Chen-Wei Chen':'陳晨威','Chen Chen-wei':'陳晨威','Chen Chen-Wei':'陳晨威',
  'Chieh-Hsien Chen':'陳傑憲','Chen Chieh-hsien':'陳傑憲','Chen Chieh-Hsien':'陳傑憲',
  'An-Ko Lin':'林安可','Lin An-ko':'林安可','Lin An-Ko':'林安可',
  'Cheng-Hui Sung':'宋晟睿',
  'Hsin-Yen Chuang':'莊昕諺','Chuang Hsin-yen':'莊昕諺','Chuang Hsin-Yen':'莊昕諺',
  'En-Sih Huang':'黃恩賜','Huang En-sih':'黃恩賜','Huang En-Sih':'黃恩賜',
  'Tzu-Peng Huang':'黃子鵬','Huang Tzu-peng':'黃子鵬','Huang Tzu-Peng':'黃子鵬',
  'Chun-Lin Kuo':'郭俊麟','Kuo Chun-lin':'郭俊麟','Kuo Chun-Lin':'郭俊麟',
  'Chih-Hsuan Wang':'王志煊','Wang Chih-hsuan':'王志煊','Wang Chih-Hsuan':'王志煊',
  'Chun-Wei Wu':'吳俊偉','Wu Chun-wei':'吳俊偉','Wu Chun-Wei':'吳俊偉',
  'Yu-Hsien Chu':'朱育賢','Chu Yu-hsien':'朱育賢','Chu Yu-Hsien':'朱育賢',
  'Kai-Wei Li':'李凱威','Li Kai-wei':'李凱威','Li Kai-Wei':'李凱威',
  'Lin Li':'林立','Li Lin':'林立',
  'Chieh-Kai Pan':'潘傑楷','Pan Chieh-kai':'潘傑楷','Pan Chieh-Kai':'潘傑楷',
  'Tung-Hua Yueh':'岳東華','Yueh Tung-hua':'岳東華','Yueh Tung-Hua':'岳東華',
  'Chih-Cheng Chiu':'邱智呈','Chiu Chih-cheng':'邱智呈','Chiu Chih-Cheng':'邱智呈',
  'Sung-En Tseng':'曾頌恩','Tseng Sung-en':'曾頌恩','Tseng Sung-En':'曾頌恩'
};
function internationalTeamEnglish(v){
  const raw=clean(v);
  return INTERNATIONAL_TEAM_EN[raw]||raw;
}
function internationalZhName(v){
  const raw=clean(v);
  const direct=INTERNATIONAL_PREFERRED_ZH[raw];
  if(direct) return direct;
  const bag=internationalNameBag(raw);
  if(bag){
    for(const [alias,zh] of Object.entries(INTERNATIONAL_PREFERRED_ZH)){
      if(internationalNameBag(alias)===bag) return zh;
    }
  }
  return '';
}
function internationalMatchTeam(teams, teamName){
  const targetNorm=norm(teamName);
  if(!targetNorm) return null;

  const list=teams||[];

  // Exact matches must win. This prevents abbreviations such as Chile "CHI"
  // from falsely matching "Chinese Taipei".
  for(const t of list){
    const exactNames=[t?.name,t?.teamName,t?.locationName,t?.shortName,t?.abbreviation]
      .map(clean).filter(Boolean);
    if(exactNames.some(name=>norm(name)===targetNorm)) return t;
  }

  // Fuzzy fallback is allowed only on full-name fields, never abbreviations.
  for(const t of list){
    const fullNames=[t?.name,t?.teamName,t?.locationName].map(clean).filter(Boolean);
    if(fullNames.some(name=>{
      const n=norm(name);
      return n.length>=5 && targetNorm.length>=5
        && (n.includes(targetNorm) || targetNorm.includes(n));
    })) return t;
  }

  return null;
}
async function mlbInternationalRoster(competition,y,team){
  const teamName=internationalTeamEnglish(team);
  const teamsData=await getJson(
    MLB_BASE+'/teams?sportId=51&season='+y,
    120000
  );
  const target=internationalMatchTeam(teamsData?.teams||[],teamName);
  if(!target) return {competition,year:y,team:clean(team),source:'mlb-int-team-not-found',players:[]};

  // This is the exact data path used by MLB.com's WBC roster page.
  // Crucial detail: tournament stats are hydrated inside each person with gameType=F.
  const hydrate='person(rosterEntries,education,stats(type=season,season='+y+',sportId=51,teamId='+target.id+',gameType=F))';
  let rosterData=null;
  for(const rosterType of ['active','fullSeason','40Man']){
    try{
      const data=await getJson(
        MLB_BASE+'/teams/'+target.id+'/roster?&hydrate='+hydrate
          +'&rosterType='+rosterType+'&season='+y+'&sportId=51',
        120000
      );
      if((data?.roster||[]).length){rosterData=data;break;}
    }catch(e){
      console.warn('MLB international hydrated roster failed',target.id,y,rosterType,e);
    }
  }
  if(!(rosterData?.roster||[]).length){
    return {competition,year:y,team:clean(team),source:'mlb-int-roster-empty',teamId:String(target.id),players:[]};
  }

  const players=[];
  for(const item of rosterData.roster||[]){
    const person=item?.person||{};
    const id=String(person?.id||'');
    if(!id) continue;

    let hitter=null,pitcher=null;
    for(const block of person?.stats||[]){
      const group=clean(block?.group?.displayName||block?.group?.name||'').toLowerCase();
      for(const split of block?.splits||[]){
        // Ignore a non-WBC split if the API ever hydrates more than one game type.
        const gt=clean(split?.gameType||'');
        if(gt && gt!=='F') continue;
        if(group.includes('hitting')) hitter=mlbHitter(split?.stat);
        if(group.includes('pitching')) pitcher=mlbPitcher(split?.stat);
      }
    }

    const official=clean(person?.fullName||person?.fullFMLName||splitName(person)||'');
    const position=clean(item?.position?.name||person?.primaryPosition?.name||'');
    const isPitcher=/pitcher|投手/i.test(position) || Boolean(pitcher&&!hitter);
    players.push({
      id,
      name:official,
      zhName:internationalZhName(official),
      number:String(item?.jerseyNumber??person?.primaryNumber??''),
      position:position||(isPitcher?'Pitcher':''),
      type:isPitcher?'pitcher':'hitter',
      hitter,
      pitcher
    });
  }

  players.sort((a,b)=>{
    const ap=a.type==='pitcher'?0:1,bp=b.type==='pitcher'?0:1;
    if(ap!==bp) return ap-bp;
    return String(a.number||'').localeCompare(String(b.number||''),'en',{numeric:true});
  });

  return {
    competition,
    year:y,
    team:clean(team),
    source:'mlb-wbc-hydrated-roster',
    teamId:String(target.id),
    teamOfficial:target.name||teamName,
    players
  };
}
function splitName(person){
  const first=clean(person?.firstName||person?.useName||'');
  const last=clean(person?.lastName||'');
  return clean([first,last].filter(Boolean).join(' '));
}


const INTERNATIONAL_WIKI_TEAM_ALIASES = {
  '中華台北':['Chinese Taipei','Taiwan','Chinese Taipei (Taiwan)'],
  '日本':['Japan'],
  '韓國':['South Korea','Korea'],
  '澳洲':['Australia'],
  '捷克':['Czech Republic','Czechia'],
  '美國':['United States','United States of America','USA'],
  '墨西哥':['Mexico'],
  '義大利':['Italy'],
  '英國':['Great Britain','United Kingdom'],
  '巴西':['Brazil'],
  '加拿大':['Canada'],
  '哥倫比亞':['Colombia'],
  '古巴':['Cuba'],
  '巴拿馬':['Panama'],
  '波多黎各':['Puerto Rico'],
  '多明尼加':['Dominican Republic'],
  '以色列':['Israel'],
  '荷蘭':['Netherlands','Kingdom of the Netherlands'],
  '尼加拉瓜':['Nicaragua'],
  '委內瑞拉':['Venezuela'],
  '西班牙':['Spain'],
  '南非':['South Africa'],
  '德國':['Germany'],
  '中國':['China'],
  '法國':['France'],
  '紐西蘭':['New Zealand'],
  '菲律賓':['Philippines'],
  '阿根廷':['Argentina'],
  '巴基斯坦':['Pakistan'],
  '泰國':['Thailand'],
  '香港':['Hong Kong','Hong Kong China'],
  '斯里蘭卡':['Sri Lanka'],
  '新加坡':['Singapore'],
  '巴勒斯坦':['Palestine','State of Palestine'],
  '寮國':['Laos'],
  '印尼':['Indonesia'],
  '蒙古':['Mongolia']
};
function internationalWikiPage(competition,y){
  if(competition==='WBC') return y+'_World_Baseball_Classic_rosters';
  if(competition==='WBCQ'){
    const map={
      2025:'2026_World_Baseball_Classic_qualification_rosters',
      2022:'2023_World_Baseball_Classic_qualification_rosters',
      2016:'2017_World_Baseball_Classic_qualification_rosters',
      2012:'2013_World_Baseball_Classic_qualification_rosters'
    };
    return map[y]||'';
  }
  if(competition==='世界12強' && [2015,2024].includes(y)) return y+'_WBSC_Premier12_rosters';
  return '';
}
function htmlAttrsText(html){
  const attrs=[...String(html||'').matchAll(/\b(?:alt|title)=["']([^"']+)["']/gi)].map(m=>decodeHtml(m[1]));
  return clean(strip(html)+' '+attrs.join(' '));
}
function wikiTeamSection(html,team){
  const aliases=INTERNATIONAL_WIKI_TEAM_ALIASES[clean(team)]||[internationalTeamEnglish(team)];
  const aliasNorms=aliases.map(norm).filter(Boolean);
  const h3=[...String(html||'').matchAll(/<h3\b[^>]*>[\s\S]*?<\/h3>/gi)];
  for(let i=0;i<h3.length;i++){
    const start=h3[i].index;
    const nextH3=i+1<h3.length?h3[i+1].index:html.length;
    const nextH2=html.indexOf('<h2',start+h3[i][0].length);
    const end=(nextH2>start&&nextH2<nextH3)?nextH2:nextH3;
    const section=html.slice(start,end);
    const probe=norm(
      htmlAttrsText(h3[i][0])+' '+
      strip(section.slice(h3[i][0].length,Math.min(section.length,h3[i][0].length+1800)))
    );
    if(aliasNorms.some(a=>a&&(probe.includes(a)||a.includes(probe)))) return section;
    const rawProbe=norm(h3[i][0]);
    if(aliasNorms.some(a=>a&&rawProbe.includes(a))) return section;
  }
  return '';
}
function internationalPositionLabel(v){
  const p=clean(v).toUpperCase().replace(/\./g,'').replace(/\s+/g,'');
  if(['P','RHP','LHP','RP','SP'].includes(p)) return 'Pitcher';
  if(p==='C') return 'Catcher';
  if(['IF','INF'].includes(p)) return 'Infielder';
  if(p==='OF') return 'Outfielder';
  if(p==='DH') return 'Designated Hitter';
  return clean(v);
}
function internationalNameBag(v){
  return clean(v).normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .split(/[^a-z0-9\u3400-\u9fff]+/)
    .filter(Boolean)
    .sort()
    .join('');
}
function parseWikiRosterSection(section,competition,y,team){
  let playerRows=[];
  for(const table of tables(section)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const headers=rs[0].cells.map(x=>norm(x));
    const playerIndex=headers.findIndex(x=>x==='player'||x.startsWith('player')||x==='name'||x.endsWith('name'));
    const posIndex=headers.findIndex(x=>x.startsWith('pos')||x==='position');
    const noIndex=headers.findIndex(x=>x.startsWith('no')||x.includes('number')||x==='#');
    if(playerIndex<0) continue;
    const candidate=rs.slice(1).map(r=>({
      position:posIndex>=0?clean(r.cells[posIndex]||''):'',
      number:noIndex>=0?clean(r.cells[noIndex]||''):'',
      name:clean(r.cells[playerIndex]||'')
        .replace(/^[*†‡\s]+/,'')
        .replace(/\[[^\]]+\]\s*$/,'')
    })).filter(r=>r.name&&!/manager|coach/i.test(r.name));
    if(candidate.length>playerRows.length) playerRows=candidate;
  }
  const seen=new Set();
  const players=[];
  for(const row of playerRows){
    const key=norm(row.name);
    if(!key||seen.has(key)) continue;
    seen.add(key);
    const position=internationalPositionLabel(row.position);
    const isPitcher=/pitcher|投手/i.test(position)||/^(p|rhp|lhp|rp|sp)$/i.test(clean(row.position));
    players.push({
      id:['WIKI',competition,y,norm(team),key].join('-'),
      name:row.name,
      zhName:internationalZhName(row.name),
      number:row.number,
      position,
      type:isPitcher?'pitcher':'hitter',
      hitter:null,
      pitcher:null
    });
  }
  return players;
}
async function wikipediaInternationalRoster(competition,y,team){
  const page=internationalWikiPage(competition,y);
  if(!page) return {competition,year:y,team:clean(team),source:'wikipedia-unavailable',players:[]};
  const data=await getJson(
    'https://en.wikipedia.org/w/api.php?action=parse&page='+encodeURIComponent(page)+'&prop=text&format=json&origin=*',
    300000
  );
  const html=String(data?.parse?.text?.['*']||'');
  const section=wikiTeamSection(html,team);
  const players=section?parseWikiRosterSection(section,competition,y,team):[];
  return {competition,year:y,team:clean(team),source:'wikipedia-roster',players};
}
function mergeInternationalRoster(primary,fallback){
  const p=Array.isArray(primary?.players)?primary.players:[];
  const f=Array.isArray(fallback?.players)?fallback.players:[];
  if(!f.length) return primary;
  if(!p.length) return fallback;

  const byNorm=new Map();
  const byBag=new Map();
  for(const player of p){
    const n=norm(player.name||'');
    const b=internationalNameBag(player.name||'');
    if(n) byNorm.set(n,player);
    if(b) byBag.set(b,player);
  }

  const merged=f.map(player=>{
    const match=byNorm.get(norm(player.name||''))||byBag.get(internationalNameBag(player.name||''));
    if(!match) return player;
    return {
      ...player,
      id:match.id||player.id,
      name:match.name||player.name,
      zhName:match.zhName||player.zhName||'',
      number:match.number||player.number||'',
      position:match.position||player.position||'',
      type:match.type||player.type,
      hitter:match.hitter||player.hitter||null,
      pitcher:match.pitcher||player.pitcher||null
    };
  });

  const seen=new Set(merged.map(x=>internationalNameBag(x.name||'')).filter(Boolean));
  for(const player of p){
    const b=internationalNameBag(player.name||'');
    if(b&&seen.has(b)) continue;
    merged.push(player);
    if(b) seen.add(b);
  }

  return {
    ...primary,
    source:String(primary?.source||'primary')+'+wikipedia',
    players:merged
  };
}

const PREMIER12_2019_NPB_SUFFIX = {
  '中華台北':'tpe',
  '日本':'jpn',
  '韓國':'kor',
  '澳洲':'aus',
  '加拿大':'can',
  '古巴':'cub',
  '多明尼加':'dom',
  '墨西哥':'mex',
  '荷蘭':'ned',
  '波多黎各':'pri',
  '美國':'usa',
  '委內瑞拉':'ven'
};
function normalizeTpeLegacyName(v){
  return clean(v)
    .replace(/呉/g,'吳')
    .replace(/曽/g,'曾')
    .replace(/黄/g,'黃')
    .replace(/徳/g,'德')
    .replace(/勲/g,'勳')
    .replace(/厳/g,'嚴');
}
function npbRomanDisplay(v){
  const s=clean(v);
  if(!s.includes(',')) return s.replace(/\b([A-Z])([A-Z]+)\b/g,(_,a,b)=>a+b.toLowerCase());
  const parts=s.split(',');
  const last=clean(parts.shift()||'').replace(/\b([A-Z])([A-Z]+)\b/g,(_,a,b)=>a+b.toLowerCase());
  const first=clean(parts.join(',')).replace(/\b([A-Z])([A-Z]+)\b/g,(_,a,b)=>a+b.toLowerCase());
  return clean(first+' '+last);
}
async function premier12NpbRoster2019(team){
  const suffix=PREMIER12_2019_NPB_SUFFIX[clean(team)]||'';
  if(!suffix) return {competition:'世界12強',year:2019,team:clean(team),source:'npb-premier12-2019',players:[]};
  const html=await getText('https://premier.npb.jp/2019/jp/roster_'+suffix+'.html',300000);
  const tr=[...String(html||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  let currentPosition='';
  const players=[];
  const seen=new Set();

  for(const m of tr){
    const cellHtml=[...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(x=>x[1]);
    const cells=cellHtml.map(strip).map(clean);
    if(cells.length<4) continue;
    if(cells.some(x=>/監督|コーチ|manager|coach/i.test(x))) continue;
    if(cells.some(x=>/背番号|生年月日|氏名/.test(x))) continue;

    let offset=0;
    const posRaw=clean(cells[0]||'');
    if(/投|捕|内野|外野|pitcher|catcher|infielder|outfielder/i.test(posRaw)){
      currentPosition=posRaw;
      offset=1;
    }
    if(!currentPosition) continue;

    const number=clean(cells[offset]||'');
    const localName=clean(cells[offset+1]||'');
    const roman=clean(cells[offset+2]||'');
    if(!number||!localName||!roman) continue;
    if(!/^\d+$/.test(number)) continue;

    const position=/投/.test(currentPosition)?'Pitcher':
      /捕/.test(currentPosition)?'Catcher':
      /内野/.test(currentPosition)?'Infielder':
      /外野/.test(currentPosition)?'Outfielder':internationalPositionLabel(currentPosition);
    const isPitcher=position==='Pitcher';
    const romanName=npbRomanDisplay(roman);
    const zhPreferred=internationalZhName(romanName)||internationalZhName(roman);
    const displayName=clean(team)==='中華台北'
      ? normalizeTpeLegacyName(localName)
      : (romanName||localName);
    const key=internationalNameBag(romanName||displayName);
    if(!key||seen.has(key)) continue;
    seen.add(key);
    players.push({
      id:['NPB','P12','2019',norm(team),key].join('-'),
      name:displayName,
      zhName:zhPreferred||(clean(team)==='中華台北'?normalizeTpeLegacyName(localName):''),
      number,
      position,
      type:isPitcher?'pitcher':'hitter',
      hitter:null,
      pitcher:null
    });
  }

  return {competition:'世界12強',year:2019,team:clean(team),source:'npb-premier12-2019',players};
}
async function premier12Roster(y,team){
  if(y===2019) return await premier12NpbRoster2019(team);
  return await wikipediaInternationalRoster('世界12強',y,team);
}

const CURRENT_ASIAN_TEAM_CATALOG = {
  'U18亞青:2026':['日本','菲律賓','香港','斯里蘭卡','中華台北','韓國','泰國','新加坡'],
  '亞洲運動會:2026':['日本','中國','菲律賓','巴勒斯坦','中華台北','韓國','香港','泰國'],
  '亞錦賽:2025':['日本','中國','菲律賓','巴基斯坦','中華台北','韓國','香港','巴勒斯坦']
};
const BR_TEAM_ZH = {
  'taiwan':'中華台北','chinese taipei':'中華台北',
  'japan':'日本','south korea':'韓國','korea':'韓國',
  'china':'中國',"people's republic of china":'中國','peoples republic of china':'中國',
  'hong kong':'香港','hong kong china':'香港',
  'philippines':'菲律賓','pakistan':'巴基斯坦','palestine':'巴勒斯坦','state of palestine':'巴勒斯坦',
  'thailand':'泰國','sri lanka':'斯里蘭卡','singapore':'新加坡','laos':'寮國','indonesia':'印尼','mongolia':'蒙古',
  'australia':'澳洲','cuba':'古巴','united states':'美國','usa':'美國','mexico':'墨西哥','canada':'加拿大'
};
function internationalTeamChinese(v){
  const raw=clean(v).replace(/\[edit\]/ig,'').replace(/\s+/g,' ').trim();
  return BR_TEAM_ZH[raw.toLowerCase()]||raw;
}
function staticRoster(entries,competition,y,team,source='static-published-roster'){
  return {
    competition,year:y,team:clean(team),source,
    players:(entries||[]).map((e,i)=>{
      const name=clean(e[0]),position=internationalPositionLabel(e[1]||''),number=clean(e[2]||'');
      const type=/pitcher|投手/i.test(position)||/^(p|rhp|lhp|sp|rp)$/i.test(clean(e[1]||''))?'pitcher':'hitter';
      return {
        id:['INT',competition,y,norm(team),i+1,norm(name)].join('-'),
        name,zhName:/[\u3400-\u9fff]/.test(name)?name:internationalZhName(name),
        number,position,type,hitter:null,pitcher:null
      };
    })
  };
}
const U18_2026_STATIC_ROSTERS = {
  '中華台北':[
    ['吳昊翔','Pitcher'],['鄭品紳','Pitcher'],['吳杰叡','Pitcher'],['楊曜丞','Pitcher'],['蔡辰瀧','Pitcher'],['劉任右','Pitcher'],['陳昱勛','Pitcher'],
    ['顏浩恩','Catcher'],['黃世堯','Catcher'],
    ['陳耀杰','Infielder'],['陳柏凱','Infielder'],['張乙安','Infielder'],['邱聖安','Infielder'],['全永樂','Infielder'],
    ['帕蘇拉．塔基斯利尼安','Outfielder'],['劉桓宇','Outfielder'],['胡辰睿','Outfielder'],['高邱聖紘','Outfielder']
  ],
  '日本':[
    ['織田翔希','Pitcher','11'],['門倉昂大','Pitcher','13'],['前田侑大','Pitcher','14'],['鈴木悠悟','Pitcher','16'],['萬谷堅心','Pitcher','17'],['末吉良丞','Pitcher','18'],['小林鉄三郎','Pitcher','19'],['杉本真滉','Pitcher','21'],
    ['山田凜虎','Catcher','2'],['角谷哲人','Catcher','12'],['杉本将吾','Catcher','27'],
    ['小野舜友','Infielder','1'],['井口瑛太','Infielder','4'],['川上慧','Infielder','5'],['池田聖摩','Infielder','6'],['福島陽奈汰','Infielder','7'],
    ['石田雄星','Outfielder','8'],['梶山侑孜','Outfielder','9']
  ],
  '韓國':[
    ['하현승','Pitcher'],['윤예성','Pitcher'],['박근서','Pitcher'],['김민훈','Pitcher'],['곽도현','Pitcher'],['한규민','Pitcher'],
    ['원지우','Catcher'],['전영훈','Catcher'],
    ['엄준상','Infielder'],['이호민','Infielder'],['남현우','Infielder'],['강인규','Infielder'],['우주로','Infielder'],['안우석','Infielder'],
    ['박보승','Outfielder'],['장민제','Outfielder'],['조희성','Outfielder'],['황성현','Outfielder']
  ]
};
const U18_2026_TPE_WBSC_PLAYERS = {
  '張乙安':{id:'789611',name:'CHANG Yi-An'},
  '陳耀杰':{id:'789639',name:'CHEN YAO-JIE'},
  '陳昱勛':{id:'789613',name:'CHEN YU-HSUN'},
  '陳柏凱':{id:'789624',name:'CHEN BAI-KAI'},
  '鄭品紳':{id:'789642',name:'CHENG Pin-Shen'},
  '邱聖安':{id:'789643',name:'CHIU Sheng-An'},
  '全永樂':{id:'789616',name:'CHUAN YUNG-LE'},
  '高邱聖紘':{id:'789411',name:'GAO CHIU SHENG-HUNG'},
  '胡辰睿':{id:'789615',name:'HU CHEN-JUI'},
  '黃世堯':{id:'789625',name:'HUANG Shih-Yao'},
  '劉桓宇':{id:'789622',name:'LIU HUAN-YU'},
  '劉任右':{id:'789409',name:'LIU Jen-Yu'},
  '帕蘇拉．塔基斯利尼安':{id:'789623',name:'TAKISLINIAN Pasula'},
  '蔡辰瀧':{id:'789609',name:'TSAI CHENG-LUNG'},
  '吳昊翔':{id:'789638',name:'WU Hao-Siang'},
  '吳杰叡':{id:'789637',name:'WU CHIEH-JUI'},
  '楊曜丞':{id:'789640',name:'YANG Yao-Cheng'},
  '顏浩恩':{id:'789612',name:'YEN HAO-EN'}
};

const ASIAN_GAMES_2026_STATIC_ROSTERS = {
  '中華台北':[
    ['徐若熙','Pitcher'],['古林睿煬','Pitcher'],['孫易磊','Pitcher'],['王彥程','Pitcher'],['莊陳仲敖','Pitcher'],['林昱珉','Pitcher'],['潘文輝','Pitcher'],['林佾葳','Pitcher'],['王宇傑','Pitcher'],['郭子銓','Pitcher'],['王政浩','Pitcher'],
    ['張翔','Catcher'],['蔡瑋泰','Catcher'],
    ['陳敏賜','Infielder'],['高育瑋','Infielder'],['李亦崴','Infielder'],['黃韋盛','Infielder'],['鄭宗哲','Infielder'],['林雨力','Infielder'],['劉基鴻','Infielder'],
    ['陳晨威','Outfielder'],['朱迦恩','Outfielder'],['楊振裕','Outfielder'],['陳孝允','Outfielder']
  ],
  '日本':[
    ['近藤壱来','Pitcher'],['樋口新','Pitcher'],['嘉陽宗一郎','Pitcher'],['加藤三範','Pitcher'],['渕上佳輝','Pitcher'],['長野健大','Pitcher'],['秋山翔','Pitcher'],['松田航瑠','Pitcher'],['松田賢大','Pitcher'],
    ['有馬諒','Catcher'],['辻本勇樹','Catcher'],['福井章吾','Catcher'],
    ['矢野幸耶','Infielder'],['和田佳大','Infielder'],['添田真海','Infielder'],['熊田任洋','Infielder'],['山田健太','Infielder'],['佐藤勇基','Infielder'],['丸山壮史','Infielder'],
    ['柴崎聖人','Outfielder'],['向山基生','Outfielder'],['逢澤崚介','Outfielder'],['藤澤涼介','Outfielder'],['水谷祥平','Outfielder']
  ],
  '韓國':[
    ['김영우','Pitcher'],['조병현','Pitcher'],['배찬승','Pitcher'],['박영현','Pitcher'],['소형준','Pitcher'],['오원석','Pitcher'],['최준용','Pitcher'],['김진욱','Pitcher'],['성영탁','Pitcher'],['곽빈','Pitcher'],['최민석','Pitcher'],
    ['조형우','Catcher'],['김건희','Catcher'],
    ['문보경','Infielder'],['노시환','Infielder'],['정준재','Infielder'],['이재현','Infielder'],['김주원','Infielder'],['김도영','Infielder'],['박준순','Infielder'],
    ['문현빈','Outfielder'],['김지찬','Outfielder'],['윤동희','Outfielder'],['박재현','Outfielder']
  ]
};
function brRosterSlug(competition,y){
  if(competition==='亞洲運動會'){
    const pageYear=y===2023?2022:y;
    return pageYear+'_Asian_Games_(Rosters)';
  }
  if(competition==='亞錦賽') return y+'_Asian_Championship_(Rosters)';
  return '';
}
async function brRosterHtml(competition,y){
  const slug=brRosterSlug(competition,y);
  if(!slug) return '';
  return await getText('https://www.baseball-reference.com/bullpen/'+encodeURIComponent(slug).replace(/%2F/g,'/'),300000);
}
function brHeadingInfo(html){
  const hs=[...String(html||'').matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  return hs.map((m,i)=>{
    const name=clean(strip(m[1])).replace(/\[edit\]/ig,'').trim();
    const start=m.index+m[0].length;
    const end=i+1<hs.length?hs[i+1].index:html.length;
    return {name,start,end,html:html.slice(start,end)};
  }).filter(x=>x.name && !/contents|references|external links|see also/i.test(x.name));
}
function brSectionForTeam(html,team){
  const aliases=INTERNATIONAL_WIKI_TEAM_ALIASES[clean(team)]||[internationalTeamEnglish(team),team];
  const target=aliases.map(norm).filter(Boolean);
  return brHeadingInfo(html).find(h=>{
    const n=norm(h.name);
    return target.some(a=>a&&(n===a||n.includes(a)||a.includes(n)));
  })||null;
}
function brRosterPlayers(section,competition,y,team){
  if(!section) return [];
  const li=[...String(section.html||'').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m=>clean(strip(m[1])));
  const players=[];
  const seen=new Set();
  for(const text of li){
    if(!text||/manager|coach|trainer|director|delegation|physio/i.test(text)) continue;
    const parts=text.split(',').map(clean).filter(Boolean);
    if(parts.length<2) continue;
    const posRaw=parts[parts.length-1].toUpperCase().replace(/\./g,'').trim();
    if(!/^(P|C|IF|OF|UT|DH|PH|1B|2B|3B|SS|LF|CF|RF|LHP|RHP|SP|RP)$/.test(posRaw)) continue;
    const name=parts.slice(0,-1).join(', ').trim();
    const key=norm(name);
    if(!key||seen.has(key)) continue;
    seen.add(key);
    const position=internationalPositionLabel(posRaw);
    players.push({
      id:['BR',competition,y,norm(team),key].join('-'),
      name,zhName:internationalZhName(name),number:'',position,
      type:/^(P|LHP|RHP|SP|RP)$/.test(posRaw)?'pitcher':'hitter',
      hitter:null,pitcher:null
    });
  }
  return players;
}
async function brInternationalTeams(competition,y){
  const html=await brRosterHtml(competition,y);
  if(!html) return [];
  const names=brHeadingInfo(html).map(h=>internationalTeamChinese(h.name)).filter(Boolean);
  return [...new Set(names)].filter(n=>!/^rosters?$/i.test(n));
}
async function brInternationalRoster(competition,y,team){
  const html=await brRosterHtml(competition,y);
  const section=brSectionForTeam(html,team);
  return {competition,year:y,team:clean(team),source:'baseball-reference-bullpen',players:brRosterPlayers(section,competition,y,team)};
}
function wbscU18LocalZhName(y,team,playerId,officialName){
  if(y===2026 && clean(team)==='中華台北'){
    const id=clean(playerId);
    for(const [zh,item] of Object.entries(U18_2026_TPE_WBSC_PLAYERS)){
      if(id && clean(item?.id)===id) return zh;
      if(internationalPlayerNameMatch(item?.name||'',officialName)) return zh;
    }
  }
  return internationalZhName(officialName);
}
function wbscU18TeamIdFromTeamsPage(html,team){
  const trs=[...String(html||'').matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]);
  for(const tr of trs){
    const id=clean((tr.match(/\/teams\/(\d+)/i)||[])[1]||'');
    if(!id) continue;
    const label=clean(strip(tr));
    if(internationalTeamCellMatch(label,team)) return id;
  }
  return '';
}
function wbscU18RosterPlayers(html,y,team){
  const out=[];
  const seen=new Set();
  const trs=[...String(html||'').matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]);
  for(const tr of trs){
    const playerId=clean((tr.match(/\/players\/(\d+)/i)||[])[1]||'');
    if(!playerId) continue;
    const cells=[...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(strip(m[1])));
    if(cells.length<3) continue;

    const number=clean(cells[0]).replace(/^#\s*/,'');
    const officialName=clean(cells[1]);
    const posRaw=clean(cells[2]).toUpperCase();
    if(!officialName) continue;

    const key=playerId||norm(officialName);
    if(seen.has(key)) continue;
    seen.add(key);

    const zhName=wbscU18LocalZhName(y,team,playerId,officialName);
    const type=/^P$/.test(posRaw)?'pitcher':'hitter';
    out.push({
      id:playerId,
      name:officialName,
      zhName,
      number,
      position:posRaw||'',
      type,
      hitter:null,
      pitcher:null
    });
  }
  return out;
}
async function wbscU18LiveRoster(y,team){
  if(y!==2026) return {competition:'U18亞青',year:y,team:clean(team),source:'wbsc-asia',players:[]};

  const base='https://www.wbscasia.org/en/events/2026-bfa-xiv-u18-championship';
  let teamsHtml='';
  try{
    teamsHtml=await getText(base+'/teams',30000);
  }catch(e){
    console.warn('WBSC U18 teams page unavailable',e);
    return {competition:'U18亞青',year:y,team:clean(team),source:'wbsc-asia-unavailable',players:[]};
  }

  const teamId=wbscU18TeamIdFromTeamsPage(teamsHtml,team);
  if(!teamId){
    return {competition:'U18亞青',year:y,team:clean(team),source:'wbsc-asia-team-not-found',players:[]};
  }

  let rosterHtml='';
  try{
    rosterHtml=await getText(base+'/teams/'+teamId,30000);
  }catch(e){
    console.warn('WBSC U18 roster page unavailable',teamId,e);
    return {competition:'U18亞青',year:y,team:clean(team),source:'wbsc-asia-roster-unavailable',players:[]};
  }

  const players=wbscU18RosterPlayers(rosterHtml,y,team);
  return {
    competition:'U18亞青',
    year:y,
    team:clean(team),
    teamId,
    source:'wbsc-asia-roster',
    sourceUrl:base+'/teams/'+teamId,
    players
  };
}


async function wbscOfficialInternationalRoster(competition,y,team){
  const comp=clean(competition),t=clean(team);
  const base=await resolveWbscEventBase(comp,y);
  if(!base) return {competition:comp,year:y,team:t,source:'wbsc-roster-unavailable',players:[]};

  let teamsHtml='';
  try{
    teamsHtml=await getText(base+'/teams',30000);
  }catch(e){
    console.warn('WBSC teams page unavailable',comp,y,e);
    return {competition:comp,year:y,team:t,source:'wbsc-roster-unavailable',players:[]};
  }

  const teamId=wbscU18TeamIdFromTeamsPage(teamsHtml,t);
  if(!teamId){
    return {competition:comp,year:y,team:t,source:'wbsc-team-not-found',players:[]};
  }

  let rosterHtml='';
  try{
    rosterHtml=await getText(base+'/teams/'+teamId,30000);
  }catch(e){
    console.warn('WBSC roster page unavailable',comp,y,teamId,e);
    return {competition:comp,year:y,team:t,source:'wbsc-roster-unavailable',players:[]};
  }

  const players=wbscU18RosterPlayers(rosterHtml,y,t);
  return {
    competition:comp,
    year:y,
    team:t,
    teamId,
    source:base.includes('wbscasia.org')?'wbsc-asia-roster':'wbsc-roster',
    sourceUrl:base+'/teams/'+teamId,
    players
  };
}

function mergeOfficialRosterWithFallback(official,fallback){
  const o=Array.isArray(official?.players)?official.players:[];
  const f=Array.isArray(fallback?.players)?fallback.players:[];
  if(!o.length) return fallback;
  if(!f.length) return official;

  const byId=new Map(o.map(p=>[clean(p?.id),p]).filter(([id])=>id));
  const byBag=new Map(o.map(p=>[internationalNameBag(p?.name||''),p]).filter(([b])=>b));

  const merged=o.map(player=>{
    const fallbackPlayer=f.find(p=>{
      const id=clean(p?.id);
      if(id && byId.get(id)===player) return true;
      return internationalNameBag(p?.name||'')===internationalNameBag(player?.name||'')
        || internationalPlayerNameMatch(p?.name||'',player?.name||'');
    });
    if(!fallbackPlayer) return player;
    return {
      ...fallbackPlayer,
      ...player,
      zhName:player.zhName||fallbackPlayer.zhName||'',
      number:player.number||fallbackPlayer.number||'',
      position:player.position||fallbackPlayer.position||'',
      type:player.type||fallbackPlayer.type,
      hitter:fallbackPlayer.hitter||player.hitter||null,
      pitcher:fallbackPlayer.pitcher||player.pitcher||null,
      games:Array.isArray(fallbackPlayer.games)?fallbackPlayer.games:(player.games||[])
    };
  });

  return {
    ...official,
    source:String(official?.source||'official-roster')+(fallback?.source?'+fallback':''),
    players:merged
  };
}

/* ---------- International player tournament stats ---------- */
const WBC_MLB_TEAM_SLUG = {
  '中華台北':'chinese-taipei','日本':'japan','韓國':'korea','澳洲':'australia','捷克':'czech-republic',
  '美國':'united-states','墨西哥':'mexico','義大利':'italy','英國':'great-britain','巴西':'brazil',
  '加拿大':'canada','哥倫比亞':'colombia','古巴':'cuba','巴拿馬':'panama','波多黎各':'puerto-rico',
  '多明尼加':'dominican-republic','以色列':'israel','荷蘭':'netherlands','尼加拉瓜':'nicaragua',
  '委內瑞拉':'venezuela','西班牙':'spain','南非':'south-africa','德國':'germany','中國':'china',
  '法國':'france','紐西蘭':'new-zealand','菲律賓':'philippines','阿根廷':'argentina','巴基斯坦':'pakistan'
};
const INTERNATIONAL_TEAM_CODES = {
  '中華台北':['TPE','CHINESE TAIPEI','TAIWAN'],
  '日本':['JPN','JAPAN'],'韓國':['KOR','KOREA','SOUTH KOREA'],'澳洲':['AUS','AUSTRALIA'],
  '捷克':['CZE','CZECHIA','CZECH REPUBLIC'],'美國':['USA','UNITED STATES','UNITED STATES OF AMERICA'],
  '墨西哥':['MEX','MEXICO'],'義大利':['ITA','ITALY'],'英國':['GBR','GREAT BRITAIN','UNITED KINGDOM'],
  '巴西':['BRA','BRAZIL'],'加拿大':['CAN','CANADA'],'哥倫比亞':['COL','COLOMBIA'],'古巴':['CUB','CUBA'],
  '巴拿馬':['PAN','PANAMA'],'波多黎各':['PUR','PRI','PUERTO RICO'],'多明尼加':['DOM','DOMINICAN REPUBLIC'],
  '以色列':['ISR','ISRAEL'],'荷蘭':['NED','NETHERLANDS','KINGDOM OF THE NETHERLANDS'],
  '尼加拉瓜':['NCA','NIC','NICARAGUA'],'委內瑞拉':['VEN','VENEZUELA'],'西班牙':['ESP','SPAIN'],
  '南非':['RSA','SOUTH AFRICA'],'德國':['GER','GERMANY'],'中國':['CHN','CHINA'],
  '香港':['HKG','HONG KONG','HONG KONG CHINA'],'菲律賓':['PHI','PHILIPPINES'],'斯里蘭卡':['SRI','SRI LANKA'],
  '新加坡':['SGP','SIN','SINGAPORE'],'泰國':['THA','THAILAND'],'巴基斯坦':['PAK','PAKISTAN'],
  '巴勒斯坦':['PLE','PAL','PALESTINE'],'寮國':['LAO','LAOS'],'印尼':['INA','INDONESIA'],'蒙古':['MGL','MONGOLIA']
};
function headerIndex(headers,...labels){
  const hs=(headers||[]).map(norm);
  for(const label of labels){
    const n=norm(label);
    let i=hs.findIndex(x=>x===n);
    if(i>=0) return i;
  }
  for(const label of labels){
    const n=norm(label);
    let i=hs.findIndex(x=>x&&n&&(x.startsWith(n)||x.endsWith(n)));
    if(i>=0) return i;
  }
  for(const label of labels){
    const n=norm(label);
    let i=hs.findIndex(x=>x&&n&&x.includes(n));
    if(i>=0) return i;
  }
  return -1;
}
function tableCell(row,headers,...labels){
  const i=headerIndex(headers,...labels);
  return i>=0 && i<row.length ? row[i] : '';
}
function nameTokens(v){
  return clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().split(/[^a-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/)
    .map(x=>norm(x)).filter(x=>x.length>=2);
}
function internationalPlayerNameMatch(candidate,target){
  const a=norm(candidate),b=norm(target);
  if(!a||!b) return false;
  if(a===b||a.includes(b)||b.includes(a)) return true;
  const ta=nameTokens(target);
  if(ta.length && ta.every(t=>a.includes(t))) return true;
  const ca=nameTokens(candidate);
  if(ca.length && ca.every(t=>b.includes(t))) return true;
  return false;
}
function internationalTeamCellMatch(value,team){
  const v=norm(value);
  if(!v) return true;
  const aliases=INTERNATIONAL_TEAM_CODES[clean(team)]||[internationalTeamEnglish(team),team];
  return aliases.some(a=>{
    const n=norm(a);
    return n && (v===n||v.includes(n)||n.includes(v));
  });
}
function findStatRow(html,kind,playerName,team){
  for(const table of tables(html)){
    const rs=rows(table);
    if(rs.length<2) continue;
    const headers=rs[0].cells;
    const hasPlayer=headerIndex(headers,'Player','Name')>=0;
    const hitterTable=headerIndex(headers,'AB')>=0 && headerIndex(headers,'H')>=0 && headerIndex(headers,'HR')>=0;
    const pitcherTable=headerIndex(headers,'IP')>=0 && headerIndex(headers,'ER')>=0 && headerIndex(headers,'SO','K')>=0;
    if(!hasPlayer || (kind==='hitter'?!hitterTable:!pitcherTable)) continue;
    const pi=headerIndex(headers,'Player','Name');
    const ti=headerIndex(headers,'Team');
    let fallback=null;
    for(const r of rs.slice(1)){
      const candidate=clean(r.cells[pi]||'');
      if(!internationalPlayerNameMatch(candidate,playerName)) continue;
      if(ti<0 || internationalTeamCellMatch(r.cells[ti]||'',team)) return {row:r.cells,headers};
      fallback ||= {row:r.cells,headers};
    }
    if(fallback) return fallback;
  }
  return null;
}
function tableHitterStats(found){
  if(!found) return null;
  const {row,headers}=found;
  const ab=num(tableCell(row,headers,'AB'));
  const runs=num(tableCell(row,headers,'R'));
  const h=num(tableCell(row,headers,'H'));
  const d=num(tableCell(row,headers,'2B'));
  const t=num(tableCell(row,headers,'3B'));
  const hr=num(tableCell(row,headers,'HR'));
  const bb=num(tableCell(row,headers,'BB'));
  const hbp=num(tableCell(row,headers,'HBP','HP','HB'));
  const sf=num(tableCell(row,headers,'SF'));
  const sh=num(tableCell(row,headers,'SH','SAC'));
  const ibb=num(tableCell(row,headers,'IBB'));
  return {
    pa:ab+bb+hbp+sf+sh,
    ab,runs,hits:h,single:singles(h,d,t,hr),double:d,triple:t,hr,
    rbi:num(tableCell(row,headers,'RBI')),bb,ibb,hbp,sacBunt:sh,sacFly:sf,
    k:num(tableCell(row,headers,'SO','K')),
    avg:num(tableCell(row,headers,'AVG')),
    obp:num(tableCell(row,headers,'OBP','OB%')),
    slg:num(tableCell(row,headers,'SLG','SLG%'))
  };
}
function tablePitcherStats(found){
  if(!found) return null;
  const {row,headers}=found;
  const ip=clean(tableCell(row,headers,'IP'));
  const outs=ipToOuts(ip);
  const h=num(tableCell(row,headers,'H'));
  const bb=num(tableCell(row,headers,'BB'));
  const er=num(tableCell(row,headers,'ER'));
  return {
    outs,innings:outsToIp(outs),h,bb,
    hbp:num(tableCell(row,headers,'HBP','HB','HP')),
    k:num(tableCell(row,headers,'SO','K')),
    r:num(tableCell(row,headers,'R')),
    er,w:num(tableCell(row,headers,'W')),l:num(tableCell(row,headers,'L')),
    sv:num(tableCell(row,headers,'SV')),hld:num(tableCell(row,headers,'HLD')),
    bsv:num(tableCell(row,headers,'BS','BSV')),
    cg:num(tableCell(row,headers,'CG')),sho:num(tableCell(row,headers,'SHO')),
    era:num(tableCell(row,headers,'ERA')),
    whip:num(tableCell(row,headers,'WHIP')) || (outs?(h+bb)/(outs/3):0)
  };
}
async function firstUsefulHtml(urls,kind){
  for(const url of urls){
    try{
      const html=await getText(url,90000);
      if(!html) continue;
      const plain=norm(strip(html.slice(0,250000)));
      if(kind==='hitter' && plain.includes('player') && plain.includes('ab') && plain.includes('rbi')) return {html,url};
      if(kind==='pitcher' && plain.includes('player') && plain.includes('ip') && plain.includes('era')) return {html,url};
    }catch{}
  }
  return null;
}
async function mlbWebInternationalStats(competition,y,team,playerName){
  const slug=WBC_MLB_TEAM_SLUG[clean(team)]||clean(internationalTeamEnglish(team)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!slug) return {source:'mlb-wbc-web',hitter:null,pitcher:null};
  const hitUrls=[
    'https://www.mlb.com/world-baseball-classic/stats/'+slug+'/'+y,
    'https://www.mlb.com/world-baseball-classic/stats/'+slug+'/player/'+y,
    'https://www.mlb.com/world-baseball-classic/stats/'+slug
  ];
  const pitUrls=[
    'https://www.mlb.com/world-baseball-classic/stats/pitching/'+slug+'/'+y,
    'https://www.mlb.com/world-baseball-classic/stats/pitching/'+slug+'/player/'+y,
    'https://www.mlb.com/world-baseball-classic/stats/pitching/'+slug
  ];
  const [hh,ph]=await Promise.all([
    firstUsefulHtml(hitUrls,'hitter'),
    firstUsefulHtml(pitUrls,'pitcher')
  ]);
  return {
    source:'mlb-wbc-web',
    sourceUrl:hh?.url||ph?.url||'',
    hitter:hh?tableHitterStats(findStatRow(hh.html,'hitter',playerName,team)):null,
    pitcher:ph?tablePitcherStats(findStatRow(ph.html,'pitcher',playerName,team)):null
  };
}
function romanNumeral(n){
  const map=[[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
  let x=n,out=''; for(const [v,s] of map){while(x>=v){out+=s;x-=v}} return out;
}
function asianChampEdition(y){
  const known={2025:31,2023:30,2019:29,2017:28,2015:27,2012:26,2009:25,2007:24,2005:23,2003:22,2001:21};
  return known[y]||0;
}
function wbscEventCandidates(competition,y){
  const out=[];
  if(competition==='世界12強'){
    out.push('https://federation-staging-0.wbsc.org/en/events/'+y+'-premier12');
    out.push('https://www.wbsc.org/en/events/'+y+'-premier12');
  }else if(competition==='U18亞青'){
    if(y===2026) out.push('https://www.wbscasia.org/en/events/2026-bfa-xiv-u18-championship');
    out.push('https://www.wbscasia.org/en/events/'+y+'-bfa-u18-asian-baseball-championship');
    out.push('https://www.wbscasia.org/en/events/'+y+'-u18-asian-baseball-championship');
  }else if(competition==='亞洲運動會'){
    if(y===2023){
      out.push('https://www.wbscasia.org/en/events/xix-asian-games-2022-mens-baseball');
      out.push('https://www.wbscasia.org/en/events/2023-hangzhou-19th-asian-games');
      out.push('https://www.wbscasia.org/en/events/2023-19th-asian-games');
    }
    if(y===2026){
      out.push('https://www.wbscasia.org/en/events/2026-xx-aichi-nagoya-asian-games-2026-mens-baseball');
      out.push('https://www.wbscasia.org/en/events/2026-20th-asian-games');
      out.push('https://www.wbscasia.org/en/events/2026-aichi-nagoya-asian-games');
    }
    out.push('https://www.wbscasia.org/en/events/'+y+'-asian-games');
  }else if(competition==='亞錦賽'){
    if(y===2023) out.push('https://www.wbscasia.org/en/events/2023-bfa-xxx-asian-championship');
    if(y===2025) out.push('https://www.wbscasia.org/en/events/2025-asian-baseball-championship');
    const edition=asianChampEdition(y);
    const roman=edition?romanNumeral(edition):'';
    if(roman){
      out.push('https://www.wbscasia.org/en/events/'+y+'-'+roman+'-bfa-asian-baseball-championship');
      out.push('https://www.wbscasia.org/en/events/'+y+'-bfa-'+roman+'-asian-baseball-championship');
      out.push('https://www.wbscasia.org/en/events/'+y+'-'+roman+'-bfa-asian-championship');
    }
    out.push('https://www.wbscasia.org/en/events/'+y+'-bfa-asian-baseball-championship');
    out.push('https://www.wbscasia.org/en/events/'+y+'-asian-baseball-championship');
  }
  return [...new Set(out)];
}
const wbscEventBaseCache=new Map();
async function resolveWbscEventBase(competition,y){
  const key=competition+'|'+y;
  if(wbscEventBaseCache.has(key)) return wbscEventBaseCache.get(key);
  for(const base of wbscEventCandidates(competition,y)){
    for(const suffix of ['/stats','/home','']){
      try{
        const html=await getText(base+suffix,120000);
        const p=norm(strip(html.slice(0,180000)));
        if(html.length>4000 && (p.includes('player')||p.includes('roster')||p.includes('standings')||p.includes('schedule'))){
          wbscEventBaseCache.set(key,base);
          return base;
        }
      }catch{}
    }
  }
  wbscEventBaseCache.set(key,'');
  return '';
}
async function wbscStyleInternationalStats(competition,y,team,playerName){
  const base=await resolveWbscEventBase(competition,y);
  if(!base) return {source:'wbsc-event-unavailable',hitter:null,pitcher:null};
  const hitUrls=[base+'/stats?statsSection=batting',base+'/stats'];
  const pitUrls=[base+'/stats?statsSection=pitching'];
  const [hh,ph]=await Promise.all([
    firstUsefulHtml(hitUrls,'hitter'),
    firstUsefulHtml(pitUrls,'pitcher')
  ]);
  return {
    source:base.includes('wbscasia.org')?'wbsc-asia-stats':'wbsc-stats',
    sourceUrl:hh?.url||ph?.url||base,
    hitter:hh?tableHitterStats(findStatRow(hh.html,'hitter',playerName,team)):null,
    pitcher:ph?tablePitcherStats(findStatRow(ph.html,'pitcher',playerName,team)):null
  };
}
function findRosterEntryForStats(roster,playerId,playerName){
  const list=Array.isArray(roster?.players)?roster.players:[];
  const id=clean(playerId);
  return list.find(p=>id && clean(p?.id)===id)
    || list.find(p=>internationalPlayerNameMatch(p?.name||'',playerName)||internationalPlayerNameMatch(p?.zhName||'',playerName))
    || null;
}

/* ---------- Bot-built official international data ---------- */
async function internationalBotDataset(){
  try{
    const data=await getJson(INTERNATIONAL_BOT_DATA_URL,300000);
    return data&&typeof data==='object'?data:{events:{}};
  }catch(e){
    console.warn('international bot dataset unavailable',e);
    return {events:{}};
  }
}
async function internationalBotEvent(competition,year){
  const data=await internationalBotDataset();
  return data?.events?.[clean(competition)+':'+yearOf(year)]||null;
}
function internationalBotTeamKey(event,team){
  if(!event?.teams) return '';
  const candidates=[
    clean(team),
    internationalTeamChinese(team),
    internationalTeamEnglish(team)
  ].map(norm).filter(Boolean);
  for(const key of Object.keys(event.teams||{})){
    const nk=norm(key);
    if(candidates.some(c=>c===nk||c.includes(nk)||nk.includes(c))) return key;
  }
  return '';
}
function internationalBotFindPlayer(players,playerId,playerName){
  const list=Array.isArray(players)?players:[];
  const id=clean(playerId);
  if(id && id.startsWith('bot:')){
    const tail=id.split(':').slice(-1)[0];
    const byId=list.find(p=>norm(p?.name||'')===tail);
    if(byId) return byId;
  }
  return list.find(p=>internationalPlayerNameMatch(p?.name||'',playerName)||internationalPlayerNameMatch(p?.zhName||'',playerName))||null;
}
async function internationalBotRoster(competition,year,team){
  const comp=clean(competition),y=yearOf(year),t=clean(team);
  const event=await internationalBotEvent(comp,y);
  if(!event) return null;
  const teamKey=internationalBotTeamKey(event,t);
  if(!teamKey) return {competition:comp,year:y,team:t,source:'official-data-bot',sourceUrl:event.sourceUrl||'',players:[]};
  const players=(event.teams?.[teamKey]||[]).map(p=>{
    const name=clean(p?.name||'');
    const position=clean(p?.position||'');
    const pitcher=Boolean(p?.pitcher)||/^p(?:\/|$)/i.test(position);
    return {
      id:'bot:'+comp+':'+y+':'+norm(teamKey)+':'+norm(name),
      name,
      zhName:internationalZhName(name),
      number:'',
      position,
      type:pitcher?'pitcher':'hitter',
      hitter:p?.hitter||null,
      pitcher:p?.pitcher||null,
      games:Array.isArray(p?.games)?p.games:[]
    };
  }).filter(p=>p.name);
  return {
    competition:comp,year:y,team:t,
    source:event.source||'official-data-bot',
    sourceUrl:event.sourceUrl||'',
    teamOfficial:teamKey,
    players
  };
}
async function internationalBotPlayerStats(competition,year,team,playerId,playerName){
  const roster=await internationalBotRoster(competition,year,team);
  if(!roster) return null;
  const p=internationalBotFindPlayer(roster.players,playerId,playerName);
  if(!p) return {
    competition:clean(competition),year:yearOf(year),team:clean(team),
    playerId:clean(playerId),playerName:clean(playerName),
    source:roster.source||'official-data-bot',sourceUrl:roster.sourceUrl||'',
    hitter:null,pitcher:null,found:false
  };
  return {
    competition:clean(competition),year:yearOf(year),team:clean(team),
    playerId:clean(playerId)||p.id,playerName:p.name,
    source:roster.source||'official-data-bot',sourceUrl:roster.sourceUrl||'',
    hitter:p.hitter||null,pitcher:p.pitcher||null,found:Boolean(p.hitter||p.pitcher)
  };
}
async function internationalBotPlayerGames(competition,year,team,playerId,playerName){
  const roster=await internationalBotRoster(competition,year,team);
  if(!roster) return null;
  const p=internationalBotFindPlayer(roster.players,playerId,playerName);
  if(!p) return [];
  return (p.games||[]).map(g=>({
    gameId:String(g?.gameId||''),
    date:isoDateOnly(g?.date||''),
    opponent:internationalTeamChinese(g?.opponent||''),
    hitter:g?.hitter||null,
    pitcher:g?.pitcher||null,
    partial:Boolean(g?.partial),
    sources:Array.isArray(g?.sources)?g.sources:[],
    source:g?.source||roster.source||'official-data-bot',
    sourceUrl:g?.sourceUrl||roster.sourceUrl||''
  })).filter(g=>g.date);
}

function aggregateMlbInternationalGames(games){
  const list=Array.isArray(games)?games:[];
  let hitter=null,pitcher=null;

  for(const game of list){
    const h=game?.hitter;
    if(h){
      hitter ||= {
        pa:0,ab:0,runs:0,hits:0,single:0,double:0,triple:0,hr:0,rbi:0,
        bb:0,ibb:0,hbp:0,sacBunt:0,sacFly:0,k:0,errors:0
      };
      for(const key of ['pa','ab','runs','hits','single','double','triple','hr','rbi','bb','ibb','hbp','sacBunt','sacFly','k','errors']){
        hitter[key]+=num(h?.[key]);
      }
    }

    const p=game?.pitcher;
    if(p){
      pitcher ||= {
        outs:0,h:0,bb:0,hbp:0,k:0,r:0,er:0,w:0,l:0,sv:0,hld:0,bsv:0,cg:0,sho:0
      };
      for(const key of ['outs','h','bb','hbp','k','r','er','w','l','sv','hld','bsv','cg','sho']){
        pitcher[key]+=num(p?.[key]);
      }
    }
  }

  if(hitter){
    const ab=hitter.ab||0;
    const pa=hitter.pa||0;
    const tb=hitter.single+hitter.double*2+hitter.triple*3+hitter.hr*4;
    const obDen=ab+hitter.bb+hitter.ibb+hitter.hbp+hitter.sacFly;
    hitter.avg=ab?hitter.hits/ab:0;
    hitter.slg=ab?tb/ab:0;
    hitter.obp=obDen?(hitter.hits+hitter.bb+hitter.ibb+hitter.hbp)/obDen:0;
  }

  if(pitcher){
    pitcher.innings=outsToIp(pitcher.outs);
    pitcher.era=pitcher.outs?(pitcher.er*27/pitcher.outs):0;
    pitcher.whip=pitcher.outs?((pitcher.h+pitcher.bb)/(pitcher.outs/3)):0;
  }

  return {hitter,pitcher};
}

async function internationalPlayerStats(competition,year,team,playerId,playerName){
  const comp=clean(competition),y=yearOf(year),t=clean(team),name=clean(playerName);

  if(comp==='WBC'){
    try{
      const games=await mlbInternationalPlayerGames(comp,y,t,clean(playerId),name);
      const aggregate=aggregateMlbInternationalGames(games);
      if(aggregate.hitter||aggregate.pitcher){
        return {
          competition:comp,year:y,team:t,
          playerId:clean(playerId),playerName:name,
          source:'mlb-wbc-all-round-game-feeds',sourceUrl:'',
          hitter:aggregate.hitter,pitcher:aggregate.pitcher,
          found:true,gameCount:games.length
        };
      }
    }catch(e){console.warn('MLB WBC all-round aggregate failed',e)}
  }

  if(['WBC','世界12強','亞洲運動會','U18亞青','亞錦賽'].includes(comp)){
    try{
      const bot=await internationalBotPlayerStats(comp,y,t,playerId,name);
      if(bot?.found) return bot;
    }catch(e){console.warn('official data bot stats failed',e)}
  }

  let roster=null,entry=null;
  try{
    roster=await internationalRoster(comp,y,t);
    entry=findRosterEntryForStats(roster,playerId,name);
  }catch(e){console.warn('international roster lookup for stats failed',e)}
  let hitter=entry?.hitter||null,pitcher=entry?.pitcher||null;
  let source=roster?.source||'',sourceUrl='';

  if(['WBC','WBCQ'].includes(comp)){
    if(hitter||pitcher){
      source=roster?.source||'mlb-wbc-hydrated-roster';
    }else{
      try{
        const web=await mlbWebInternationalStats(comp,y,t,entry?.name||name);
        hitter=web.hitter||hitter;
        pitcher=web.pitcher||pitcher;
        if(web.hitter||web.pitcher){source=web.source;sourceUrl=web.sourceUrl||'';}
      }catch(e){console.warn('MLB WBC web stats failed',e)}
    }
  }else if(['世界12強','亞洲運動會','U18亞青','亞錦賽'].includes(comp)){
    try{
      const wbsc=await wbscStyleInternationalStats(comp,y,t,entry?.name||name);
      hitter=wbsc.hitter||hitter;
      pitcher=wbsc.pitcher||pitcher;
      if(wbsc.hitter||wbsc.pitcher){source=wbsc.source;sourceUrl=wbsc.sourceUrl||'';}
    }catch(e){console.warn('WBSC style stats failed',e)}
  }

  return {
    competition:comp,year:y,team:t,
    playerId:clean(playerId),playerName:entry?.name||name,
    source:source||'international-stats-unavailable',sourceUrl,
    hitter,pitcher,
    found:Boolean(hitter||pitcher)
  };
}


/* ---------- International player per-game stats ---------- */
function isoDateOnly(v){
  const s=clean(v);
  const m=s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m?m[1]+'-'+m[2]+'-'+m[3]:'';
}
function internationalGameOpponentName(v){
  const raw=clean(v);
  return internationalTeamChinese(raw);
}
function mlbBoxPlayerEntry(feed,playerId,playerName){
  const sides=['away','home'];
  for(const side of sides){
    const players=feed?.liveData?.boxscore?.teams?.[side]?.players||{};
    for(const entry of Object.values(players)){
      const id=String(entry?.person?.id||'');
      const name=clean(entry?.person?.fullName||'');
      if((playerId&&id===String(playerId)) || internationalPlayerNameMatch(name,playerName)) {
        return {side,entry};
      }
    }
  }
  return null;
}
function mlbGamePlateAppearances(feed,playerId,playerName){
  const out=[];
  for(const play of feed?.liveData?.plays?.allPlays||[]){
    const batter=play?.matchup?.batter||{};
    if(!((playerId&&String(batter?.id||'')===String(playerId)) || internationalPlayerNameMatch(batter?.fullName||'',playerName))) continue;
    const result=play?.result||{};
    if(!result?.eventType && !result?.event) continue;
    out.push({
      code:mlbPaCode(result.eventType||''),
      position:'',
      rbi:num(result.rbi),
      officialAction:clean(result.description||result.event||'')
    });
  }
  return out;
}
function mlbGamePitchDecision(feed,playerId,playerName){
  const d=feed?.liveData?.decisions||{};
  const same=p=>p&&((playerId&&String(p.id||'')===String(playerId))||internationalPlayerNameMatch(p.fullName||'',playerName));
  return {
    w:same(d.winner)?1:0,
    l:same(d.loser)?1:0,
    sv:same(d.save)?1:0
  };
}
async function mlbInternationalPlayerGames(competition,y,team,playerId,playerName){
  const teamName=internationalTeamEnglish(team);
  const teamsData=await getJson(MLB_BASE+'/teams?sportId=51&season='+y,120000);
  const target=internationalMatchTeam(teamsData?.teams||[],teamName);
  if(!target) return [];

  let schedule=null;
  // IMPORTANT: WBC changes gameType by round.
  // 2023 example: F=pool, D=quarterfinal, L=semifinal, W=final.
  // Therefore a gameType=F-only request silently drops every knockout game.
  // The unfiltered team schedule returns the complete tournament path.
  for(const suffix of [
    '',
    '&gameType=F'
  ]){
    try{
      const data=await getJson(
        MLB_BASE+'/schedule?sportId=51&season='+y+'&teamId='+target.id+suffix+'&hydrate=team',
        90000
      );
      const count=(data?.dates||[]).reduce((n,d)=>n+(d?.games||[]).length,0);
      if(count){schedule=data;break;}
    }catch(e){console.warn('MLB international schedule failed',y,target.id,suffix,e)}
  }

  const games=(schedule?.dates||[]).flatMap(d=>d?.games||[])
    .filter(g=>
      Number(g?.teams?.away?.team?.id)===Number(target.id)
      || Number(g?.teams?.home?.team?.id)===Number(target.id)
    )
    .sort((a,b)=>String(a?.gameDate||'').localeCompare(String(b?.gameDate||'')));

  const out=[];
  for(const game of games){
    const gamePk=Number(game?.gamePk)||0;
    if(!gamePk) continue;
    let feed=null;
    try{feed=await getJson('https://statsapi.mlb.com/api/v1.1/game/'+gamePk+'/feed/live',90000)}catch{continue}
    const found=mlbBoxPlayerEntry(feed,playerId,playerName);
    if(!found) continue;
    const box=found.entry||{};
    const batting=box?.stats?.batting||null;
    const pitching=box?.stats?.pitching||null;
    const fielding=box?.stats?.fielding||null;
    if(!batting&&!pitching) continue;

    const home=feed?.gameData?.teams?.home||game?.teams?.home?.team||{};
    const away=feed?.gameData?.teams?.away||game?.teams?.away?.team||{};
    const opponent=found.side==='home'?away:home;
    const pa=batting?mlbGamePlateAppearances(feed,playerId,playerName):[];
    let hitter=batting?mlbHitter(batting,num(fielding?.errors)):null;
    if(hitter){
      hitter.plateAppearances=pa;
      hitter.errors=num(fielding?.errors);
    }
    let pitcher=pitching?mlbPitcher(pitching):null;
    if(pitcher){
      const dec=mlbGamePitchDecision(feed,playerId,playerName);
      pitcher.w=dec.w; pitcher.l=dec.l; pitcher.sv=dec.sv;
      pitcher.pitchCount=num(pitching?.numberOfPitches)||num(pitching?.pitchesThrown);
      pitcher.hld=num(pitching?.holds);
    }
    out.push({
      gameId:String(gamePk),
      date:isoDateOnly(feed?.gameData?.datetime?.officialDate||feed?.gameData?.datetime?.dateTime||game?.officialDate||game?.gameDate),
      opponent:internationalGameOpponentName(opponent?.name||opponent?.teamName||''),
      hitter,pitcher,
      source:'mlb-game-feed'
    });
  }
  return out.filter(g=>g.date);
}
function wbscBoxLinks(html,base,team=''){
  const links=[...String(html||'').matchAll(/href=["']([^"']*\/box-score\/\d+[^"']*)["']/gi)]
    .map(m=>{try{return new URL(m[1],base).href}catch{return ''}})
    .filter(Boolean);

  const page=wbscInertiaPage(html);
  const games=Array.isArray(page?.props?.games)?page.props.games:[];
  for(const game of games){
    if(!game?.id) continue;
    if(team){
      const home=clean(game?.homelabel||game?.home_team?.teamlabel||game?.homeioc||'');
      const away=clean(game?.awaylabel||game?.away_team?.teamlabel||game?.awayioc||'');
      if(!internationalTeamCellMatch(home,team) && !internationalTeamCellMatch(away,team)) continue;
    }
    try{
      links.push(new URL(base+'/schedule-and-results/box-score/'+String(game.id),base).href);
    }catch{}
  }
  return [...new Set(links)];
}
function monthNumber(name){
  const m={jan:'01',january:'01',feb:'02',february:'02',mar:'03',march:'03',apr:'04',april:'04',may:'05',jun:'06',june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',sept:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12'};
  return m[String(name||'').toLowerCase()]||'';
}
function boxHtmlDate(html,year){
  const s=String(html||'');
  let m=s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m=s.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if(m) return m[3]+'-'+monthNumber(m[1])+'-'+String(m[2]).padStart(2,'0');
  m=s.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|Sept|October|November|December)\s+(\d{4})\b/i);
  if(m) return m[3]+'-'+monthNumber(m[2])+'-'+String(m[1]).padStart(2,'0');
  const iso=String(s.match(/datetime=["']([^"']+)["']/i)?.[1]||'');
  return isoDateOnly(iso)||'';
}
function wbscOpponentFromBox(html,competition,y,team){
  const plain=norm(htmlAttrsText(String(html||'').slice(0,120000)));
  let teams=[];
  const fixed=CURRENT_ASIAN_TEAM_CATALOG[competition+':'+y];
  if(Array.isArray(fixed)) teams=fixed;
  if(competition==='世界12強'){
    teams=['中華台北','日本','韓國','澳洲','加拿大','古巴','多明尼加','墨西哥','荷蘭','巴拿馬','波多黎各','美國','委內瑞拉','義大利'];
  }
  for(const candidate of teams){
    if(clean(candidate)===clean(team)) continue;
    const aliases=INTERNATIONAL_WIKI_TEAM_ALIASES[clean(candidate)]||[internationalTeamEnglish(candidate),candidate];
    if(aliases.some(a=>plain.includes(norm(a)))) return candidate;
  }
  return '';
}
function wbscInertiaPage(html){
  const m=String(html||'').match(/\bdata-page="([^"]*)"/i);
  if(!m) return null;
  try{
    return JSON.parse(decodeHtml(m[1]));
  }catch(e){
    console.warn('WBSC Inertia parse failed',e);
    return null;
  }
}
function wbscInertiaOriginal(html){
  const page=wbscInertiaPage(html);
  return page?.props?.viewData?.original || page?.props?.viewData || null;
}
function wbscBoxPlayerRecords(original){
  const box=original?.boxScore;
  if(!box || typeof box!=='object') return [];
  const out=[];
  for(const [teamId,slots] of Object.entries(box)){
    if(teamId==='totals'||teamId==='pitchers'||!slots||typeof slots!=='object') continue;
    for(const records of Object.values(slots)){
      if(!Array.isArray(records)) continue;
      for(const record of records){
        if(record && typeof record==='object' && (record.playerid||record?.player?.id)) out.push(record);
      }
    }
  }
  return out;
}
function wbscRecordOfficialName(record){
  const last=clean(record?.lastname||record?.player?.lastname||'');
  const first=clean(record?.firstname||record?.player?.firstname||'');
  return clean([last,first].filter(Boolean).join(' '));
}
function wbscU18OfficialHint(y,team,playerName){
  if(y!==2026 || clean(team)!=='中華台北') return null;
  const direct=U18_2026_TPE_WBSC_PLAYERS[clean(playerName)];
  if(direct) return direct;
  for(const [zh,item] of Object.entries(U18_2026_TPE_WBSC_PLAYERS)){
    if(internationalPlayerNameMatch(zh,playerName)||internationalPlayerNameMatch(item.name,playerName)) return item;
  }
  return null;
}
function wbscFindPlayerRecord(original,y,team,playerId,playerName){
  const records=wbscBoxPlayerRecords(original);
  const hint=wbscU18OfficialHint(y,team,playerName);
  const requestedId=clean(playerId);
  const officialId=clean(hint?.id||(/^\d+$/.test(requestedId)?requestedId:''));
  if(officialId){
    const hit=records.find(r=>clean(r?.playerid||r?.player?.id)===officialId);
    if(hit) return hit;
  }
  const names=[clean(hint?.name||''),clean(playerName)].filter(Boolean);
  return records.find(r=>{
    const official=wbscRecordOfficialName(r);
    return names.some(n=>internationalPlayerNameMatch(official,n));
  })||null;
}
function wbscRecordHitter(record){
  if(!record) return null;
  const pa=num(record.pa),ab=num(record.ab);
  if(!pa && !ab) return null;
  const h=num(record.h),d=num(record.double),t=num(record.triple),hr=num(record.hr);
  return {
    pa,ab,runs:num(record.r),hits:h,single:singles(h,d,t,hr),double:d,triple:t,hr,
    rbi:num(record.rbi),bb:num(record.bb),ibb:num(record.ibb),hbp:num(record.hbp),
    sacBunt:num(record.sh),sacFly:num(record.sf),k:num(record.so),
    avg:num(record.avg),obp:num(record.obp),slg:num(record.slg),
    errors:num(record.field_e),plateAppearances:[]
  };
}
function wbscRecordPitcher(record){
  if(!record) return null;
  const outs=ipToOuts(record.pitch_ip);
  const bf=num(record.pitch_bf);
  if(!outs && !bf) return null;
  const h=num(record.pitch_h),bb=num(record.pitch_bb),er=num(record.pitch_er);
  return {
    outs,innings:outsToIp(outs),h,bb,hbp:num(record.pitch_hbp),k:num(record.pitch_so),
    r:num(record.pitch_r),er,w:num(record.pitch_win),l:num(record.pitch_loss),
    sv:num(record.pitch_save),hld:0,bsv:0,cg:num(record.pitch_cg),sho:num(record.pitch_sho),
    pitchCount:num(record.pitch_pitches),
    era:outs?(er*27/outs):0,
    whip:outs?((h+bb)*3/outs):0
  };
}
function wbscPaCode(play){
  const narrative=clean(play?.narrative||play?.result||'');
  if(num(play?.homerun)) return 'HR';
  if(num(play?.triple)) return '3B';
  if(num(play?.double)) return '2B';
  if(num(play?.h)) return '1B';
  if(num(play?.ibb)) return 'IBB';
  if(num(play?.bb)) return 'BB';
  if(num(play?.hbp)) return 'HBP';
  if(num(play?.sf)) return 'SF';
  if(num(play?.sac)) return 'SH';
  if(num(play?.ci)) return 'CI';
  if(num(play?.roe)) return 'E';
  if(num(play?.strikeout)){
    if(!num(play?.out) && /reach|safe|wild pitch|passed ball/i.test(narrative)) return 'KREACH';
    return 'K';
  }
  if(/triple play/i.test(narrative)) return 'TP';
  if(num(play?.gdp) || /double play/i.test(narrative)) return 'DP';
  if(/fielder'?s choice|fielders choice/i.test(narrative)) return 'FC';
  if(num(play?.groundout) || /grounds? out|groundout/i.test(narrative)) return 'GO';
  if(num(play?.flyout) || /flies? out|fly out|lines? out|pops? out|foul out/i.test(narrative)) return 'FO';
  return 'OUT';
}
function wbscPlateAppearances(original,batterId){
  const all=original?.gamePlays?.all||{};
  const out=[];
  const innings=Object.keys(all).sort((a,b)=>num(a)-num(b));
  for(const inning of innings){
    for(const half of ['top','bot']){
      const plays=Array.isArray(all?.[inning]?.[half])?all[inning][half]:[];
      for(const play of plays){
        if(clean(play?.batterid)!==clean(batterId) || num(play?.pa)!==1) continue;
        out.push({
          code:wbscPaCode(play),
          position:'',
          rbi:num(play?.rbi),
          officialAction:clean(play?.narrative||play?.result||''),
          inning:num(play?.inning)||num(inning),
          half,
          playId:clean(play?.id||''),
          playOrder:num(play?.playorder)
        });
      }
    }
  }
  return out.sort((a,b)=>a.inning-b.inning || a.playOrder-b.playOrder);
}
function wbscGameDate(original,html,y){
  const raw=clean(original?.gameData?.start_date||original?.gameData?.start||'');
  const m=raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1]||boxHtmlDate(html,y);
}
function wbscGameOpponent(original,team,competition,y,html){
  const gd=original?.gameData||{};
  const home=clean(gd.homelabel||gd?.home_team?.name||gd.homeioc||'');
  const away=clean(gd.awaylabel||gd?.away_team?.name||gd.awayioc||'');
  if(home && internationalTeamCellMatch(home,team)) return internationalTeamChinese(away);
  if(away && internationalTeamCellMatch(away,team)) return internationalTeamChinese(home);
  return wbscOpponentFromBox(html,competition,y,team);
}

async function wbscInternationalPlayerGames(competition,y,team,playerId,playerName){
  const base=(competition==='U18亞青' && y===2026)
    ? 'https://www.wbscasia.org/en/events/2026-bfa-xiv-u18-championship'
    : await resolveWbscEventBase(competition,y);
  if(!base) return [];
  let schedule='';
  try{schedule=await getText(base+'/schedule-and-results',30000)}catch{return []}
  const links=wbscBoxLinks(schedule,base,team).slice(0,80);
  const out=[];
  for(const url of links){
    let html=''; try{html=await getText(url,30000)}catch{continue}
    const original=wbscInertiaOriginal(html);
    const record=wbscFindPlayerRecord(original,y,team,playerId,playerName);

    let hitter=null,pitcher=null;
    if(record){
      hitter=wbscRecordHitter(record);
      pitcher=wbscRecordPitcher(record);
      if(hitter){
        const batterId=clean(record?.playerid||record?.player?.id);
        hitter.plateAppearances=wbscPlateAppearances(original,batterId);
      }
    }else{
      const hint=wbscU18OfficialHint(y,team,playerName);
      const officialName=clean(hint?.name||playerName);
      const hitterFound=findStatRow(html,'hitter',officialName,team);
      const pitcherFound=findStatRow(html,'pitcher',officialName,team);
      hitter=tableHitterStats(hitterFound);
      pitcher=tablePitcherStats(pitcherFound);
      if(hitter) hitter.plateAppearances=[];
    }
    if(!hitter&&!pitcher) continue;

    const gameId=String((url.match(/\/box-score\/(\d+)/)||[])[1]||url);
    out.push({
      gameId,
      date:wbscGameDate(original,html,y),
      opponent:wbscGameOpponent(original,team,competition,y,html),
      hitter,pitcher,
      partial:false,
      source:base.includes('wbscasia.org')?'wbsc-asia-gameplays':'wbsc-gameplays',
      sourceUrl:url
    });
  }
  const seen=new Set();
  return out.filter(g=>{
    const key=[g.gameId,g.date,g.opponent].join('|');
    if(seen.has(key)) return false;
    seen.add(key);
    return Boolean(g.date);
  }).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
async function internationalPlayerGames(competition,year,team,playerId,playerName){
  const comp=clean(competition),y=yearOf(year),t=clean(team);
  const name=clean(playerName);

  // Detailed official play-by-play sources always win.
  if(['U18亞青','世界12強','亞洲運動會','亞錦賽'].includes(comp)){
    try{
      const officialGames=await wbscInternationalPlayerGames(comp,y,t,clean(playerId),name);
      if(Array.isArray(officialGames) && officialGames.length) return officialGames;
    }catch(e){console.warn('WBSC detailed international games failed',comp,y,e)}
  }

  if(comp==='WBC' || comp==='WBCQ'){
    try{
      const officialGames=await mlbInternationalPlayerGames(comp,y,t,clean(playerId),name);
      if(Array.isArray(officialGames) && officialGames.length) return officialGames;
    }catch(e){console.warn('MLB detailed international games failed',comp,y,e)}
  }

  // Aggregate/PDF/bot data is fallback only when detailed official feeds are unavailable.
  if(['WBC','世界12強','亞洲運動會','U18亞青','亞錦賽'].includes(comp)){
    try{
      const botGames=await internationalBotPlayerGames(comp,y,t,clean(playerId),name);
      if(Array.isArray(botGames) && botGames.length) return botGames;
    }catch(e){console.warn('official data bot games failed',e)}
  }

  return [];
}

async function internationalTeams(competition,year){
  const comp=clean(competition),y=yearOf(year);
  const staticTeams=CURRENT_ASIAN_TEAM_CATALOG[comp+':'+y]||[];
  let botTeams=[];
  try{
    const event=await internationalBotEvent(comp,y);
    botTeams=Object.keys(event?.teams||{});
  }catch(e){console.warn('official data bot teams failed',e)}
  if(staticTeams.length || botTeams.length){
    return [...new Set([...staticTeams,...botTeams].map(internationalTeamChinese).filter(Boolean))];
  }
  if(comp==='亞洲運動會'||comp==='亞錦賽'){
    try{
      const teams=await brInternationalTeams(comp,y);
      if(teams.length) return teams;
    }catch(e){console.warn('BR team list failed',comp,y,e)}
  }
  return [];
}
async function internationalRoster(competition,year,team){
  const comp=clean(competition);
  const y=yearOf(year);
  const t=clean(team);

  if(['WBC','WBCQ'].includes(comp)){
    let mlb={competition:comp,year:y,team:t,source:'mlb-int',players:[]};
    try{ mlb=await mlbInternationalRoster(comp,y,t); }catch(e){ console.warn('MLB international roster failed',e); }
    if((mlb?.players||[]).length) return mlb;

    let wiki={competition:comp,year:y,team:t,source:'wikipedia-roster',players:[]};
    try{ wiki=await wikipediaInternationalRoster(comp,y,t); }catch(e){ console.warn('Wikipedia international roster fallback',e); }
    if((wiki?.players||[]).length) return wiki;

    if(comp==='WBC'){
      try{
        const bot=await internationalBotRoster(comp,y,t);
        if((bot?.players||[]).length) return bot;
      }catch(e){console.warn('official data bot WBC roster failed',e)}
    }
    return mlb;
  }

  if(comp==='世界12強'){
    try{
      const official=await wbscOfficialInternationalRoster(comp,y,t);
      if((official?.players||[]).length){
        let bot=null;
        try{bot=await internationalBotRoster(comp,y,t)}catch{}
        return mergeOfficialRosterWithFallback(official,bot);
      }
    }catch(e){console.warn('official WBSC Premier12 roster failed',e)}

    try{
      const bot=await internationalBotRoster(comp,y,t);
      if((bot?.players||[]).length) return bot;
    }catch(e){console.warn('official data bot Premier12 roster failed',e)}
    return await premier12Roster(y,t);
  }

  if(comp==='U18亞青'){
    try{
      const live=await wbscU18LiveRoster(y,t);
      if((live?.players||[]).length) return live;
    }catch(e){console.warn('official WBSC U18 roster failed',e)}
    try{
      const bot=await internationalBotRoster(comp,y,t);
      if((bot?.players||[]).length) return bot;
    }catch(e){console.warn('official/fallback data bot U18 roster failed',e)}
    const fixed=U18_2026_STATIC_ROSTERS[t];
    if(y===2026 && fixed) return staticRoster(fixed,comp,y,t,'published-2026-u18-roster');
    return {competition:comp,year:y,team:t,source:'wbsc-asia-roster-unavailable',players:[]};
  }

  if(comp==='亞洲運動會'){
    try{
      const official=await wbscOfficialInternationalRoster(comp,y,t);
      if((official?.players||[]).length){
        let bot=null;
        try{bot=await internationalBotRoster(comp,y,t)}catch{}
        return mergeOfficialRosterWithFallback(official,bot);
      }
    }catch(e){console.warn('official WBSC Asian Games roster failed',e)}

    try{
      const bot=await internationalBotRoster(comp,y,t);
      if((bot?.players||[]).length) return bot;
    }catch(e){console.warn('official data bot Asian Games roster failed',e)}

    const fixed=y===2026?ASIAN_GAMES_2026_STATIC_ROSTERS[t]:null;
    if(fixed) return staticRoster(fixed,comp,y,t,'published-2026-asian-games-roster');
    try{
      const br=await brInternationalRoster(comp,y,t);
      if((br.players||[]).length) return br;
    }catch(e){console.warn('Asian Games roster failed',e)}
    return {competition:comp,year:y,team:t,source:y===2026?'roster-not-published':'roster-source-unavailable',players:[]};
  }

  if(comp==='亞錦賽'){
    try{
      const official=await wbscOfficialInternationalRoster(comp,y,t);
      if((official?.players||[]).length){
        let bot=null;
        try{bot=await internationalBotRoster(comp,y,t)}catch{}
        return mergeOfficialRosterWithFallback(official,bot);
      }
    }catch(e){console.warn('official WBSC Asian Championship roster failed',e)}

    try{
      const bot=await internationalBotRoster(comp,y,t);
      if((bot?.players||[]).length) return bot;
    }catch(e){console.warn('official data bot Asian Championship roster failed',e)}

    try{
      const br=await brInternationalRoster(comp,y,t);
      if((br.players||[]).length) return br;
    }catch(e){console.warn('Asian Championship roster failed',e)}
    return {competition:comp,year:y,team:t,source:'roster-source-unavailable',players:[]};
  }

  return {competition:comp,year:y,team:t,source:'pending-adapter',players:[]};
}

/* ---------- unified routing ---------- */
function providerCode(v){
  const x=String(v||'').toUpperCase();
  if(['US','MLB','MILB','NPB','KBO'].includes(x)) return x;
  throw new Error('provider must be US, MLB, MILB, NPB, or KBO');
}
async function doSearch(p,q,y){
  if(p==='US') return await usSearch(q,y);
  if(p==='MLB'||p==='MILB') return await mlbSearch(p,q,y);
  if(p==='NPB') return await npbSearch(q);
  return await kboSearch(q);
}
async function doProfile(p,id){
  if(p==='US') return await usProfile(id);
  if(p==='MLB'||p==='MILB') return await mlbProfile(p,id);
  if(p==='NPB') return await npbProfile(id);
  return await kboProfile(id);
}
async function doSeason(p,id,y,level='A'){
  const lv=String(level||'A').toUpperCase()==='D'?'D':'A';
  if(p==='US') return await usSeason(id,y);
  if(p==='MLB'||p==='MILB') return await mlbSeason(p,id,y);
  if(p==='NPB') return lv==='D' ? await npbFarmSeason(id,y) : await npbSeason(id,y);
  return lv==='D' ? await kboFuturesSeason(id,y) : await kboSeason(id,y);
}
async function doSeasonYears(p,id,level='A'){
  const lv=String(level||'A').toUpperCase()==='D'?'D':'A';
  if(p==='US'){
    const career=await usCareer(id);
    return {provider:'US',level:'A',profile:{...career.profile,years:career.years},years:career.years,entries:career.entries};
  }
  if(p==='NPB'){
    if(lv==='D') return await npbFarmYears(id);
    const profile=await npbProfile(id);
    return {provider:'NPB',level:'A',profile,years:Array.isArray(profile?.years)?profile.years:[]};
  }
  if(p==='KBO'){
    if(lv==='D') return await kboFuturesYears(id);
    const profile=await kboProfile(id);
    const [hh,ph]=await Promise.all([
      getText(KBO_BASE+'/Record/Player/HitterDetail/Total.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>''),
      getText(KBO_BASE+'/Record/Player/PitcherDetail/Total.aspx?playerId='+encodeURIComponent(id),120000).catch(()=>'')
    ]);
    const years=[...new Set([...kboYears(hh),...kboYears(ph)])].sort((a,b)=>b-a);
    return {provider:'KBO',level:'A',profile:Object.assign(profile,{years}),years};
  }
  const profile=await doProfile(p,id);
  return {provider:p,level:lv,profile,years:Array.isArray(profile?.years)?profile.years:[]};
}
async function doDaily(p,id,date){
  if(p==='US') return await usDaily(id,date);
  if(p==='MLB'||p==='MILB') return await mlbDaily(p,id,date);
  if(p==='NPB') return await npbDailyAuto(id,date);
  return await kboDailyAuto(id,date);
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:CORS});

  if(req.method!=='POST') return send({ok:false,error:'POST only'},405);
  if(req.headers.get('x-baseball-proxy-key')!==BASEBALL_PROXY_KEY) return send({ok:false,error:'Forbidden'},403);

  try{
    const body=await req.json();
    const action=String(body.action||'');

    if(action==='resolve-name'){
      return send({ok:true,groups:await resolveNameGroups(clean(body.query))});
    }
    if(action==='international-roster'){
      const competition=clean(body.competition),team=clean(body.team);
      if(!competition||!team) return send({ok:false,error:'competition/team required'},400);
      return send({ok:true,roster:await internationalRoster(competition,body.year,team)});
    }
    if(action==='international-player-stats'){
      const competition=clean(body.competition),team=clean(body.team);
      const playerName=clean(body.playerName),playerId=clean(body.playerId);
      if(!competition||!team||(!playerName&&!playerId)) return send({ok:false,error:'competition/team/player required'},400);
      return send({ok:true,stats:await internationalPlayerStats(competition,body.year,team,playerId,playerName)});
    }
    if(action==='international-player-games'){
      const competition=clean(body.competition),team=clean(body.team);
      const playerName=clean(body.playerName),playerId=clean(body.playerId);
      if(!competition||!team||(!playerName&&!playerId)) return send({ok:false,error:'competition/team/player required'},400);
      const games=await internationalPlayerGames(competition,body.year,team,playerId,playerName);
      return send({ok:true,games});
    }
    if(action==='international-teams'){
      const competition=clean(body.competition);
      if(!competition) return send({ok:false,error:'competition required'},400);
      return send({ok:true,teams:await internationalTeams(competition,body.year)});
    }

    const p=providerCode(body.provider);

    if(action==='search-player'){
      const q=clean(body.query);
      return send({ok:true,players:q?await doSearch(p,q,yearOf(body.year)):[]});
    }
    if(action==='player-profile'){
      const id=clean(body.id);
      if(!id) return send({ok:false,error:'id required'},400);
      return send({ok:true,player:await doProfile(p,id)});
    }
    if(action==='career-stats'){
      const id=clean(body.id);
      if(!id) return send({ok:false,error:'id required'},400);
      if(p!=='US' && p!=='MLB' && p!=='MILB') return send({ok:false,error:'career-stats is only available for US baseball'},400);
      return send({ok:true,career:await usCareer(id)});
    }
    if(action==='season-stats'){
      const id=clean(body.id);
      if(!id) return send({ok:false,error:'id required'},400);
      return send({ok:true,stats:await doSeason(p,id,yearOf(body.year),body.level)});
    }
    if(action==='season-years'){
      const id=clean(body.id);
      if(!id) return send({ok:false,error:'id required'},400);
      return send({ok:true,history:await doSeasonYears(p,id,body.level)});
    }
    if(action==='daily'){
      const id=clean(body.id),date=clean(body.date);
      if(!id||!date) return send({ok:false,error:'id/date required'},400);
      return send({ok:true,daily:await doDaily(p,id,date)});
    }

    return send({ok:false,error:'unknown action'},400);
  }catch(e){
    console.error(e);
    return send({ok:false,error:e instanceof Error?e.message:String(e)},500);
  }
});
