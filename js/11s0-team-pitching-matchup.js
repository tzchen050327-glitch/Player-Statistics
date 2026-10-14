// CPBL two-team pitcher splits, presented as an alternate view of 投打對決.
(() => {
  'use strict';
  if (typeof renderPitcherBatterPage !== 'function') return;
  const originalRender = renderPitcherBatterPage;
  const teams = PITCHER_BATTER_TEAMS;
  const url = SUPABASE_A_FUNCTIONS_BASE + '/cpbl-team-pitching-matchup';
  let mode = 'teams', teamA = 'AAA', teamB = 'ACN', year = CURRENT_YEAR;
  let role = 'all', sort = 'era', data = null, error = '', loading = false, queried = false, sequence = 0;

  const safe = v => escapeHtml(String(v ?? ''));
  const teamName = code => teams.find(x => x.code === code)?.name || code;
  const tabs = () => `<div class="tpm-tabs" role="tablist" aria-label="對戰查詢模式">
    <button type="button" role="tab" data-tpm-mode="teams" aria-selected="${mode === 'teams'}" class="${mode === 'teams' ? 'active' : ''}">球隊投手對戰</button>
    <button type="button" role="tab" data-tpm-mode="player" aria-selected="${mode === 'player'}" class="${mode === 'player' ? 'active' : ''}">單一球員投打對決</button>
  </div>`;
  const opt = (value, current, title) => `<option value="${safe(value)}" ${String(value) === String(current) ? 'selected' : ''}>${safe(title)}</option>`;
  const ui = () => {
    const el = document.getElementById('pitcherBatterPageContent');
    if (!el) return;
    const years = Array.from({ length:CURRENT_YEAR - 1990 + 1 },(_,i)=>CURRENT_YEAR-i);
    const ready = data?.ok && data?.byRole && !error;
    el.innerHTML = '<div class="tpm-root">' + tabs() + `
      <section class="tpm-panel" aria-label="球隊年度對戰投手排行">
        <header class="tpm-head">
          <strong>球隊對戰投手</strong>
          <span>只統計所選年份兩隊之間的一軍例行賽，不含生涯累計。</span>
        </header>
        <div class="tpm-matchup-row">
          <label class="tpm-team-select"><span>球隊 A</span><select id="tpmA" aria-label="第一支球隊">${teams.map(t=>opt(t.code,teamA,t.name)).join('')}</select></label>
          <strong class="tpm-versus" aria-hidden="true">VS</strong>
          <label class="tpm-team-select"><span>球隊 B</span><select id="tpmB" aria-label="第二支球隊">${teams.map(t=>opt(t.code,teamB,t.name)).join('')}</select></label>
        </div>
        <div class="tpm-controls">
          <label><span>年份</span><select id="tpmYear">${years.map(y=>opt(y,year,y+' 年')).join('')}</select></label>
          <label><span>排序</span><select id="tpmSort">
            ${[['era','防禦率 ERA'],['whip','每局上壘 WHIP'],['outs','投球局數 IP'],['so','三振 SO']].map(([id,title])=>opt(id,sort,title)).join('')}
          </select></label>
        </div>
        <div class="tpm-filter" role="group" aria-label="投手角色">
          ${[['all','全部投手'],['starter','先發'],['reliever','後援']].map(([id,title])=>`<button type="button" data-tpm-role="${id}" class="${role===id?'active':''}" aria-pressed="${role===id}">${title}</button>`).join('')}
        </div>
        <div class="tpm-livebar">
          <span>${year} 年 · 例行賽</span>
          <button type="button" id="tpmReload" ${loading?'disabled':''} aria-label="重新取得兩隊對戰數據">↻ 重新整理</button>
        </div>
        <div id="tpmResult" aria-live="polite">
          ${loading?'<div class="tpm-message">正在整理兩隊交手紀錄…</div>':
            error?`<div class="tpm-error" role="alert">${safe(error)}</div>`:
            ready?renderResult(data):
            '<div class="tpm-message">選擇球隊及年份後顯示年度對戰投手數據。</div>'}
        </div>
      </section></div>`;
    el.querySelectorAll('[data-tpm-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.tpmMode)));
    el.querySelector('#tpmA')?.addEventListener('change',e=>{
      const next=e.target.value,old=teamA;
      teamA=next;if(teamA===teamB)teamB=old;reset();
    });
    el.querySelector('#tpmB')?.addEventListener('change',e=>{
      const next=e.target.value,old=teamB;
      teamB=next;if(teamB===teamA)teamA=old;reset();
    });
    el.querySelector('#tpmYear')?.addEventListener('change',e=>{year=Number(e.target.value);reset()});
    el.querySelector('#tpmSort')?.addEventListener('change',e=>{sort=e.target.value;ui()});
    el.querySelectorAll('[data-tpm-role]').forEach(btn=>btn.addEventListener('click',()=>{role=btn.dataset.tpmRole;ui()}));
    el.querySelector('#tpmReload')?.addEventListener('click',()=>{void query()});
    if(!queried && !loading)queueMicrotask(()=>{if(mode==='teams'&&!queried)void query()});
  };
  function sortedRows(rows) {
    const result=[...rows],small=p=>Number(p.outs||0)<9;
    return result.sort((a,b)=>{
      if(sort==='era'||sort==='whip'){
        // Flag tiny samples and keep them below pitchers with 3+ innings.
        if(small(a)!==small(b))return Number(small(a))-Number(small(b));
        const av=a[sort]===null?Infinity:Number(a[sort]),bv=b[sort]===null?Infinity:Number(b[sort]);
        if(av!==bv)return av-bv;
      } else if (sort==='outs' && a.outs!==b.outs)return b.outs-a.outs;
      else if(sort==='so'&&a.so!==b.so)return b.so-a.so;
      return (b.outs-a.outs)||(b.so-a.so)||String(a.name).localeCompare(String(b.name),'zh-Hant');
    });
  }
  const rate = v=>v===null||v===undefined?'—':Number(v).toFixed(2);
  const metric = (label,value,highlight=false)=>`<span class="tpm-metric ${highlight?'featured':''}"><small>${safe(label)}</small><b>${safe(value)}</b></span>`;
  const detailStat = (label,value)=>`<span class="tpm-detail-stat"><small>${safe(label)}</small><b>${safe(value)}</b></span>`;
  function section(sectionData) {
    const rows=sortedRows(Array.isArray(sectionData?.rows)?sectionData.rows:[]);
    const own=teamName(sectionData.team);
    const opponent=teamName(sectionData.team===teamA?teamB:teamA);
    return `<section class="tpm-team-results" aria-label="${safe(own)}投手對戰成績">
      <header class="tpm-team-heading"><div><strong>${safe(own)}</strong><span>對 ${safe(opponent)}</span></div><small>${rows.length} 位投手</small></header>
      ${rows.length?`<div class="tpm-pitcher-list">
        ${rows.map((p,index)=>`<details class="tpm-pitcher-card">
          <summary aria-label="${safe(p.name)}，查看完整投手成績">
            <span class="tpm-player-head">
              <span class="tpm-rank">${index+1}</span>
              <span class="tpm-player-name"><b>${safe(p.name)}</b>
                ${Number(p.outs)<9?'<small>投球未滿 3 局</small>':`<small>${safe(p.g)} 場出賽 · ${safe(p.w)} 勝 ${safe(p.l)} 敗</small>`}
              </span>
              <span class="tpm-detail-toggle">詳細 <span class="tpm-chevron" aria-hidden="true">⌄</span></span>
            </span>
            <span class="tpm-metric-row">
              ${metric('IP',p.ip)}
              ${metric('ERA',rate(p.era),sort==='era')}
              ${metric('WHIP',rate(p.whip),sort==='whip')}
              ${metric('SO',p.so,sort==='so')}
            </span>
          </summary>
          <div class="tpm-detail-grid" aria-label="完整投手數據">
            ${detailStat('G 出賽',p.g)}
            ${detailStat('GS 先發',p.gs)}
            ${detailStat('W–L',p.w+'–'+p.l)}
            ${detailStat('H 被安打',p.h)}
            ${detailStat('BB 保送',p.bb)}
            ${detailStat('HBP 觸身球',p.hbp)}
            ${detailStat('HR 被全壘打',p.hr)}
            ${detailStat('ER 自責分',p.er)}
            ${detailStat('SV 救援',p.sv)}
            ${detailStat('HLD 中繼',p.hld)}
            ${detailStat('球數',p.pitches)}
          </div>
        </details>`).join('')}
      </div>`:'<div class="tpm-message">這組條件沒有對戰投手紀錄。</div>'}
    </section>`;
  }
  function renderResult(d) {
    const parts=Array.isArray(d.byRole?.[role])?d.byRole[role]:[];
    return `<div class="tpm-coverage ${!d.complete?'incomplete':''}">
      <strong>${Number(d.completedGames)||0} / ${Number(d.games)||0} 場交手已統計</strong>
      <span>${d.complete?'來源：CPBL 官方逐場投手紀錄':'有 '+(Number(d.failedGames)||0)+' 場讀取失敗，以下是部分資料，不能視為完整排名。'}</span>
    </div>
    ${parts.map(section).join('')}
    <p class="tpm-footnote">按投手卡片可展開完整數據。IP 以出局數累計；ERA 與 WHIP 依總局數重新計算。依 ERA／WHIP 排序時，未滿 3 局的投手排列在後，不會隱藏。</p>`;
  }
  function reset(){++sequence;loading=false;queried=false;data=null;error='';ui()}
  async function query(){
    const seq=++sequence;loading=true;queried=true;data=null;error='';ui();
    try{
      const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appKey:CPBL_APP_KEY,teamA,teamB,year})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||'CPBL 對戰資料暫時無法取得（'+response.status+'）');
      if(seq!==sequence)return;
      data=payload;
    }catch(e){if(seq!==sequence)return;error=String(e?.message||'對戰資料查詢失敗')}
    finally{if(seq===sequence){loading=false;ui()}}
  }
  function setMode(next){
    if(next===mode)return;mode=next;sequence++;loading=false;if(mode==='teams'&&!data)queried=false;
    renderPitcherBatterPage();
  }
  renderPitcherBatterPage=function(){
    document.body?.classList.toggle('tpm-team-mode',mode==='teams');
    if(mode==='teams'){ui();return}
    originalRender();
    const el=document.getElementById('pitcherBatterPageContent');
    if(!el)return;
    el.insertAdjacentHTML('afterbegin',tabs());
    el.querySelectorAll('[data-tpm-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.tpmMode)));
  };
  if(!document.getElementById('tpmStyles')){
    const style=document.createElement('style');style.id='tpmStyles';
    style.textContent=`
    /* Same mobile composition at every width; desktop enlarges it up to 2x. */
    body.tpm-team-mode #pitcherBatterPage .data-center-search,
    body.tpm-team-mode #pitcherBatterPage .data-center-search-note{display:none!important}
    body.tpm-team-mode #pitcherBatterPage .data-center-toolbar,
    body.tpm-team-mode #pitcherBatterPage .player-tools-page-top,
    body.tpm-team-mode #pitcherBatterPage .player-tools-page-head{
      width:min(100%,780px);max-width:780px;margin-inline:auto
    }
    body.tpm-team-mode #pitcherBatterPage .data-center-tab{
      font-size:clamp(12px,1.9vw,24px);padding:clamp(10px,1.2vw,21px) 5px
    }
    body.tpm-team-mode #pitcherBatterPage .player-tools-page-head h2{
      font-size:clamp(20px,2.6vw,38px)
    }
    .tpm-root{width:min(100%,780px);margin-inline:auto;container-type:inline-size;min-width:0}
    .tpm-root *{box-sizing:border-box}
    .tpm-root>.tpm-panel,.tpm-root>.tpm-tabs{--tpm-u:clamp(1px,.26cqi,2px)}
    .tpm-root>.tpm-tabs{
      display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--tpm-u)*5);
      border-radius:calc(var(--tpm-u)*12);padding:calc(var(--tpm-u)*4);
      background:var(--panel-muted,rgba(120,135,155,.12));
      margin-bottom:calc(var(--tpm-u)*15)
    }
    .tpm-root .tpm-tabs button{
      min-width:0;border:0;border-radius:calc(var(--tpm-u)*9);
      padding:calc(var(--tpm-u)*12) calc(var(--tpm-u)*4);
      background:transparent;color:var(--text,inherit);
      font:inherit;font-size:calc(var(--tpm-u)*13);font-weight:800;
      line-height:1.35;cursor:pointer
    }
    .tpm-root .tpm-tabs button.active{
      color:var(--text,inherit);background:var(--panel,#fff);
      box-shadow:0 1px 5px rgba(0,0,0,.13)
    }
    .tpm-panel{
      display:grid;gap:calc(var(--tpm-u)*13);
      font-size:calc(var(--tpm-u)*14);line-height:1.45;
      font-variant-numeric:tabular-nums;min-width:0;color:var(--text)
    }
    .tpm-head{display:grid;gap:.25em;margin-bottom:.15em}
    .tpm-head strong{font-size:1.45em;font-weight:900;line-height:1.25}
    .tpm-head span{font-size:.86em;line-height:1.55;color:var(--muted,#858b93)}
    .tpm-matchup-row{
      display:grid;grid-template-columns:minmax(0,1fr) 2.1em minmax(0,1fr);
      align-items:end;gap:.4em
    }
    .tpm-team-select,.tpm-controls label{
      display:grid;gap:.38em;min-width:0;
      font-size:.82em;font-weight:750;color:var(--muted,#858b93)
    }
    .tpm-matchup-row select,.tpm-controls select{
      display:block;width:100%;min-width:0;min-height:2.9em;
      border:1px solid var(--line,#ccc);border-radius:.65em;
      background:var(--panel,#fff);color:var(--text,inherit);
      padding:.7em .6em;font:inherit;font-size:1.2em
    }
    .tpm-versus{text-align:center;align-self:end;line-height:2.9em;font-size:.92em;color:var(--muted,#858b93)}
    .tpm-controls{display:grid;grid-template-columns:1fr 1fr;gap:.7em}
    .tpm-filter{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.34em;
      padding:.28em;border-radius:.7em;background:var(--panel-muted,rgba(120,135,155,.12))
    }
    .tpm-filter button{
      min-width:0;min-height:2.7em;border:0;border-radius:.55em;
      background:transparent;color:var(--text,inherit);
      font:inherit;font-size:.93em;font-weight:800;cursor:pointer
    }
    .tpm-filter button.active{
      background:var(--panel,#fff);box-shadow:0 1px 6px rgba(0,0,0,.13)
    }
    .tpm-livebar{display:flex;align-items:center;justify-content:space-between;gap:.7em}
    .tpm-livebar span{font-size:.85em;color:var(--muted,#858b93);font-weight:700}
    .tpm-livebar button{
      border:1px solid var(--line,#ccc);border-radius:.65em;
      background:var(--panel,#fff);color:var(--text,inherit);
      padding:.56em .85em;font:inherit;font-size:.84em;font-weight:700;cursor:pointer
    }
    .tpm-livebar button:disabled{opacity:.6;cursor:wait}
    .tpm-message,.tpm-error{
      border:1px solid var(--line,#ccc);border-radius:.75em;
      padding:1.25em 1em;font-size:.92em;line-height:1.65;color:var(--muted,#858b93)
    }
    .tpm-error{color:#d56161;border-color:#b86c6c}
    .tpm-coverage{
      display:grid;gap:.14em;padding:.8em 1em;border-radius:.75em;
      border:1px solid var(--line,#ccc);margin-bottom:1.15em
    }
    .tpm-coverage strong{font-size:1em;font-weight:850}
    .tpm-coverage span{font-size:.78em;color:var(--muted,#858b93)}
    .tpm-coverage.incomplete{border-color:#b28c58}
    .tpm-team-results{margin:0 0 1.4em}
    .tpm-team-heading{
      display:flex;justify-content:space-between;align-items:center;
      gap:.5em;margin:0 0 .7em;padding-bottom:.5em;
      border-bottom:1px solid var(--line,#ccc)
    }
    .tpm-team-heading>div{display:flex;align-items:baseline;gap:.55em;min-width:0}
    .tpm-team-heading strong{font-size:1.28em;font-weight:900}
    .tpm-team-heading span{font-size:.8em;color:var(--muted,#858b93)}
    .tpm-team-heading>small{font-size:.75em;color:var(--muted,#858b93);white-space:nowrap}
    .tpm-pitcher-list{display:grid;gap:.56em}
    .tpm-pitcher-card{
      min-width:0;overflow:hidden;background:var(--panel,#fff);
      border:1px solid var(--line,#ccc);border-radius:.82em
    }
    .tpm-pitcher-card[open]{border-color:var(--accent,#5286bd)}
    .tpm-pitcher-card summary{display:block;padding:.78em .84em;cursor:pointer;list-style:none}
    .tpm-pitcher-card summary::-webkit-details-marker{display:none}
    .tpm-pitcher-card summary::marker{content:''}
    .tpm-player-head{display:grid;grid-template-columns:1.6em minmax(0,1fr) auto;align-items:center;gap:.55em}
    .tpm-rank{
      display:grid;place-items:center;width:1.6em;height:1.6em;border-radius:.4em;
      background:var(--panel-muted,rgba(120,135,155,.12));font-size:.83em;font-weight:850
    }
    .tpm-player-name{display:flex;flex-direction:column;gap:.09em;min-width:0}
    .tpm-player-name b{font-size:1.12em;font-weight:900}
    .tpm-player-name small{font-size:.75em;color:var(--muted,#858b93);line-height:1.4}
    .tpm-detail-toggle{font-size:.8em;color:var(--muted,#858b93);white-space:nowrap}
    .tpm-chevron{display:inline-block;transition:transform .18s ease;font-size:1.15em}
    .tpm-pitcher-card[open] .tpm-chevron{transform:rotate(180deg)}
    .tpm-metric-row{
      display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
      gap:.25em;margin-top:.74em;padding-top:.68em;border-top:1px solid var(--line,#ccc)
    }
    .tpm-metric{display:flex;flex-direction:column;align-items:center;gap:.16em;min-width:0}
    .tpm-metric small{font-size:.72em;color:var(--muted,#858b93);font-weight:700}
    .tpm-metric b{font-size:1.18em;font-weight:900;white-space:nowrap}
    .tpm-metric.featured b{color:var(--accent,#4780b7)}
    .tpm-detail-grid{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6em .35em;
      padding:.85em .84em 1em;border-top:1px solid var(--line,#ccc);
      background:var(--panel-muted,rgba(120,135,155,.07))
    }
    .tpm-detail-stat{display:grid;gap:.12em;min-width:0;text-align:center}
    .tpm-detail-stat small{font-size:.7em;color:var(--muted,#858b93)}
    .tpm-detail-stat b{font-size:1em;font-weight:800}
    .tpm-footnote{margin:0 0 1.5em;font-size:.82em;line-height:1.65;color:var(--muted,#858b93)}
    .tpm-root button:focus-visible,.tpm-root select:focus-visible,
    .tpm-pitcher-card summary:focus-visible{outline:2px solid var(--accent,#5286bd);outline-offset:2px}
    @media(prefers-reduced-motion:reduce){.tpm-chevron{transition:none}}
    `;
    document.head.appendChild(style);
  }
})();