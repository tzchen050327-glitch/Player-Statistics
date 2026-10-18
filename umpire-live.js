(() => {
  'use strict';
  // Live umpire panel only. The official postgame report and its notifications stay untouched.
  const API='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-umpire-live-read';
  const SUMMARY_TTL=120000, DETAIL_TTL=120000;
  const summaries=new Map(), details=new Map();
  let active=null,renderTimer=0,summaryPending=new Set(),detailPending=false,detailTimer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLive=v=>['live','suspended'].includes(String(v||'').toLowerCase());
  function currentCard(){
    if(!active||document.hidden)return null;
    const identity=window.__activeHomeGameDetailIdentity;
    if(!identity||identity.key!==active.key)return null;
    const overlay=document.getElementById('homeGameDetailOverlay');
    const body=document.getElementById('homeGameDetailBody');
    if(!overlay||overlay.classList.contains('hidden')||body?.dataset.matchCenterActive!=='play')return null;
    return body.querySelector('.gdx-live-situation[data-gdx="live"]');
  }
  function cacheKey(){return active&&[active.date,active.kindCode,active.gameId].join('|');}
  function clearCard(){
    const root=document.querySelector('#homeGameDetailBody .gdx-live-situation[data-gdx="live"]');
    root?.classList.remove('gdx-has-live-umpire');
    root?.querySelector('.gdx-umpire-card')?.remove();
  }
  function cardMarkup(key){
    const r=summaries.get(key)?.data||null;
    const pct=r&&Number.isFinite(Number(r.accuracy))&&Number(r.total_calls)>0?Number(r.accuracy).toFixed(1)+'%':'—';
    const name=String(r?.umpire_name||'').trim()||'主審待確認';
    const label=r?.status==='final'?'已結束':'即時暫定';
    return '<span class="gdx-umpire-card-label">裁判準確率</span>'
      +'<span class="gdx-umpire-card-name">主審 '+esc(name)+'</span>'
      +'<strong class="gdx-umpire-card-pct">'+esc(pct)+'</strong>'
      +'<span class="gdx-umpire-card-foot">'+esc(label)+' · 查看疑似誤判 ›</span>';
  }
  function renderCard(){
    const root=currentCard();
    if(!root||!statusLive(active?.status)){clearCard();return;}
    const key=cacheKey(),snap=summaries.get(key)?.data;
    if(snap?.status==='final'){clearCard();return;}
    let card=root.querySelector('.gdx-umpire-card');
    if(!card){
      card=document.createElement('button');
      card.type='button';
      card.className='gdx-umpire-card';
      root.appendChild(card);
    }
    root.classList.add('gdx-has-live-umpire');
    card.dataset.reportKey=key;
    const html=cardMarkup(key);
    if(card.innerHTML!==html)card.innerHTML=html;
    card.setAttribute('aria-label','主審 '+(snap?.umpire_name||'待確認')+'，裁判準確率 '+(Number.isFinite(Number(snap?.accuracy))&&Number(snap?.total_calls)>0?Number(snap.accuracy).toFixed(1)+'%':'尚無資料')+'；查看疑似誤判');
    maybeSummary();
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(renderCard,130);}
  function endpoint(a,extra=''){
    return API+'?date='+encodeURIComponent(a.date)+'&kindCode='+encodeURIComponent(a.kindCode)
      +'&gameId='+encodeURIComponent(a.gameId)+extra;
  }
  async function fetchReport(a,extra=''){
    const response=await fetch(endpoint(a,extra),{method:'GET',cache:'no-store',signal:AbortSignal.timeout(7000)});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const payload=await response.json();
    if(!payload?.ok)throw new Error(payload?.error||'無法取得資料');
    return payload?.report||null;
  }
  function maybeSummary(){
    if(!currentCard()||!statusLive(active?.status))return;
    const key=cacheKey(),prior=summaries.get(key);
    if(summaryPending.has(key)||(prior&&Date.now()-prior.at<SUMMARY_TTL))return;
    const a={...active};
    summaryPending.add(key);
    fetchReport(a).then(data=>{
      summaries.set(key,{data,at:Date.now()});
      if(cacheKey()===key)renderCard();
    }).catch(()=>{
      // Back off on errors: never poll more frequently after a failed read.
      summaries.set(key,{data:prior?.data||null,at:Date.now()});
    }).finally(()=>summaryPending.delete(key));
  }
  function ensureDialog(){
    let d=document.getElementById('gdxLiveUmpireDialog');
    if(d)return d;
    d=document.createElement('dialog');
    d.id='gdxLiveUmpireDialog';d.className='gdx-umpire-dialog';
    d.setAttribute('aria-label','即時主審判決分析');
    d.innerHTML='<div class="gdx-umpire-dialog-head"><div><span>賽中暫定分析</span><strong>主審疑似誤判</strong></div><button type="button" class="gdx-umpire-dialog-close" aria-label="關閉">✕</button></div><div class="gdx-umpire-dialog-body" aria-live="polite"></div>';
    d.querySelector('.gdx-umpire-dialog-close').addEventListener('click',()=>d.close());
    d.addEventListener('click',e=>{if(e.target===d)d.close();});
    d.addEventListener('close',()=>{clearInterval(detailTimer);detailTimer=null;delete d.dataset.reportKey;});
    document.body.appendChild(d);
    return d;
  }
  const callName=v=>String(v||'')==='STRIKE'?'好球':'壞球';
  function locateSvg(call){
    const x=Number(call?.x)||0,z=Number(call?.z)||0;
    const cx=Math.max(6,Math.min(124,65+x*145)),cy=Math.max(6,Math.min(138,145-(z-.25)*145));
    const stroke=call?.called==='STRIKE'?'#e96d65':'#3bbba9';
    return '<svg viewBox="0 0 130 145" role="img" aria-label="球點與估算好球帶">'
     +'<rect x="4" y="4" width="122" height="137" rx="8" fill="none" stroke="currentColor" opacity=".18"/>'
     +'<rect x="28" y="42" width="74" height="70" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/>'
     +'<path d="M52 42V112M77 42V112M28 65H102M28 89H102" stroke="currentColor" opacity=".25"/>'
     +'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="5.5" fill="'+stroke+'" stroke="#fff" stroke-width="1.7"/>'
     +'</svg>';
  }
  function detailHtml(report){
    if(!report)return '<div class="gdx-umpire-empty">目前尚無可用的逐球判決資料。</div>';
    const misses=Array.isArray(report.missed_calls)?report.missed_calls:[];
    const name=String(report.umpire_name||'').trim()||'待確認';
    const accuracy=Number(report.accuracy),pct=Number.isFinite(accuracy)&&Number(report.total_calls)>0?accuracy.toFixed(1)+'%':'—';
    return '<section class="gdx-umpire-modal-summary"><div><span>主審</span><strong>'+esc(name)+'</strong></div><div><span>暫定準確率</span><strong>'+esc(pct)+'</strong></div><div><span>疑似誤判</span><strong>'+esc(misses.length)+' 顆</strong></div></section>'
      +'<p class="gdx-umpire-disclaimer">依 TrackMan 球點與固定身高估算好球帶分析，僅為暫定模型結果，非官方裁判評分。邊界球可能有判讀差異。</p>'
      +(misses.length?'<div class="gdx-umpire-miss-list">'+misses.map((p,i)=>{
        const inning=(Number(p.inning_num)||0)+'局'+(p.inning_half==='▲'?'上':'下');
        const called=callName(p.called),model=callName(p.true_call);
        const dist=Number.isFinite(Number(p.dist_cm))?Number(p.dist_cm).toFixed(1)+' cm':'—';
        return '<article class="gdx-umpire-miss"><div class="gdx-umpire-miss-position">'+locateSvg(p)+'</div><div class="gdx-umpire-miss-main"><span class="gdx-umpire-miss-count">第'+(i+1)+'顆 · '+esc(inning)+'</span>'
        +'<strong>主審判 '+called+' · 模型判 '+model+'</strong>'
        +'<span>'+esc(p.pitcher||'投手未知')+' → '+esc(p.batter||'打者未知')+'</span>'
        +'<span>偏離估算邊界 '+esc(dist)+(Number(p.dist_cm)<2?' · 邊界球':'')+'</span>'
        +'<span>受益：'+esc(p.favor_team||'未判定')+'</span></div></article>';
      }).join('')+'</div>':'<div class="gdx-umpire-empty">目前沒有疑似誤判球。</div>');
  }
  // Refresh only while the current match's modal is open. Uses Supabase compact projection.
  async function refreshOpenDetail(){
    const d=document.getElementById('gdxLiveUmpireDialog');
    if(!d?.open||document.hidden||!active||!statusLive(active.status))return;
    const key=cacheKey(),previous=details.get(key);
    if(d.dataset.reportKey!==key||detailPending||(previous&&Date.now()-previous.at<DETAIL_TTL))return;
    const a={...active},body=d.querySelector('.gdx-umpire-dialog-body');
    detailPending=true;
    if(!previous)body.innerHTML='<div class="gdx-umpire-empty">正在載入逐球疑似誤判…</div>';
    try{
      const report=await fetchReport(a,'&details=1');
      details.set(key,{at:Date.now(),data:report});
      if(d.open&&d.dataset.reportKey===key&&cacheKey()===key){
        const scroll=body.scrollTop;
        body.innerHTML=detailHtml(report);
        body.scrollTop=scroll;
      }
    }catch{
      // Keep stale content during a transient failure and back off for two minutes.
      details.set(key,{at:Date.now(),data:previous?.data||null});
      if(!previous&&d.open&&d.dataset.reportKey===key){
        body.innerHTML='<div class="gdx-umpire-empty">暫時無法讀取判決，請稍後重新開啟。</div>';
      }
    }finally{detailPending=false;}
  }
  function openDetail(key){
    if(!active||cacheKey()!==key||!statusLive(active.status))return;
    const d=ensureDialog(),body=d.querySelector('.gdx-umpire-dialog-body');
    d.dataset.reportKey=key;
    const previous=details.get(key);
    body.innerHTML=previous?detailHtml(previous.data):'<div class="gdx-umpire-empty">正在載入逐球疑似誤判…</div>';
    if(!d.open)d.showModal();
    // Timer checks locally. Network reads are throttled to one per two minutes.
    if(!detailTimer)detailTimer=setInterval(()=>{void refreshOpenDetail();},15000);
    void refreshOpenDetail();
  }
  window.addEventListener('home-game-detail-state',event=>{
    const info=event?.detail||{},a=window.__activeHomeGameDetailIdentity,d=info.detail||{};
    if(!a||info.key!==a.key)return;
    const league=String(info.league||a.league||'').toUpperCase();
    const status=String(d.status||d.game?.status||'').toLowerCase();
    if(league!=='CPBL'||!statusLive(status)){
      active=null;clearCard();
      const modal=document.getElementById('gdxLiveUmpireDialog');
      if(modal?.open)modal.close();
      return;
    }
    const date=String(info.date||a.date||''),
          kindCode=String(d.kindCode||d.game?.kindCode||a.kindCode||'A').toUpperCase(),
          gameId=String(d.game?.id||a.gameId||'');
    if(!/^20\d\d-\d\d-\d\d$/.test(date)||!/^[AEC]$/.test(kindCode)||!/^\d+$/.test(gameId))return;
    active={key:a.key,date,kindCode,gameId,status};
    scheduleRender();
    if(document.getElementById('gdxLiveUmpireDialog')?.open)void refreshOpenDetail();
  });
  document.addEventListener('click',event=>{
    const card=event.target.closest('.gdx-umpire-card');
    if(card){event.preventDefault();void openDetail(card.dataset.reportKey||'');return;}
    if(event.target.closest('[data-match-center-tab], [data-home-game], #homeGameDetailBack')){
      scheduleRender();
    }
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleRender();void refreshOpenDetail();}});
})();
