/* DiamondScope music center v9.65 — six-team blank catalog and device-local editor. */
(() => {
  'use strict';
  const root=document.getElementById('musicCenterPage');
  const picker=document.getElementById('musicCenterTeamPicker');
  const content=document.getElementById('musicCenterTeamContent');
  const header=document.getElementById('musicCenterPageTitle');
  const back=document.getElementById('musicCenterBackHomeBtn');
  const open=document.getElementById('homeMusicCenterBtn');
  if(!root||!picker||!content||!header||!back||!open) return;
  const TEAMS=['中信兄弟','統一7-ELEVEn獅','樂天桃猿','富邦悍將','味全龍','台鋼雄鷹'];
  const TYPES=['球員曲','Chance','主題曲','狀態曲'];
  const SPECIAL=[{id:'strikeout',title:'三振'},{id:'walk',title:'保送'},{id:'challenge',title:'挑戰'}];
  const STORAGE='diamondscope-music-catalog-draft-v2';
  const ROSTER_CACHE='diamondscope-music-roster-2026-cache-v1';
  let team='',type='球員曲',selected=null,admin=false,holdTimer=null,roster=null,loadError='',query='';
  let draft={version:2,tracks:{},extraPlayers:{},playerEdits:{},items:{}};
  try {
    const old=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(old&&old.version===2&&typeof old.tracks==='object') draft={...draft,...old};
  }catch{}
  const $=(tag,txt='',cls='')=>{const e=document.createElement(tag);e.textContent=txt;if(cls)e.className=cls;return e};
  const btn=(txt,fn,cls='')=>{const b=$('button',txt,cls);b.type='button';b.addEventListener('click',fn);return b};
  const write=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(draft));return true}catch{alert('無法儲存本機資料，請檢查瀏覽器儲存空間。');return false}};
  const rosterTeam=t=>Array.isArray(roster?.teams?.[t])?roster.teams[t]:[];
  const arrKey=(t,k)=>t+'|'+k;
  const entryKey=(t,k,id)=>t+'|'+k+'|'+id;
  const normalizeTeam=t=>String(t||'').replace(/二軍$/,'').replace('統一獅','統一7-ELEVEn獅');
  const parseId=value=>{
    const v=String(value||'').trim();
    if(/^[a-zA-Z0-9_-]{11}$/.test(v))return v;
    try {
      const u=new URL(v),host=u.hostname.toLowerCase();
      let id='';
      if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
        id=u.pathname==='/watch'?u.searchParams.get('v')||'':/^(\/shorts\/|\/live\/|\/embed\/)/.test(u.pathname)?u.pathname.split('/')[2]||'':'';
      }else if(['youtu.be','www.youtu.be'].includes(host)) id=u.pathname.split('/')[1]||'';
      return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:'';
    }catch{return ''}
  };
  const input=(label,val='',type='text')=>{
    const wrap=$('label','','music-edit-label'),caption=$('span',label),field=document.createElement('input');
    field.type=type;field.value=String(val??'');field.autocomplete='off';
    if(type==='number')field.min='0';
    wrap.append(caption,field);return {wrap,field};
  };
  function navigate(target){
    if(typeof currentPage!=='undefined'&&typeof renderAll==='function'){currentPage=target;renderAll()}
    else{document.getElementById('homePage')?.classList.toggle('hidden',target!=='home');root.classList.toggle('hidden',target!=='music-center')}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function effectivePlayer(raw){
    const edit=draft.playerEdits?.[entryKey(team,'player',raw.id)]||{};
    return {...raw,name:edit.name??raw.name,number:edit.number??raw.number,hidden:!!edit.hidden,custom:!!raw.custom};
  }
  function playersForTeam(){
    const baseline=rosterTeam(team),extras=draft.extraPlayers?.[team]||[],byId=new Map();
    for(const p of [...baseline,...extras])if(p?.id&&p?.name)byId.set(String(p.id),effectivePlayer(p));
    const n=p=>/^\d+$/.test(p.number||'')?Number(p.number):999;
    return [...byId.values()].filter(p=>!p.hidden&&p.role!=='pitcher').sort((a,b)=>
      n(a)-n(b)||(a.number==='00'?-1:b.number==='00'?1:0)||String(a.number).localeCompare(String(b.number))||String(a.name).localeCompare(String(b.name),'zh-Hant'));
  }
  function categoryItems(){
    if(type==='球員曲')return playersForTeam().map(p=>({...p,title:'#'+(p.number||'—')+' '+p.name,category:'player'}));
    const extras=(draft.items?.[arrKey(team,type)]||[]).filter(p=>p?.id&&p?.title);
    return type==='狀態曲'?[...SPECIAL.map(i=>({...i,category:type})),...extras]:extras;
  }
  function assigned(item){
    return draft.tracks?.[entryKey(team,item.category||type,item.id)]||null;
  }
  function notify(msg,target=content){
    const e=$('div',msg,'music-alert');target.prepend(e);
    setTimeout(()=>e.remove(),3300);
  }
  function navItem(b){
    b.classList.toggle('active',b.textContent===type);
    b.setAttribute('aria-pressed',String(b.textContent===type));
  }
  function renderPicker(){
    team='';selected=null;query='';picker.classList.remove('hidden');content.classList.add('hidden');content.replaceChildren();
    header.textContent='音樂中心';back.textContent='← 返回首頁';
    picker.querySelector('.music-admin-panel')?.remove();
    if(admin){
      const pane=$('section','','music-admin-panel');
      pane.append($('strong','歌曲管理模式（本機草稿）'));
      pane.append($('p','選一隊後即可修改球員名單、填入 YouTube 影片，並匯出備份。尚未向全站發布。'));
      pane.append(btn('匯出六隊設定',exportDraft,'music-admin-btn'));
      const label=$('label','匯入設定檔：','music-upload-label'),file=document.createElement('input');
      file.type='file';file.accept='application/json,.json';file.addEventListener('change',async()=>{
        const chosen=file.files?.[0];if(!chosen)return;
        try{
          const data=JSON.parse(await chosen.text());
          if(data?.version!==2||typeof data.tracks!=='object'||!data.tracks)throw Error('檔案格式不符');
          if(!confirm('要以匯入檔覆蓋這台裝置的音樂草稿嗎？'))return;
          draft={version:2,tracks:data.tracks,extraPlayers:data.extraPlayers||{},playerEdits:data.playerEdits||{},items:data.items||{}};
          if(write())renderPicker();
        }catch(e){alert('匯入失敗：'+e.message)}
      });label.append(file);pane.append(label);
      pane.append(btn('結束管理',()=>{admin=false;renderPicker()},'music-admin-secondary'));
      picker.append(pane);
    }
  }
  function enterTeam(name){
    team=name;type='球員曲';selected=null;query='';
    picker.classList.add('hidden');content.classList.remove('hidden');back.textContent='← 返回音樂中心';
    header.textContent=name;renderCategory();
  }
  function addPlayerForm(anchor){
    const panel=$('div','','music-edit-panel');panel.append($('strong','手動新增名單球員'));
    const num=input('背號（可留空）'),name=input('球員姓名'),id=input('中職球員 ID（可留空）');
    panel.append(num.wrap,name.wrap,id.wrap);
    panel.append(btn('新增球員',()=>{
      const nm=name.field.value.trim(),number=num.field.value.trim(),official=id.field.value.trim();
      if(!nm){notify('請輸入球員姓名',panel);return}
      if(number&&!/^\d{1,3}$/.test(number)){notify('背號請使用數字',panel);return}
      const exists=playersForTeam().some(p=>p.name===nm&&(p.number||'')===number);
      if(exists){notify('這位球員已在名單內',panel);return}
      const next={id:official&&/^\d{4,12}$/.test(official)?official:'manual-'+Date.now().toString(36),name:nm,number,custom:true,level:''};
      (draft.extraPlayers[team]??=[]).push(next);
      if(write()){query='';renderCategory()}
    },'music-admin-btn'));anchor.append(panel);
  }
  function addSongForm(anchor){
    const panel=$('div','','music-edit-panel'),name=input('歌曲名稱'),year=input('年份（2017–2026，可留空）','', 'number');
    panel.append($('strong','新增'+type),name.wrap,year.wrap);
    panel.append(btn('新增空白曲目',()=>{
      const title=name.field.value.trim().slice(0,100),yr=String(year.field.value).trim();
      if(!title){notify('請先輸入歌曲名稱',panel);return}
      if(yr&&(!/^\d{4}$/.test(yr)||+yr<2017||+yr>2026)){notify('年份請輸入 2017–2026',panel);return}
      const item={id:'custom-'+Date.now().toString(36),title,year:yr?+yr:null,category:type};
      (draft.items[arrKey(team,type)]??=[]).push(item);
      if(write())renderCategory();
    },'music-admin-btn'));anchor.append(panel);
  }
  function renderCategory(){
    selected=null;content.replaceChildren();
    const tabs=$('div','','music-center-subnav');
    for(const t of TYPES){const b=btn(t,()=>{type=t;query='';renderCategory()});tabs.append(b);navItem(b)}
    content.append(tabs);
    if(!roster && type==='球員曲')content.append($('p',loadError||'正在載入 2026 球員名單…','music-song-note'));
    if(admin){
      const management=$('div','','music-admin-status');
      management.append($('strong','編輯模式 · '+team));
      management.append($('small','僅這台裝置的草稿，儲存後可立即預覽；尚未全站同步'));
      management.append(btn('匯出備份',exportDraft,'music-admin-secondary'));
      management.append(btn('離開管理',()=>{admin=false;renderCategory()},'music-admin-secondary'));
      content.append(management);
      if(type==='球員曲')addPlayerForm(content);else addSongForm(content);
    }
    if(type==='球員曲'){
      const find=document.createElement('input');find.className='music-search';find.type='search';find.placeholder='搜尋背號或球員姓名';find.value=query;
      find.addEventListener('input',()=>{query=find.value;renderCards()});
      content.append(find);
      const stats=$('p','','music-song-note');stats.id='musicRosterCount';content.append(stats);
      if(!roster){const retry=btn('重新讀取球員名單',()=>void loadRoster(true),'music-admin-secondary');content.append(retry)}
    }else content.append($('p',type==='狀態曲'?'三振、保送、挑戰：等待你指定影片。':'這個分類目前沒有歌曲，可從管理模式新增。','music-song-note'));
    const grid=$('div','','music-song-grid');grid.id='musicListGrid';content.append(grid);renderCards();
  }
  function renderCards(){
    const grid=content.querySelector('#musicListGrid');if(!grid)return;
    grid.replaceChildren();let items=categoryItems();
    if(type==='球員曲'&&query.trim()){const kw=query.trim().toLowerCase();items=items.filter(p=>(p.name+' '+p.number).toLowerCase().includes(kw))}
    const count=content.querySelector('#musicRosterCount');
    if(count)count.textContent='2026 球季野手：'+items.length+' 位球員（含一、二軍已留有比賽紀錄者；並非當日登錄公告）';
    for(const item of items){
      const b=btn(item.title,()=>showSong(item.id),'music-song-item');
      const source=assigned(item);
      b.append($('small',source?.videoId?'已設定影片':'尚未設定應援曲'));
      if(item.level)b.append($('small',item.level==='D'?'二軍紀錄':'一軍紀錄'));
      if(item.year)b.append($('small',item.year+' 年'));
      grid.append(b);
    }
    if(!items.length)grid.append($('p',type==='球員曲'?(roster?'沒有符合條件的球員':'目前無法載入球員資料'):'尚無曲目，長按標題五秒開啟管理後可新增。','music-song-note'));
  }
  function showSong(id){
    const all=categoryItems(),index=all.findIndex(p=>p.id===id);
    if(index<0){renderCategory();return}
    const item=all[index];selected=item;content.replaceChildren();
    content.append(btn('← 返回'+type,renderCategory,'music-song-back'));
    content.append($('h3',item.title,'music-song-heading'));
    const track=assigned(item),player=document.createElement('div');player.className='music-song-player';
    if(track?.videoId){
      const f=document.createElement('iframe');
      f.src='https://www.youtube-nocookie.com/embed/'+track.videoId+'?start='+Math.floor(Math.max(0,Number(track.start)||0))+'&rel=0';
      f.title=item.title+' · YouTube';f.loading='lazy';f.allow='accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture;web-share';f.allowFullscreen=true;
      f.referrerPolicy='strict-origin-when-cross-origin';player.append(f);
    }else player.append($('p','尚未加入應援曲','music-song-note'));
    content.append(player);
    if(type==='球員曲'){
      const hint=$('p','2026 球員資料','music-song-note');content.append(hint);
      try {
        const local=typeof players!=='undefined'?players:[];
        const match=local.find(p=>String(p.cpblAcnt||'')===String(item.id))||
          local.find(p=>p.name===item.name&&normalizeTeam(p.cpblTeam)===team);
        if(match&&typeof selectPlayer==='function') content.append(btn('查看本站球員頁 ↗',()=>{void selectPlayer(match.id)},'music-player-link'));
        else content.append($('p','本站尚未建立這位球員的個人資料，暫無球員頁連結。','music-song-note'));
      }catch{}
    }
    if(admin)renderEditor(item);
    const controls=$('div','','music-song-controls');
    controls.append(btn('← 上一首',()=>showSong(all[(index-1+all.length)%all.length].id)));
    controls.append(btn('下一首 →',()=>showSong(all[(index+1)%all.length].id)));
    content.append(controls);
  }
  function renderEditor(item){
    const panel=$('section','','music-edit-panel'),track=assigned(item)||{};
    panel.append($('strong','管理這首歌曲'));
    const url=input('YouTube 影片網址（留空即不播放）',track.videoId?'https://www.youtube.com/watch?v='+track.videoId:'','url');
    const start=input('起播秒數',track.start||0,'number');
    panel.append(url.wrap,start.wrap);
    panel.append(btn('儲存這首歌曲',()=>{
      const raw=url.field.value.trim(),id=raw?parseId(raw):'';
      if(raw&&!id){notify('請貼上有效的 YouTube 單支影片網址',panel);return}
      if(id)draft.tracks[entryKey(team,item.category||type,item.id)]={videoId:id,start:Math.max(0,Math.floor(Number(start.field.value)||0))};
      else delete draft.tracks[entryKey(team,item.category||type,item.id)];
      if(write())showSong(item.id);
    },'music-admin-btn'));
    if(type==='球員曲'){
      panel.append($('strong','球員名單修正'));
      const n=input('背號',item.number||''),nm=input('球員姓名',item.name);
      panel.append(n.wrap,nm.wrap);
      panel.append(btn('儲存姓名與背號',()=>{
        const newName=nm.field.value.trim(),newNumber=n.field.value.trim();
        if(!newName||newNumber&&!/^\d{1,3}$/.test(newNumber)){notify('請確認姓名與背號',panel);return}
        draft.playerEdits[entryKey(team,'player',item.id)]={...draft.playerEdits[entryKey(team,'player',item.id)],name:newName,number:newNumber};
        if(write())renderCategory();
      },'music-admin-secondary'));
      panel.append(btn('從音樂名單隱藏此球員',()=>{
        if(!confirm('確定隱藏 '+item.name+'？不會刪除既有球員資料。'))return;
        draft.playerEdits[entryKey(team,'player',item.id)]={...draft.playerEdits[entryKey(team,'player',item.id)],hidden:true};
        if(write())renderCategory();
      },'music-admin-danger'));
    }else if(!SPECIAL.some(p=>p.id===item.id)){
      const name=input('曲目名稱',item.title),year=input('年份',item.year||'','number');panel.append(name.wrap,year.wrap);
      panel.append(btn('儲存曲目名稱',()=>{
        const key=arrKey(team,type),found=draft.items[key]?.find(p=>p.id===item.id);
        if(!found||!name.field.value.trim()){notify('請填入歌曲名稱',panel);return}
        found.title=name.field.value.trim().slice(0,100);
        found.year=year.field.value?Number(year.field.value):null;
        if(write())showSong(item.id);
      },'music-admin-secondary'));
      panel.append(btn('刪除這個曲目',()=>{
        if(!confirm('確定刪除曲目與其本機影片設定？'))return;
        draft.items[arrKey(team,type)]=draft.items[arrKey(team,type)].filter(p=>p.id!==item.id);
        delete draft.tracks[entryKey(team,type,item.id)];
        if(write())renderCategory();
      },'music-admin-danger'));
    }
    content.append(panel);
  }
  async function loadRoster(force=false){
    if(!force&&roster)return;
    try{
      const response=await fetch('./data/music-roster-2026.json?v=v9.65',{cache:'force-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const value=await response.json();
      if(value.season!==2026||typeof value.teams!=='object')throw Error('資料格式不符');
      roster=value;loadError='';
      try{localStorage.setItem(ROSTER_CACHE,JSON.stringify(value))}catch{}
    }catch(e){
      try{roster=JSON.parse(localStorage.getItem(ROSTER_CACHE)||'null')}catch{}
      loadError=roster?'使用上次儲存的球員名單':'球員名單載入失敗：'+e.message;
    }
    if(team&&type==='球員曲'&&!selected)renderCategory();
  }
  function exportDraft(){
    const payload=JSON.stringify({...draft,exportedAt:new Date().toISOString()},null,2);
    const blob=new Blob([payload],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='diamondscope-music-draft-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  function enableAdmin(){
    admin=true;clearTimeout(holdTimer);
    if(team){if(selected)showSong(selected.id);else renderCategory()}
    else renderPicker();
  }
  function beginHold(event){
    if(event.button!==undefined&&event.button!==0)return;
    clearTimeout(holdTimer);holdTimer=setTimeout(enableAdmin,5000);
  }
  function stopHold(){clearTimeout(holdTimer)}
  header.style.userSelect='none';header.style.webkitUserSelect='none';
  header.addEventListener('pointerdown',beginHold);
  for(const ev of ['pointerup','pointercancel','pointerleave'])header.addEventListener(ev,stopHold);
  header.addEventListener('contextmenu',e=>e.preventDefault());
  open.addEventListener('click',()=>{renderPicker();navigate('music-center');void loadRoster()});
  back.addEventListener('click',()=>{if(selected)renderCategory();else if(team)renderPicker();else navigate('home')});
  for(const button of root.querySelectorAll('[data-music-team]')){
    button.addEventListener('click',()=>{
      const name=button.dataset.musicTeam;
      if(name==='其他'){
        picker.classList.add('hidden');content.classList.remove('hidden');team='其他';header.textContent='其他';back.textContent='← 返回音樂中心';content.replaceChildren();
        content.append($('p','此分類暫無歌曲。','music-song-note'));return;
      }
      enterTeam(name);void loadRoster();
    });
  }
})();
