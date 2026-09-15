from pathlib import Path

DIAG = Path('diagnostics.html')
RUNTIME = Path('diagnostic-runtime.js')

diag = DIAG.read_text(encoding='utf-8')

# Replace the whole PWA probe with a self-healing version.
start = diag.index('async function probePwa(state){')
end = diag.index('async function probeApis(state){', start)
new_probe_pwa = r'''async function probePwa(state){
  async function collect(){
    const p={supported:'serviceWorker' in navigator,controller:Boolean(navigator.serviceWorker?.controller),controllerUrl:navigator.serviceWorker?.controller?.scriptURL||'',registrations:[],cacheNames:[],cacheEntries:{},storage:null,repairAttempted:false,repairError:'',repairResult:''};
    try{
      if(p.supported){
        const regs=await navigator.serviceWorker.getRegistrations();
        p.registrations=regs.map(r=>({scope:r.scope,active:r.active?.scriptURL||'',waiting:r.waiting?.scriptURL||'',installing:r.installing?.scriptURL||''}));
      }
    }catch(e){p.registrationReadError=e.message||String(e);}
    try{
      if('caches' in window){
        p.cacheNames=await caches.keys();
        for(const name of p.cacheNames){const c=await caches.open(name);p.cacheEntries[name]=(await c.keys()).length;}
      }
    }catch(e){p.cacheReadError=e.message||String(e);}
    try{if(navigator.storage?.estimate)p.storage=await navigator.storage.estimate();}catch{}
    return p;
  }

  const v=state.versions.versionJson||state.versions.indexMeta||'';
  const normalized=v.replace(/^v/i,'').replace(/\./g,'');
  let p=await collect();
  let currentCaches=p.cacheNames.filter(x=>normalized&&x.includes(`v${normalized}`));
  let activeRegistration=p.registrations.find(r=>r.active&&location.href.startsWith(r.scope));
  const needsRepair=location.protocol==='https:'&&p.supported&&(!activeRegistration||(v&&!currentCaches.length));

  if(needsRepair){
    try{
      p.repairAttempted=true;
      const swUrl=`./service-worker.js?v=${encodeURIComponent(v||Date.now())}`;
      const reg=await navigator.serviceWorker.register(swUrl,{updateViaCache:'none'});
      try{await reg.update();}catch{}
      try{await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,6000))]);}catch{}
      await new Promise(resolve=>setTimeout(resolve,700));
      const repaired=await collect();
      repaired.repairAttempted=true;
      repaired.repairResult='已自動重新註冊目前版本 Service Worker';
      p=repaired;
    }catch(e){
      p.repairAttempted=true;
      p.repairError=e.message||String(e);
    }
  }

  currentCaches=p.cacheNames.filter(x=>normalized&&x.includes(`v${normalized}`));
  const appCaches=p.cacheNames.filter(x=>x.startsWith('baseball-player-card-pwa-'));
  activeRegistration=p.registrations.find(r=>r.active&&location.href.startsWith(r.scope));
  p.controlState=p.controller?'controlled':activeRegistration?'active-uncontrolled':'unregistered';

  if(p.registrationReadError) pushIssue(state,'warning','PWA','無法讀取 Service Worker registration',p.registrationReadError);
  if(p.cacheReadError) pushIssue(state,'warning','PWA','無法讀取 Cache Storage',p.cacheReadError);
  if(location.protocol==='https:'&&p.supported&&!p.controller&&!activeRegistration) pushIssue(state,'warning','PWA','目前頁面沒有可用的 Service Worker',p.repairError||'已自動嘗試重新註冊；若仍失敗，請重新整理診斷頁');
  if(v&&!currentCaches.length) pushIssue(state,'error','PWA',`找不到 ${v} 對應的 PWA cache`,p.repairError||appCaches.join(', ')||'已自動嘗試建立目前版本 cache');
  if(appCaches.length>1) pushIssue(state,'warning','PWA',`偵測到 ${appCaches.length} 個舊版 PWA cache`,appCaches.join(', '));
  if(p.storage?.quota&&p.storage?.usage/p.storage.quota>.85) pushIssue(state,'warning','儲存空間','瀏覽器儲存空間使用率超過 85%');
  state.pwa=p;
}

'''
diag = diag[:start] + new_probe_pwa + diag[end:]

# Separate current-version runtime errors from historical logs.
start = diag.index('function probeRuntime(state){')
end = diag.index('async function probeCpbl(state){', start)
new_probe_runtime = r'''function probeRuntime(state){
  let rows=[];try{const p=JSON.parse(localStorage.getItem(RUNTIME_KEY)||'[]');rows=Array.isArray(p)?p:[];}catch{}
  const currentVersion=state.versions.versionJson||state.versions.indexMeta||'';
  const inferVersion=x=>{
    if(x?.version)return String(x.version);
    const page=String(x?.page||'');
    const m=page.match(/[?&](?:__app_version|v)=(v\d+\.\d+)/i);
    return m?.[1]||'';
  };
  rows=rows.filter(x=>Date.now()-Number(x?.at||0)<=7*86400000)
    .map(x=>({...x,_diagVersion:inferVersion(x)}))
    .sort((a,b)=>Number(b.at||0)-Number(a.at||0));
  state.runtime=rows;
  state.runtimeCurrent=rows.filter(x=>currentVersion&&x._diagVersion===currentVersion);
  state.runtimeHistorical=rows.filter(x=>x._diagVersion&&x._diagVersion!==currentVersion);
  state.runtimeUnknown=rows.filter(x=>!x._diagVersion);
  const recentHour=state.runtimeCurrent.filter(x=>Date.now()-Number(x.at||0)<=3600000&&x.level==='error');
  const recentDay=state.runtimeCurrent.filter(x=>Date.now()-Number(x.at||0)<=86400000&&x.level==='error');
  if(recentHour.length) pushIssue(state,'error','前台執行',`目前版本最近 1 小時記錄到 ${recentHour.length} 個前台錯誤`,'請看「前台執行錯誤」區塊');
  else if(recentDay.length) pushIssue(state,'warning','前台執行',`目前版本最近 24 小時記錄到 ${recentDay.length} 個前台錯誤`,'目前未必仍在發生');
}

'''
diag = diag[:start] + new_probe_runtime + diag[end:]

diag = diag.replace(
    '主程式會記錄 JavaScript 錯誤、資源載入失敗、未處理 Promise、網路層 5xx 與本地資源 4xx。最多保留 120 筆／7 天。',
    '主程式會記錄 JavaScript 錯誤、資源載入失敗、未處理 Promise、網路層 5xx 與本地資源 4xx。最多保留 120 筆／7 天；舊版本紀錄保留供追查，但不影響目前版本健康狀態。'
)

old_summary = "$('#summary').innerHTML=[['版本',state.versions.versionJson||'—'],['錯誤',errors],['警告',warnings],['靜態資源',`${okResources}/${state.resources.length}`],['API',`${okApis}/${state.apis.length}`],['前台錯誤',state.runtime.length]].map(([a,b])=>`<div class=\"card\"><span class=\"sub\">${esc(a)}</span><b class=\"${a==='錯誤'&&errors?'error':a==='警告'&&warnings?'warning':''}\">${esc(b)}</b></div>`).join('');"
new_summary = "const currentRuntimeErrors=(state.runtimeCurrent||[]).filter(x=>x.level==='error').length,historicalRuntimeErrors=(state.runtimeHistorical||[]).filter(x=>x.level==='error').length;$('#summary').innerHTML=[['版本',state.versions.versionJson||'—'],['錯誤',errors],['警告',warnings],['靜態資源',`${okResources}/${state.resources.length}`],['API',`${okApis}/${state.apis.length}`],['前台錯誤',currentRuntimeErrors],['歷史錯誤',historicalRuntimeErrors]].map(([a,b])=>`<div class=\"card\"><span class=\"sub\">${esc(a)}</span><b class=\"${a==='錯誤'&&errors?'error':a==='警告'&&warnings?'warning':''}\">${esc(b)}</b></div>`).join('');"
if old_summary not in diag:
    raise SystemExit('summary target not found')
diag = diag.replace(old_summary, new_summary, 1)

old_runtime = "$('#runtimeWrap').innerHTML=tableHtml(['時間','等級','類型','頁面','訊息','URL/HTTP'],state.runtime.slice(0,120).map(x=>`<tr><td>${esc(time(x.at))}</td><td><span class=\"pill ${esc(x.level||'error')}\">${esc(x.level||'error')}</span></td><td>${esc(x.kind||'')}</td><td class=\"mono runtime-msg\">${esc(x.page||'')}</td><td class=\"runtime-msg\">${esc(x.message||'')}${x.extra?`<div class=\"small mono muted\">${esc(x.extra)}</div>`:''}</td><td class=\"mono runtime-msg\">${esc(x.url||'')}${x.status?`<div>HTTP ${esc(x.status)}</div>`:''}</td></tr>`));"
new_runtime = "$('#runtimeWrap').innerHTML=tableHtml(['時間','版本','範圍','等級','類型','頁面','訊息','URL/HTTP'],state.runtime.slice(0,120).map(x=>{const current=x._diagVersion&&x._diagVersion===state.versions.versionJson;return `<tr><td>${esc(time(x.at))}</td><td><span class=\"pill\">${esc(x._diagVersion||'未知')}</span></td><td><span class=\"pill ${current?'ok':'warning'}\">${esc(current?'目前':'歷史')}</span></td><td><span class=\"pill ${esc(x.level||'error')}\">${esc(x.level||'error')}</span></td><td>${esc(x.kind||'')}</td><td class=\"mono runtime-msg\">${esc(x.page||'')}</td><td class=\"runtime-msg\">${esc(x.message||'')}${x.extra?`<div class=\"small mono muted\">${esc(x.extra)}</div>`:''}</td><td class=\"mono runtime-msg\">${esc(x.url||'')}${x.status?`<div>HTTP ${esc(x.status)}</div>`:''}</td></tr>`;}));"
if old_runtime not in diag:
    raise SystemExit('runtime table target not found')
diag = diag.replace(old_runtime, new_runtime, 1)

old_pwa = "['Service Worker 支援',p.supported?'是':'否'],['目前被 SW 控制',p.controller?'是':p.controlState==='active-uncontrolled'?'尚未接管（active registration 正常）':'否'],['Controller',p.controllerUrl||'—'],['Registrations',p.registrations.length],['Cache 名稱',p.cacheNames.join('\\n')||'—']"
new_pwa = "['Service Worker 支援',p.supported?'是':'否'],['目前被 SW 控制',p.controller?'是':p.controlState==='active-uncontrolled'?'尚未接管（active registration 正常）':'否'],['自動修復',p.repairAttempted?(p.repairError?`失敗：${p.repairError}`:(p.repairResult||'已執行')):'不需要'],['Controller',p.controllerUrl||'—'],['Registrations',p.registrations.length],['Cache 名稱',p.cacheNames.join('\\n')||'—']"
if old_pwa not in diag:
    raise SystemExit('pwa render target not found')
diag = diag.replace(old_pwa, new_pwa, 1)

DIAG.write_text(diag, encoding='utf-8')

runtime = RUNTIME.read_text(encoding='utf-8')
old_entry = "      page: `${location.pathname}${location.search}`.slice(0, 500),\n      message: safeText(detail.message || detail.error || ''),"
new_entry = "      page: `${location.pathname}${location.search}`.slice(0, 500),\n      version: document.querySelector('meta[name=\"app-version\"]')?.getAttribute('content') || new URLSearchParams(location.search).get('__app_version') || new URLSearchParams(location.search).get('v') || '',\n      message: safeText(detail.message || detail.error || ''),"
if old_entry not in runtime:
    raise SystemExit('runtime entry target not found')
runtime = runtime.replace(old_entry, new_entry, 1)
RUNTIME.write_text(runtime, encoding='utf-8')

print('diagnostics self-heal patch applied')
