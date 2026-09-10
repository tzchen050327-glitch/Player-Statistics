    function annualTextFit(ctx, text, maxWidth, startSize, minSize = 18, weight = 900, family = '"Microsoft JhengHei", Arial, sans-serif') {
      let size = Number(startSize) || 30;
      ctx.font = `${weight} ${size}px ${family}`;
      while (ctx.measureText(String(text)).width > maxWidth && size > minSize) {
        size -= 2;
        ctx.font = `${weight} ${size}px ${family}`;
      }
      return size;
    }

    function annualPanel(ctx, x, y, w, h, { fill='rgba(5,18,29,.94)', border='rgba(55,139,179,.72)', radius=14, lineWidth=2 } = {}) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,radius);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle=border;
      ctx.lineWidth=lineWidth;
      ctx.stroke();
      ctx.restore();
    }

    function annualDrawBackground(ctx) {
      const W=1080,H=1080;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#06121c';
      ctx.fillRect(0,0,W,H);

      const glow=ctx.createRadialGradient(850,220,40,850,220,620);
      glow.addColorStop(0,'rgba(18,87,123,.20)');
      glow.addColorStop(1,'rgba(18,87,123,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(0,0,W,H);

      ctx.save();
      ctx.strokeStyle='rgba(45,112,145,.14)';
      ctx.lineWidth=1;
      for(let x=24;x<W;x+=24){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      }
      for(let y=24;y<H;y+=24){
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle='rgba(65,151,190,.78)';
      ctx.lineWidth=3;
      ctx.strokeRect(18,18,W-36,H-36);
      ctx.strokeStyle='rgba(255,204,77,.80)';
      ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(18,18);ctx.lineTo(330,18);ctx.stroke();
      ctx.restore();
    }

    function annualDrawMetricRow(ctx, metrics) {
      const x=38,y=170,totalW=1004,gap=12;
      const w=(totalW-gap*3)/4;
      metrics.forEach((metric,index)=>{
        const mx=x+index*(w+gap);
        const active=index===1;
        annualPanel(ctx,mx,y,w,118,{
          fill:active?'#f2bc38':'rgba(5,20,32,.94)',
          border:active?'#ffd56a':'rgba(61,140,178,.78)',
          radius:13,lineWidth:2
        });
        ctx.textAlign='center';
        ctx.fillStyle=active?'#102031':'#89b6ca';
        ctx.font='800 22px "Microsoft JhengHei", sans-serif';
        ctx.fillText(metric[0],mx+w/2,y+38);
        ctx.fillStyle=active?'#07131f':'#f5fbff';
        annualTextFit(ctx,metric[1],w-24,46,30,900,'Arial, sans-serif');
        ctx.fillText(metric[1],mx+w/2,y+91);
      });
    }

    function annualDrawStatGrid(ctx, role, stats) {
      const panel={x:38,y:318,w:610,h:644};
      annualPanel(ctx,panel.x,panel.y,panel.w,panel.h,{
        fill:'rgba(4,16,25,.94)',
        border:'rgba(54,139,180,.72)',
        radius:16,lineWidth:2
      });

      ctx.fillStyle='#ffca45';
      ctx.fillRect(panel.x+18,panel.y+18,5,34);
      ctx.textAlign='left';
      ctx.fillStyle='#f5fbff';
      ctx.font='900 29px "Microsoft JhengHei", sans-serif';
      ctx.fillText(role==='pitcher'?'本季成績（投手）':'本季打擊成績',panel.x+34,panel.y+46);
      ctx.textAlign='right';
      ctx.fillStyle='#7fb0c7';
      ctx.font='700 14px Arial, sans-serif';
      ctx.fillText(`${selectedSeason} SEASON TOTALS`,panel.x+panel.w-20,panel.y+42);

      ctx.strokeStyle='rgba(74,142,172,.28)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(panel.x+18,panel.y+66);
      ctx.lineTo(panel.x+panel.w-18,panel.y+66);
      ctx.stroke();

      const s = role==='pitcher' ? mergeStats(stats,pitcherDefaults) : mergeStats(stats,hitterDefaults);
      const hd = role==='hitter' ? hitterDerived(s) : null;
      const items = role==='hitter'
        ? [
            ['打席','PA',s.pa],['打數','AB',s.ab],['安打','H',hd.hits],['得分','R',s.runs],
            ['打點','RBI',s.rbi],['一壘打','1B',s.single],['二壘打','2B',s.double],['三壘打','3B',s.triple],
            ['全壘打','HR',s.hr],['四壞球','BB',s.bb],['故意四壞','IBB',s.ibb],['觸身球','HBP',s.hbp],
            ['三振','SO',s.k],['犧牲短打','SH',s.sacBunt],['犧牲飛球','SF',s.sacFly],['失誤','E',s.errors]
          ]
        : [
            ['勝投','W',s.w],['敗投','L',s.l],['救援成功','SV',s.sv],
            ['中繼成功','HLD',s.hld],['完投','CG',s.cg],['完封','SHO',s.sho],
            ['被安打','H',s.h],['四壞球','BB',s.bb],['死球','HBP',s.hbp],
            ['奪三振','K',s.k],['自責分','ER',s.er]
          ];

      const cols=role==='hitter'?4:3;
      const rows=Math.ceil(items.length/cols);
      const gridX=panel.x+18;
      const gridY=panel.y+84;
      const gridW=panel.w-36;
      const gapX=10,gapY=10;
      const cellW=(gridW-gapX*(cols-1))/cols;
      const usableH=panel.h-106;
      const cellH=(usableH-gapY*(rows-1))/rows;

      items.forEach((item,index)=>{
        const col=index%cols,row=Math.floor(index/cols);
        const x=gridX+col*(cellW+gapX);
        const y=gridY+row*(cellH+gapY);
        annualPanel(ctx,x,y,cellW,cellH,{
          fill:'rgba(6,22,34,.88)',
          border:'rgba(46,111,143,.72)',
          radius:10,lineWidth:1.5
        });
        ctx.textAlign='center';
        ctx.fillStyle='#86bfd9';
        ctx.font=`800 ${role==='hitter'?16:18}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText(item[0],x+cellW/2,y+27);
        ctx.fillStyle='#76aeca';
        ctx.font='700 13px Arial, sans-serif';
        ctx.fillText(item[1],x+cellW/2,y+47);
        ctx.fillStyle='#f7fbff';
        annualTextFit(ctx,String(item[2] ?? 0),cellW-18,34,22,900,'Arial, sans-serif');
        ctx.fillText(String(item[2] ?? 0),x+cellW/2,y+cellH-22);
      });
    }

    async function annualDrawPhotoAndName(ctx, player, role, context) {
      const frame={x:674,y:318,w:368,h:506,r:16};
      annualPanel(ctx,frame.x,frame.y,frame.w,frame.h,{
        fill:'#0a1d2a',border:'rgba(64,149,189,.82)',radius:16,lineWidth:3
      });

      const photo=photos.find(p=>p.id===player.selectedPhotoId && p.playerId===player.id);
      if(photo){
        try{
          const img=await getPhotoImage(photo);
          const scale=Math.max(frame.w/img.width,frame.h/img.height);
          const drawW=img.width*scale,drawH=img.height*scale;
          const drawX=frame.x+(frame.w-drawW)/2;
          const drawY=frame.y+(frame.h-drawH)/2;
          ctx.save();
          ctx.beginPath();ctx.roundRect(frame.x,frame.y,frame.w,frame.h,frame.r);ctx.clip();
          ctx.drawImage(img,drawX,drawY,drawW,drawH);
          const shade=ctx.createLinearGradient(0,frame.y,0,frame.y+frame.h);
          shade.addColorStop(0,'rgba(3,13,21,.02)');
          shade.addColorStop(1,'rgba(3,13,21,.28)');
          ctx.fillStyle=shade;ctx.fillRect(frame.x,frame.y,frame.w,frame.h);
          ctx.restore();
        }catch{}
      }

      const plate={x:674,y:842,w:368,h:120};
      annualPanel(ctx,plate.x,plate.y,plate.w,plate.h,{
        fill:'rgba(4,14,22,.97)',border:'rgba(255,202,69,.80)',radius:12,lineWidth:2
      });
      const title=`#${player.number || ''} ${reportPlayerName(player)}`.trim();
      ctx.textAlign='left';
      ctx.fillStyle='#f7fbff';
      annualTextFit(ctx,title,plate.w-38,40,25,900);
      ctx.fillText(title,plate.x+20,plate.y+48);
      ctx.fillStyle='#ffca45';
      ctx.fillRect(plate.x+20,plate.y+66,plate.w-40,3);
      ctx.fillStyle='#87b7cb';
      ctx.font='800 18px Arial, sans-serif';
      ctx.fillText(role==='pitcher'?'PITCHER':'HITTER',plate.x+20,plate.y+98);

      ctx.textAlign='right';
      ctx.fillStyle='#7eaec4';
      ctx.font='700 13px "Microsoft JhengHei", sans-serif';
      const detail=context.detail && context.detail!==context.team ? context.detail : '';
      if(detail) ctx.fillText(detail,plate.x+plate.w-20,plate.y+98);
    }

    async function renderAnnualSeasonCanvas(role, player=selectedPlayer()) {
      if(!player) throw new Error('請先選擇球員。');
      role=role==='pitcher'?'pitcher':'hitter';

      const stats=seasonStatsForOutputRole(player,role);
      const context=annualSeasonContext(player);
      const ctx=els.canvas.getContext('2d');
      annualDrawBackground(ctx);

      ctx.textAlign='left';
      ctx.fillStyle='#f7fbff';
      ctx.font='900 48px Arial, sans-serif';
      ctx.fillText(String(context.year),48,88);
      ctx.fillStyle='#ffca45';
      ctx.fillText(' SEASON REPORT',ctx.measureText(String(context.year)).width+48,88);

      const subtitle=[context.team,context.league].filter(Boolean).join('｜');
      ctx.fillStyle='#e6f2f8';
      annualTextFit(ctx,subtitle,960,24,16,800);
      ctx.fillText(subtitle,48,126);

      ctx.textAlign='right';
      ctx.fillStyle='#7eafc5';
      ctx.font='700 12px Arial, sans-serif';
      ctx.fillText('PLAYER DATA // SEASON',1036,60);
      ctx.fillStyle='#ffca45';
      ctx.fillRect(970,76,66,3);

      if(role==='hitter'){
        const d=hitterDerived(stats);
        annualDrawMetricRow(ctx,[
          ['打擊率',fmtBatRate(d.avg)],
          ['上壘率',fmtBatRate(d.obp)],
          ['長打率',fmtBatRate(d.slg)],
          ['OPS',fmtBatRate(d.obp+d.slg)]
        ]);
      }else{
        const d=pitcherDerived(stats);
        annualDrawMetricRow(ctx,[
          ['防禦率',fmtTwo(d.era)],
          ['WHIP',fmtTwo(d.whip)],
          ['投球局數',outsToIP(stats.outs)],
          ['奪三振',String(Number(stats.k)||0)]
        ]);
      }

      annualDrawStatGrid(ctx,role,stats);
      await annualDrawPhotoAndName(ctx,player,role,context);

      ctx.fillStyle='rgba(3,13,20,.98)';
      ctx.fillRect(18,982,1044,72);
      ctx.strokeStyle='rgba(54,132,168,.52)';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(18,982);ctx.lineTo(1062,982);ctx.stroke();

      ctx.textAlign='left';
      ctx.fillStyle='#ffca45';
      ctx.font='800 15px Arial, sans-serif';
      ctx.fillText(`PLAYER DATA // ${role==='pitcher'?'PITCHER':'HITTER'}`,44,1025);

      ctx.textAlign='right';
      ctx.fillStyle='#85b5ca';
      ctx.font='700 14px "Microsoft JhengHei", sans-serif';
      annualTextFit(ctx,[context.team,context.league].filter(Boolean).join('｜'),500,14,11,700);
      ctx.fillText([context.team,context.league].filter(Boolean).join('｜'),1034,1025);

      return {role,stats,context};
    }

    function annualSeasonFileName(player,role,context) {
      const team=String(context?.team||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'');
      const league=String(context?.league||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'');
      const internationalTotal = playerScope(player) === 'international';
      const suffix = internationalTotal
        ? (role === 'pitcher' ? '賽事總投球戰績' : '賽事總打擊戰績')
        : (role === 'pitcher' ? '年度投球戰報' : '年度打擊戰報');
      return `${context?.year || selectedSeason}_${reportPlayerName(player)}_${team}${league ? '_'+league : ''}_${suffix}.png`;
    }

    async function captureAnnualSeasonOutput(role) {
      const player=selectedPlayer();
      if(!player) throw new Error('請先選擇球員。');
      const result=await renderAnnualSeasonCanvas(role,player);
      const blob=await new Promise(resolve=>els.canvas.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('年度戰報圖片產生失敗。');
      const fileName=annualSeasonFileName(player,role,result.context);
      return {
        role,
        kind:'season',
        blob,
        fileName,
        file:new File([blob],fileName,{type:'image/png'})
      };
    }

    async function prepareAnnualSeasonReports() {
      const player=selectedPlayer();
      if(!player) throw new Error('請先選擇球員。');

      const roles=annualSeasonRoles(player);
      const outputs=[];
      for(const role of roles){
        outputs.push(await captureAnnualSeasonOutput(role));
      }
      preparedOutputKind = playerScope(player) === 'international' ? 'international-total' : 'season';
      preparedOutputs=outputs;
      preparedOutput=outputs[0]||null;
      updatePreparedOutputDialog();

      if(outputs[0]) await renderAnnualSeasonCanvas(outputs[0].role,player);
      return outputs;
    }

