(() => {
'use strict';
const W=1200,H=1600,P=64;
const ink='#f1f6ff',muted='#9eb2ce',bg='#0c1a2d',card='#182c45',red='#ef8271',green='#5dd2aa';
const text=(v)=>String(v??'').replace(/\s+/g,' ').trim();
const $=(root,sel)=>root?.querySelector(sel);
const $$=(root,sel)=>[...(root?.querySelectorAll(sel)||[])];
const escFile=s=>String(s||'report').replace(/[\\/:*?"<>|]/g,'_').slice(0,65);
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,W,H);return {c,g};}
function rounded(g,x,y,w,h,r=18,col=card){g.fillStyle=col;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();}
function label(g,s,x,y,size=26,color=ink,bold=false,align='left'){g.fillStyle=color;g.font=(bold?'700 ':'400 ')+size+'px system-ui, "Noto Sans TC", sans-serif';g.textAlign=align;g.textBaseline='middle';g.fillText(text(s),x,y);}
function header(g,page,title,pageRange){label(g,'BALLSCOPE  /  UMPIRE REPORT',P,65,24,muted,true);label(g,String(page).padStart(2,'0'),W-P,65,24,muted,true,'right');label(g,title,P,150,46,ink,true);label(g,pageRange,P,207,25,muted);g.fillStyle='#36526e';g.fillRect(P,244,W-P*2,2);label(g,'BALLSCOPE  •  裁判判決報告',P,H-55,20,muted);}
function zone(g,x,y,w,h,point){rounded(g,x,y,w,h,16,'#102038');const zx=x+w*.25,zy=y+h*.12,zw=w*.5,zh=h*.72;g.strokeStyle='#b2cbe4';g.lineWidth=3;g.strokeRect(zx,zy,zw,zh);g.strokeStyle='#52718e';g.lineWidth=1.5;for(let i=1;i<3;i++){g.beginPath();g.moveTo(zx+i*zw/3,zy);g.lineTo(zx+i*zw/3,zy+zh);g.stroke();g.beginPath();g.moveTo(zx,zy+i*zh/3);g.lineTo(zx+zw,zy+i*zh/3);g.stroke();}
const pts=Array.isArray(point)?point:point?[point]:[];for(const p of pts){const px=x+(p.x/320)*w,py=y+(p.y/360)*h;g.beginPath();g.ellipse(px,py,Math.max(8,p.rx/320*w),Math.max(8,p.ry/360*h),0,0,Math.PI*2);g.fillStyle=p.red?red:green;g.fill();g.lineWidth=3;g.strokeStyle='#eff6ff';g.stroke();label(g,p.n,px,py+1,15,'#081728',true,'center');}}
function pointsFromSvg(root){return $$(root,'.umpire-zone-point').map((e,i)=>{const m=(e.getAttribute('transform')||'').match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);return {x:Number(m?.[1]||160),y:Number(m?.[2]||180),rx:Number($ (e,'ellipse')?.getAttribute('rx')||9),ry:Number($(e,'ellipse')?.getAttribute('ry')||9),red:e.classList.contains('is-red'),n:String(i+1)};});}
function metrics(root){return $$(root,'.umpire-metric').map(e=>({name:text($(e,'.umpire-metric-label')?.textContent),value:text($(e,'.umpire-donut-core strong')?.textContent),sub:text($(e,'.umpire-donut-core span')?.textContent)}));}
function drawRing(g,cx,cy,r,value,main,sub,accent='#e7bc58',small=false){
  const pct=Math.max(0,Math.min(100,Number.parseFloat(String(value).replace('%',''))||0));
  g.lineWidth=small?19:23;g.strokeStyle='#373b40';g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();
  g.strokeStyle=accent;g.beginPath();g.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+pct/100*Math.PI*2);g.stroke();
  label(g,main,cx,cy-7,small?35:45,ink,true,'center');
  label(g,sub,cx,cy+38,small?19:23,muted,true,'center');
}
function pageSummary(root,pts){
  const {c,g}=canvas();const teams=$$(root,'.umpire-team-side'),ms=metrics(root);
  const awayName=text($(teams[0],'strong')?.textContent||teams[0]?.textContent);
  const homeName=text($(teams[1],'strong')?.textContent||teams[1]?.textContent);
  const awayScore=text($(teams[0],'b')?.textContent);
  const homeScore=text($(teams[1],'b')?.textContent);
  const official=text($(root,'.umpire-report-official strong')?.textContent);
  label(g,'BALLSCOPE  /  主審判決報告',P,51,22,muted,true);
  label(g,'01',W-P,51,22,muted,true,'right');
  rounded(g,P,88,W-2*P,204,28,'#101a2e');
  g.strokeStyle='#344761';g.lineWidth=2;g.beginPath();g.moveTo(480,114);g.lineTo(480,264);g.moveTo(720,114);g.lineTo(720,264);g.stroke();
  label(g,awayName,260,132,32,ink,true,'center');label(g,awayScore,260,222,77,ink,true,'center');
  label(g,'主審判決報告',600,135,25,muted,true,'center');label(g,official,600,197,38,ink,true,'center');
  label(g,homeName,940,132,32,ink,true,'center');label(g,homeScore,940,222,77,ink,true,'center');
  ms.slice(0,3).forEach((m,i)=>{
    const x=P+i*365;rounded(g,x,330,343,375,28,'#14191f');
    label(g,m.name,x+171,397,28,muted,true,'center');
    drawRing(g,x+171,544,108,m.value,m.value,m.sub);
  });
  rounded(g,P,754,720,712,28,'#14191f');
  label(g,'誤判球點',P+28,816,37,ink,true);
  g.beginPath();g.arc(P+42,870,10,0,Math.PI*2);g.fillStyle='#fa464e';g.fill();
  label(g,'壞球判好球',P+61,872,23,muted,true);
  g.beginPath();g.arc(P+283,870,10,0,Math.PI*2);g.fillStyle='#13c771';g.fill();
  label(g,'好球判壞球',P+302,872,23,muted,true);
  // Chart plot position and marker numbering are read from the live SVG.
  const x0=190,y0=985,zw=385,zh=440;
  g.strokeStyle='#999fa8';g.lineWidth=5;g.strokeRect(x0,y0,zw,zh);
  g.lineWidth=2;for(let k=1;k<3;k++){g.beginPath();g.moveTo(x0+k*zw/3,y0);g.lineTo(x0+k*zw/3,y0+zh);g.moveTo(x0,y0+k*zh/3);g.lineTo(x0+zw,y0+k*zh/3);g.stroke();}
  for(const p of pts){const cx=x0+(p.x-70)/180*zw,cy=y0+(p.y-60)/240*zh;
    const rx=Math.max(9,p.rx/180*zw),ry=Math.max(9,p.ry/240*zh);
    g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);g.fillStyle=p.red?'#f0444a':'#10b45e';g.fill();
    g.strokeStyle='#ffffff';g.lineWidth=3;g.stroke();label(g,p.n,cx,cy,23,'#ffffff',true,'center');
  }
  ms.slice(3,5).forEach((m,i)=>{
    const x=808,y=754+i*365;rounded(g,x,y,328,347,28,'#14191f');
    label(g,m.name,x+164,y+67,25,muted,true,'center');
    if(i===0){
      drawRing(g,x+164,y+210,91,100,m.value,m.sub,'#e6b800',true);
    }else drawRing(g,x+164,y+210,91,m.value,m.value,m.sub,'#e7bc58',true);
  });
  label(g,'BALLSCOPE',W-P,1554,21,muted,true,'right');
  return c;
}
function pagesPitches(root,pts){const cards=$$(root,'.umpire-miss-card');const canvases=[];for(let i=0;i<cards.length;i+=4){const {c,g}=canvas();header(g,canvases.length+2,'逐球判決',(i+1)+'–'+Math.min(i+4,cards.length)+' / '+cards.length);cards.slice(i,i+4).forEach((node,j)=>{const col=j%2,row=Math.floor(j/2),x=P+col*548,y=275+row*605;rounded(g,x,y,526,570);const lines=$$(node,'.umpire-miss-lines > div').map(e=>text(e.textContent));const title=text($(node,'.umpire-miss-head')?.textContent);label(g,title,x+23,y+42,26,ink,true);zone(g,x+105,y+82,315,318,pts[i+j]);lines.slice(0,4).forEach((s,k)=>label(g,s.slice(0,44),x+24,y+427+k*30,20,k===0?muted:ink));if(lines[4])label(g,lines[4].slice(0,42),x+24,y+548,21,green,true);});canvases.push(c);}return canvases;}
async function png(c){return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG 產生失敗')),'image/png'));}
let exporting=false;
const downloadUrls=new Set();
function clearUrls(){for(const url of downloadUrls)URL.revokeObjectURL(url);downloadUrls.clear();}
async function download(btn){
  if(exporting)return;
  const root=btn.closest('.umpire-report-preview');
  if(!root)return;
  exporting=true;btn.disabled=true;btn.textContent='圖片產生中…';
  try{
    const teams=$$(root,'.umpire-team-side');
    const filename=escFile('BallScope_裁判報告_'+text($(teams[0],'strong')?.textContent||'客隊')+'_vs_'+text($(teams[1],'strong')?.textContent||'主隊'));
    const pts=pointsFromSvg(root);
    const cs=[pageSummary(root,pts),...pagesPitches(root,pts)];
    const output=root.querySelector('.umpire-export-images');
    clearUrls();
    if(output)output.replaceChildren();
    for(let i=0;i<cs.length;i++){
      const blob=await png(cs[i]),url=URL.createObjectURL(blob);downloadUrls.add(url);
      const a=document.createElement('a');
      a.href=url;
      a.download=filename+'_'+String(i+1).padStart(2,'0')+(i===0?'_總覽':'_逐球')+'.png';
      a.textContent=i===0?'下載第 1 張｜整場總覽':'下載第 '+(i+1)+' 張｜逐球判決';
      a.style.cssText='display:block;padding:11px 14px;margin:8px 0;border:1px solid #6989ae;border-radius:10px;color:#fff;background:#17385a;text-decoration:none;font-weight:700;text-align:center;';
      output?.appendChild(a);
    }
    btn.textContent='重新產生圖片';
  }catch(e){console.error('[umpire-export]',e);alert('裁判報告圖片產生失敗：'+e.message);btn.textContent='產生下載圖片';}
  finally{exporting=false;btn.disabled=false;}
}
function mount(){
  const root=document.querySelector('.umpire-report-preview');
  if(!root||root.querySelector('.umpire-export-button'))return;
  const wrap=document.createElement('div');wrap.className='umpire-export-controls';
  wrap.style.cssText='margin:22px 0 12px;padding:16px;border-top:1px solid #344761;';
  const b=document.createElement('button');b.className='umpire-export-button';b.type='button';
  b.textContent='產生下載圖片';
  b.style.cssText='display:block;width:100%;padding:12px 18px;border:1px solid #6989ae;border-radius:10px;background:#17385a;color:#fff;font-weight:700;cursor:pointer;';
  const tip=document.createElement('div');tip.textContent='每張 PNG 可個別下載，不使用 ZIP。';tip.style.cssText='color:#9eb2ce;font-size:12px;margin-top:10px;text-align:center;';
  const output=document.createElement('div');output.className='umpire-export-images';
  b.addEventListener('click',()=>download(b));wrap.append(b,tip,output);
  root.appendChild(wrap);
}
let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;mount();});});function start(){mount();observer.observe(document.body,{childList:true,subtree:true});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();