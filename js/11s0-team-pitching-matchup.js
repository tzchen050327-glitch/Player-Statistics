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
    const years = Array.from({length:CURRENT_YEAR - 1990 + 1},(_,i)=>CURRENT_YEAR-i);
    const ready = data?.ok && data?.byRole && !error;
    el.innerHTML = tabs() + `
      <section class="tpm-panel" aria-label="球隊年度對戰投手排行">
        <div class="tpm-head"><strong>球隊對戰投手表現</strong><span>僅計算所選年度、兩隊正式例行賽交手的投手紀錄，不混入其他對手或生涯成績。</span></div>
        <div class="tpm-picker">
          <label>球隊 A<select id="tpmA">${teams.map(t=>opt(t.code,teamA,t.name)).join('')}</select></label>
          <label>球隊 B<select id="tpmB">${teams.map(t=>opt(t.code,teamB,t.name)).join('')}</select></label>
          <label>年度<select id="tpmYear">${years.map(y=>opt(y,year,y+' 年')).join('')}</select></label>
        </div>
        <div class="tpm-filter">
          <div role="group" aria-label="投手角色">
            ${[['all','全部'],['starter','先發'],['reliever','後援']].map(([id,title])=>`<button type="button" data-tpm-role="${id}" class="${role===id?'active':''}" aria-pressed="${role===id}">${title}</button>`).join('')}
          </div>
          <label>排序方式<select id="tpmSort">
            ${[['era','ERA（低至高）'],['whip','WHIP（低至高）'],['outs','投球局數（高至低）'],['so','三振（高至低）']].map(([id,title])=>opt(id,sort,title)).join('')}
          </select></label>
          <button type="button" id="tpmReload" ${loading?'disabled':''}>${loading?'查詢中…':'重新查詢'}</button>
        </div>
        <div id="tpmResult" aria-live="polite">
          ${loading?'<div class="tpm-message">正在彙整兩隊正式交手的逐場投手紀錄。初次建立年度快取時需要讀取場次資料。</div>':
            error?`<div class="tpm-error" role="alert">${safe(error)}</div>`:
            ready?renderResult(data):
            '<div class="tpm-message">選好兩隊與年度，即可查看雙方投手對戰成績。</div>'}
        </div>
      </section>`;
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
  function section(sectionData) {
    const rows=sortedRows(Array.isArray(sectionData?.rows)?sectionData.rows:[]);
    return `<section class="tpm-team-results">
      <h3>${safe(teamName(sectionData.team))} <span>對 ${safe(teamName(sectionData.team===teamA?teamB:teamA))} · ${year}</span></h3>
      ${rows.length?`<div class="tpm-table-scroll"><table class="tpm-table">
        <thead><tr><th>投手</th><th>G</th><th>GS</th><th>W-L</th><th>IP</th><th>ERA</th><th>WHIP</th><th>SO</th><th>BB</th><th>H</th><th>HR</th><th>ER</th><th>SV</th><th>HLD</th></tr></thead>
        <tbody>${rows.map(p=>`<tr>
          <th scope="row">${safe(p.name)}${p.outs<9?'<small title="未滿 3 局">少量局數</small>':''}</th>
          <td>${p.g}</td><td>${p.gs}</td><td>${p.w}-${p.l}</td><td>${safe(p.ip)}</td>
          <td>${rate(p.era)}</td><td>${rate(p.whip)}</td><td>${p.so}</td><td>${p.bb}</td><td>${p.h}</td><td>${p.hr}</td><td>${p.er}</td><td>${p.sv}</td><td>${p.hld}</td>
        </tr>`).join('')}</tbody></table></div>`:'<div class="tpm-message">這組條件沒有對戰投手紀錄。</div>'}
    </section>`;
  }
  function renderResult(d) {
    const parts=Array.isArray(d.byRole?.[role])?d.byRole[role]:[];
    return `<div class="tpm-coverage ${!d.complete?'incomplete':''}">
      <strong>已取得 ${Number(d.completedGames)||0} / ${Number(d.games)||0} 場交手紀錄</strong>
      <span>${d.complete?'CPBL 官方逐場投手紀錄；數據僅為 '+year+' 年例行賽交手':'注意：有 '+(Number(d.failedGames)||0)+' 場讀取失敗，以下僅為部分數據，暫不能作為完整年度排名。'}</span>
    </div>
    ${parts.map(section).join('')}
    <div class="tpm-footnote">IP 以投球出局數正確累計；ERA = 自責分 × 9 ÷ 局數；WHIP =（被安打＋保送）÷ 局數。先發／後援依「該場」身分分類。ERA／WHIP 排序把未滿 3 局者置後，但不隱藏。</div>`;
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
    if(next===mode)return;mode=next;sequence++;loading=false;
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
    body.tpm-team-mode #pitcherBatterPage .data-center-search,body.tpm-team-mode #pitcherBatterPage .data-center-search-note{display:none!important}
    .tpm-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-radius:13px;padding:5px;background:var(--panel-muted,rgba(120,135,155,.12));margin-bottom:16px}
    .tpm-tabs button{border:0;border-radius:9px;padding:13px 7px;background:transparent;color:var(--text,inherit);font:inherit;font-size:clamp(12px,3vw,15px);font-weight:750;cursor:pointer}
    .tpm-tabs button.active{background:var(--panel,#fff);box-shadow:0 2px 8px rgba(0,0,0,.14);color:var(--text,inherit)}
    .tpm-panel{display:grid;gap:16px}
    .tpm-head{display:grid;gap:6px}.tpm-head strong{font-size:21px}.tpm-head span{font-size:13px;line-height:1.6;color:var(--muted,#858b93)}
    .tpm-picker{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .tpm-picker label,.tpm-filter label{display:flex;flex-direction:column;gap:7px;color:var(--muted,#858b93);font-size:12px;font-weight:750}
    .tpm-picker select,.tpm-filter select{min-width:0;width:100%;background:var(--panel,#fff);color:var(--text,inherit);border:1px solid var(--line,#ccc);padding:12px 8px;border-radius:10px;font:inherit;font-size:15px}
    .tpm-filter{display:flex;justify-content:space-between;align-items:end;flex-wrap:wrap;gap:10px}
    .tpm-filter [role=group]{display:flex;gap:5px;border-radius:9px;padding:4px;background:var(--panel-muted,rgba(120,135,155,.12))}
    .tpm-filter [role=group] button{border:0;border-radius:7px;background:transparent;color:var(--text,inherit);padding:10px 16px;font-size:13px;font-weight:750;cursor:pointer}
    .tpm-filter [role=group] button.active{background:var(--panel,#fff);box-shadow:0 1px 5px rgba(0,0,0,.12)}
    .tpm-filter #tpmReload{border:1px solid var(--line,#ccc);background:var(--panel,#fff);color:var(--text,inherit);border-radius:9px;padding:11px 13px;font-weight:650;cursor:pointer}
    .tpm-message,.tpm-error{padding:18px 13px;border-radius:11px;border:1px solid var(--line,#ccc);line-height:1.6;color:var(--muted,#858b93)}
    .tpm-error{color:#d56161;border-color:#b86c6c}
    .tpm-coverage{border:1px solid var(--line,#ccc);border-radius:12px;padding:11px 14px;display:grid;gap:4px;margin-bottom:13px}
    .tpm-coverage strong{font-size:14px}.tpm-coverage span{font-size:12px;color:var(--muted,#858b93);line-height:1.5}.tpm-coverage.incomplete{border-color:#b28c58}
    .tpm-team-results{margin:12px 0 22px}.tpm-team-results h3{font-size:18px;margin:0 0 11px}.tpm-team-results h3 span{font-size:12px;font-weight:550;color:var(--muted,#858b93);margin-left:6px}
    .tpm-table-scroll{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line,#ccc);border-radius:11px}
    .tpm-table{min-width:980px;width:100%;border-collapse:collapse;font-size:13px;color:var(--text,inherit);font-variant-numeric:tabular-nums}
    .tpm-table th,.tpm-table td{padding:11px 10px;border-bottom:1px solid var(--line,#ccc);text-align:right;white-space:nowrap}
    .tpm-table tr:last-child th,.tpm-table tr:last-child td{border-bottom:0}
    .tpm-table th:first-child{text-align:left;position:sticky;left:0;z-index:1;background:var(--panel,#fff);min-width:100px}
    .tpm-table thead th{font-size:11px;color:var(--muted,#858b93);font-weight:750}
    .tpm-table tbody th{font-size:14px;font-weight:800}
    .tpm-table tbody th small{display:block;font-weight:500;font-size:10px;color:var(--muted,#858b93)}
    .tpm-footnote{color:var(--muted,#858b93);font-size:12px;line-height:1.7}
    @media(max-width:520px){.tpm-picker{grid-template-columns:1fr 1fr}.tpm-picker label:last-child{grid-column:span 2}.tpm-filter{display:grid;grid-template-columns:1fr 1fr}.tpm-filter [role=group]{grid-column:span 2;justify-content:stretch}.tpm-filter [role=group] button{flex:1}.tpm-head strong{font-size:19px}}
    `;
    document.head.appendChild(style);
  }
})();