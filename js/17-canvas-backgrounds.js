    function drawOpponentFrame(ctx, frameColor, inset = 10, width = 10) {
      ctx.save();
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = width;
      ctx.strokeRect(inset, inset, 1080 - inset * 2, 1080 - inset * 2);
      ctx.restore();
    }

    function drawStadiumNightBackground(ctx, frameColor = '#d7ad52') {
      const g = ctx.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, '#071523');
      g.addColorStop(.56, '#0e2940');
      g.addColorStop(1, '#07131f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1080);

      // 看台與夜空光暈
      ctx.save();
      for (const [x,y,r] of [[110,120,180],[950,120,180],[535,70,130]]) {
        const glow = ctx.createRadialGradient(x,y,0,x,y,r);
        glow.addColorStop(0,'rgba(255,247,214,.34)');
        glow.addColorStop(.25,'rgba(201,219,231,.13)');
        glow.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 球場燈
      ctx.save();
      for (const baseX of [70, 1010]) {
        ctx.strokeStyle = 'rgba(158,178,194,.46)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(baseX, 285); ctx.lineTo(baseX, 92); ctx.stroke();
        for (let r=0;r<3;r++) for(let col=0;col<4;col++) {
          const x = baseX + (baseX < 500 ? -24 : -45) + col*16;
          const y = 64 + r*16;
          const light = ctx.createRadialGradient(x,y,1,x,y,12);
          light.addColorStop(0,'#fffbe7');
          light.addColorStop(.35,'rgba(255,248,214,.9)');
          light.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle = light;
          ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();

      // 遠端看台
      ctx.fillStyle = '#0a1b2a';
      ctx.beginPath();
      ctx.moveTo(0,710); ctx.quadraticCurveTo(540,570,1080,710);
      ctx.lineTo(1080,830); ctx.lineTo(0,830); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.globalAlpha=.24;
      for(let y=690;y<805;y+=18){
        for(let x=12;x<1070;x+=22){
          ctx.fillStyle=((x+y)/2)%3<1?'#e3c76d':'#91a8ba';
          ctx.fillRect(x,y,3,3);
        }
      }
      ctx.restore();

      // 草地
      const grass=ctx.createLinearGradient(0,760,0,1080);
      grass.addColorStop(0,'#294a35');
      grass.addColorStop(1,'#102d21');
      ctx.fillStyle=grass;ctx.fillRect(0,780,1080,300);
      ctx.save();ctx.globalAlpha=.14;
      for(let x=0;x<1080;x+=72){
        ctx.fillStyle=(x/72)%2?'#9ab077':'#071c16';
        ctx.fillRect(x,780,36,300);
      }
      ctx.restore();

      // 內野線條 / 本壘
      ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(540,1035);ctx.lineTo(292,785);ctx.moveTo(540,1035);ctx.lineTo(788,785);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.52)';
      ctx.beginPath();ctx.moveTo(540,1012);ctx.lineTo(566,1028);ctx.lineTo(556,1058);ctx.lineTo(524,1058);ctx.lineTo(514,1028);ctx.closePath();ctx.fill();

      // 資訊區暗部
      const shade=ctx.createLinearGradient(0,260,590,980);
      shade.addColorStop(0,'rgba(0,0,0,.02)');shade.addColorStop(1,'rgba(0,0,0,.22)');
      ctx.fillStyle=shade;ctx.fillRect(35,275,1010,720);

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=2;ctx.strokeRect(21,21,1038,1038);
    }

    function drawBaseballSeamBackground(ctx, frameColor = '#d7ad52') {
      const paper=ctx.createLinearGradient(0,0,1080,1080);
      paper.addColorStop(0,'#faf7f0');
      paper.addColorStop(1,'#e9e1d4');
      ctx.fillStyle=paper;ctx.fillRect(0,0,1080,1080);

      // 紙張點狀紋理
      ctx.save();ctx.globalAlpha=.08;ctx.fillStyle='#6c6258';
      for(let y=12;y<1080;y+=27) for(let x=14+((y/27)%2)*9;x<1080;x+=33){
        ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();

      // 巨型棒球輪廓與縫線
      ctx.save();
      ctx.globalAlpha=.16;
      ctx.strokeStyle='#b53a35';ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(120,555,395,-1.18,1.20);ctx.stroke();
      ctx.beginPath();ctx.arc(960,555,395,Math.PI-1.20,Math.PI+1.18);ctx.stroke();
      for(let a=-1.08;a<1.10;a+=.12){
        const x=120+Math.cos(a)*395,y=555+Math.sin(a)*395;
        ctx.beginPath();ctx.moveTo(x-10,y-8);ctx.lineTo(x+10,y+8);ctx.stroke();
      }
      for(let a=Math.PI-1.10;a<Math.PI+1.08;a+=.12){
        const x=960+Math.cos(a)*395,y=555+Math.sin(a)*395;
        ctx.beginPath();ctx.moveTo(x-10,y+8);ctx.lineTo(x+10,y-8);ctx.stroke();
      }
      ctx.restore();

      // 頂部記分板帶
      ctx.fillStyle='#173a59';ctx.fillRect(0,0,1080,124);
      ctx.fillStyle='#b83a35';ctx.fillRect(0,118,1080,6);
      ctx.save();ctx.globalAlpha=.12;ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
      for(let x=380;x<1050;x+=58){ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,106);ctx.stroke();}
      ctx.restore();

      // 左下本壘板浮水印
      ctx.save();ctx.globalAlpha=.10;ctx.fillStyle='#173a59';
      ctx.beginPath();ctx.moveTo(110,945);ctx.lineTo(190,945);ctx.lineTo(214,985);ctx.lineTo(150,1040);ctx.lineTo(86,985);ctx.closePath();ctx.fill();
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
    }

    function drawScoreboardTechBackground(ctx, frameColor = '#d7ad52') {
      const W=1080,H=1080;

      // 深色電子記分板底
      const bg=ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#061019');
      bg.addColorStop(.52,'#0a1b27');
      bg.addColorStop(1,'#040b11');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,W,H);

      // LED 點陣
      ctx.save();
      ctx.globalAlpha=.13;
      ctx.fillStyle='#4ea1c5';
      for(let y=26;y<H;y+=20){
        for(let x=28;x<W;x+=20){
          ctx.beginPath();
          ctx.arc(x,y,1.35,0,Math.PI*2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 頂部主記分板框
      ctx.save();
      ctx.fillStyle='rgba(3,10,15,.94)';
      ctx.strokeStyle='#2b6a88';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(34,34,1012,86,12);
      ctx.fill();
      ctx.stroke();

      // 中央 LED 模組：固定放在對手名稱與日期之間，避免和日期重疊。
      const ledBox=(x,label,value,accent='#7ed6f2')=>{
        const boxW=104;
        ctx.fillStyle='rgba(9,29,42,.95)';
        ctx.strokeStyle='rgba(63,132,162,.72)';
        ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(x,46,boxW,60,8);ctx.fill();ctx.stroke();
        ctx.textAlign='center';
        ctx.fillStyle='#7097aa';
        ctx.font='700 11px Arial, sans-serif';
        ctx.fillText(label,x+boxW/2,66);
        ctx.fillStyle=accent;
        ctx.font='900 22px "Courier New", monospace';
        ctx.fillText(value,x+boxW/2,94);
      };
      ledBox(500,'INNING','9');
      ledBox(616,'OUT','2','#ffca45');
      ledBox(732,'COUNT','3-2','#ff7f6b');
      ctx.restore();

      // 中段跑馬燈
      ctx.save();
      ctx.fillStyle='#0d2533';
      ctx.fillRect(0,126,W,6);
      ctx.fillStyle='rgba(13,37,51,.80)';
      ctx.fillRect(0,286,W,10);
      ctx.globalAlpha=.72;
      ctx.fillStyle='#2c718e';
      for(let x=0;x<W;x+=48) ctx.fillRect(x,288,28,6);
      ctx.restore();

      // 右上方球場數據格線
      ctx.save();
      ctx.globalAlpha=.14;
      ctx.strokeStyle='#6db2d0';
      ctx.lineWidth=1;
      for(let x=700;x<1040;x+=42){
        ctx.beginPath();ctx.moveTo(x,138);ctx.lineTo(x,292);ctx.stroke();
      }
      for(let y=138;y<292;y+=31){
        ctx.beginPath();ctx.moveTo(700,y);ctx.lineTo(1040,y);ctx.stroke();
      }
      ctx.restore();

      // 右下電子面板輪廓，照片區後方仍看得到
      ctx.save();
      ctx.strokeStyle='rgba(53,132,166,.28)';
      ctx.lineWidth=2;
      for(const off of [0,12,24]){
        ctx.strokeRect(572+off,304+off,474-off*2,692-off*2);
      }
      ctx.restore();

      // 底部 scoreboard strip
      ctx.save();
      ctx.fillStyle='rgba(2,9,14,.94)';
      ctx.fillRect(0,1000,W,80);
      ctx.strokeStyle='#2c6f8c';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,1000);ctx.lineTo(W,1000);ctx.stroke();

      ctx.fillStyle='#ffca45';
      ctx.font='900 18px "Courier New", monospace';
      ctx.textAlign='left';
      ctx.fillText('PLAYER DATA',46,1048);
      ctx.restore();

      // 科技斜線
      ctx.save();
      ctx.globalAlpha=.22;
      ctx.strokeStyle='#2a7190';
      ctx.lineWidth=2;
      for(let x=-160;x<1080;x+=150){
        ctx.beginPath();
        ctx.moveTo(x,1080);
        ctx.lineTo(x+310,770);
        ctx.stroke();
      }
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(96,175,205,.24)';
      ctx.lineWidth=2;
      ctx.strokeRect(22,22,1036,1036);
    }

    function drawScoreboardPlayerFooter(ctx, player, record) {
      if (!player || !record) return;

      let items;
      let descriptor;
      if (player.type === 'pitcher') {
        const g = record.pitcherGame || {};
        items = [
          ['IP', String(g.innings || '0.0')],
          ['SO', String(Math.max(0, Number(g.k) || 0))],
          ['ER', String(Math.max(0, Number(g.er) || 0))]
        ];
        descriptor = 'PITCHER';
      } else {
        const derived = deriveHitterGame(record.hitterPAs || []);
        const summary = record.cpblGameSummary || {};
        const official = Boolean(summary.official);
        items = [
          ['R', String(official ? Math.max(0, Number(summary.runs) || 0) : 0)],
          ['H', String(official ? Math.max(0, Number(summary.hits) || 0) : Math.max(0, Number(derived.single || 0) + Number(derived.double || 0) + Number(derived.triple || 0) + Number(derived.hr || 0)))],
          ['E', String(official ? Math.max(0, Number(summary.errors) || 0) : 0)]
        ];
        descriptor = 'HITTER';
      }

      ctx.save();
      ctx.fillStyle='rgba(2,9,14,.98)';
      ctx.fillRect(0,1000,1080,80);
      ctx.strokeStyle='#2c6f8c';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,1000);ctx.lineTo(1080,1000);ctx.stroke();

      items.forEach((item,i)=>{
        const x=740+i*92;
        ctx.textAlign='center';
        ctx.fillStyle='#6f95a8';
        ctx.font='700 15px Arial, sans-serif';
        ctx.fillText(item[0],x,1027);
        ctx.fillStyle='#dff6ff';
        ctx.font='900 28px "Courier New", monospace';
        ctx.fillText(item[1],x,1060);
      });

      ctx.fillStyle='#ffca45';
      ctx.font='900 18px "Courier New", monospace';
      ctx.textAlign='left';
      ctx.fillText(`PLAYER DATA // ${descriptor}`,46,1048);
      ctx.restore();
    }

    function drawBullpenBackground(ctx, frameColor = '#d7ad52') {
      const wall=ctx.createLinearGradient(0,0,1080,1080);
      wall.addColorStop(0,'#14231d');
      wall.addColorStop(.56,'#2a4036');
      wall.addColorStop(1,'#101a16');
      ctx.fillStyle=wall;
      ctx.fillRect(0,0,1080,1080);

      // 明顯牛棚鐵網
      ctx.save();
      ctx.globalAlpha=.23;
      ctx.strokeStyle='#d2ddd5';
      ctx.lineWidth=1.7;
      const step=36;
      for(let x=-1080;x<1080;x+=step){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+1080,1080);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,1080);ctx.lineTo(x+1080,0);ctx.stroke();
      }
      ctx.restore();

      // 上方鋼樑與遮棚
      ctx.fillStyle='rgba(5,13,10,.78)';
      ctx.fillRect(0,0,1080,130);
      ctx.strokeStyle='rgba(205,190,150,.42)';
      ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(0,130);ctx.lineTo(1080,130);ctx.stroke();
      for(let x=70;x<1080;x+=175){
        ctx.strokeStyle='rgba(178,190,181,.24)';
        ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+58,130);ctx.stroke();
      }

      // 右上 BULLPEN 標牌，避開 VS / 三圍
      ctx.save();
      ctx.fillStyle='rgba(7,18,14,.90)';
      ctx.strokeStyle='#c6ad70';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(650,146,330,58,10);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign='center';
      ctx.fillStyle='#ead8a5';
      ctx.font='900 37px Arial, sans-serif';
      ctx.fillText('BULLPEN',815,187);
      ctx.restore();

      // 暖色牛棚頂燈
      const light=ctx.createRadialGradient(836,88,8,836,88,250);
      light.addColorStop(0,'rgba(255,231,174,.34)');
      light.addColorStop(.34,'rgba(222,198,143,.11)');
      light.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=light;
      ctx.fillRect(570,0,510,360);

      // 後方長椅
      ctx.fillStyle='rgba(103,70,39,.90)';
      ctx.fillRect(16,758,560,28);
      ctx.fillStyle='rgba(61,40,24,.92)';
      ctx.fillRect(48,786,20,84);
      ctx.fillRect(520,786,20,84);
      ctx.strokeStyle='rgba(222,184,124,.30)';
      ctx.lineWidth=2;
      for(let x=32;x<560;x+=70){
        ctx.beginPath();ctx.moveTo(x,762);ctx.lineTo(x+56,762);ctx.stroke();
      }

      // 草皮與投手練投區
      const grass=ctx.createLinearGradient(0,775,0,1080);
      grass.addColorStop(0,'#4d684e');
      grass.addColorStop(1,'#203a2b');
      ctx.fillStyle=grass;
      ctx.fillRect(0,780,1080,300);
      ctx.save();
      ctx.globalAlpha=.18;
      for(let x=0;x<1080;x+=58){
        ctx.fillStyle=(x/58)%2?'#809774':'#284432';
        ctx.fillRect(x,780,29,300);
      }
      ctx.restore();

      // 牛棚土丘
      const dirt=ctx.createRadialGradient(790,940,45,790,940,310);
      dirt.addColorStop(0,'#b0875e');
      dirt.addColorStop(.58,'rgba(144,101,65,.92)');
      dirt.addColorStop(1,'rgba(108,76,49,0)');
      ctx.fillStyle=dirt;
      ctx.beginPath();
      ctx.ellipse(790,940,330,125,0,0,Math.PI*2);
      ctx.fill();

      // 投手板
      ctx.fillStyle='#f1ead8';
      ctx.strokeStyle='rgba(80,67,48,.35)';
      ctx.lineWidth=2;
      ctx.fillRect(742,900,100,17);
      ctx.strokeRect(742,900,100,17);

      // 左下球桶，刻意放在數據框下方可視區
      ctx.save();
      const bucketGrad=ctx.createLinearGradient(74,975,168,1060);
      bucketGrad.addColorStop(0,'#263e5a');
      bucketGrad.addColorStop(1,'#14283c');
      ctx.fillStyle=bucketGrad;
      ctx.strokeStyle='#9fb0be';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(72,986,114,78,12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle='#dbe4e8';
      ctx.font='900 17px Arial, sans-serif';
      ctx.textAlign='center';
      ctx.fillText('BASEBALL',129,1043);

      // 桶裡棒球
      for(const [x,y] of [[91,980],[117,974],[144,979],[166,986]]){
        ctx.fillStyle='#f6f1e5';
        ctx.strokeStyle='#b9b4aa';
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#c64843';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(x-7,y,13,-1.1,1.1);ctx.stroke();
        ctx.beginPath();ctx.arc(x+7,y,13,Math.PI-1.1,Math.PI+1.1);ctx.stroke();
      }
      ctx.restore();

      // 底部球棒架
      ctx.save();
      ctx.strokeStyle='#5c3d24';
      ctx.lineWidth=7;
      ctx.beginPath();
      ctx.moveTo(220,1062);ctx.lineTo(220,985);
      ctx.moveTo(338,1062);ctx.lineTo(338,985);
      ctx.moveTo(210,1025);ctx.lineTo(348,1025);
      ctx.stroke();

      const bats=[
        {x:242,rot:-.09,c:'#d7a55f'},
        {x:274,rot:.05,c:'#c9904b'},
        {x:307,rot:-.04,c:'#e1b775'}
      ];
      for(const bat of bats){
        ctx.save();
        ctx.translate(bat.x,1021);
        ctx.rotate(bat.rot);
        ctx.fillStyle=bat.c;
        ctx.strokeStyle='#604426';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.roundRect(-7,-78,14,91,7);
        ctx.fill();ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // 右側窄邊直式牛棚字樣，照片旁仍看得到
      ctx.save();
      ctx.translate(1052,630);
      ctx.rotate(-Math.PI/2);
      ctx.textAlign='center';
      ctx.fillStyle='rgba(234,216,165,.52)';
      ctx.font='900 24px Arial, sans-serif';
      ctx.fillText('PITCHING AREA • BULLPEN',0,0);
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(226,211,172,.28)';
      ctx.lineWidth=2;
      ctx.strokeRect(22,22,1036,1036);
    }
    function drawBg2Background(ctx, frameColor = '#d7ad52') {
      const W = 1080;
      const H = 1080;

      // 暖白底
      const paper = ctx.createLinearGradient(0, 0, W, H);
      paper.addColorStop(0, '#f8f5f0');
      paper.addColorStop(1, '#e9e5df');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);

      // 淡淡紙張顆粒（固定位置，不會閃）
      ctx.save();
      ctx.globalAlpha = .10;
      ctx.fillStyle = '#64748b';
      for (let y = 18; y < 1060; y += 34) {
        for (let x = 16 + ((y / 34) % 2) * 11; x < 1060; x += 43) {
          const r = 1 + ((x + y) % 3) * .35;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 左上深藍三角區
      ctx.fillStyle = '#061a2d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(370, 0);
      ctx.lineTo(0, 545);
      ctx.closePath();
      ctx.fill();

      // 三角區內深淺層次
      ctx.fillStyle = 'rgba(15,52,84,.65)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(315, 0);
      ctx.lineTo(0, 455);
      ctx.closePath();
      ctx.fill();

      // 紅色動感斜線
      ctx.strokeStyle = '#e1282d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(330, 0);
      ctx.lineTo(22, 478);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(300, 0);
      ctx.lineTo(5, 435);
      ctx.stroke();

      ctx.fillStyle = '#e1282d';
      ctx.beginPath();
      ctx.moveTo(78, 318);
      ctx.lineTo(156, 282);
      ctx.lineTo(118, 346);
      ctx.lineTo(48, 375);
      ctx.closePath();
      ctx.fill();

      // 左側球場燈
      ctx.save();
      ctx.globalAlpha = .85;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const x = 18 + col * 23;
          const y = 170 + row * 22;
          const g = ctx.createRadialGradient(x, y, 1, x, y, 15);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(.25, '#f8fbff');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 左下球場看台（淡化）
      ctx.save();
      ctx.globalAlpha = .28;
      ctx.strokeStyle = '#52657d';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 660 + i * 22);
        ctx.quadraticCurveTo(280, 620 + i * 18, 610, 675 + i * 18);
        ctx.stroke();
      }
      ctx.globalAlpha = .14;
      ctx.fillStyle = '#263b52';
      for (let y = 680; y < 820; y += 18) {
        for (let x = 10; x < 575; x += 21) {
          ctx.beginPath();
          ctx.arc(x + ((y / 18) % 2) * 7, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 草地
      const grass = ctx.createLinearGradient(0, 790, 0, 900);
      grass.addColorStop(0, 'rgba(81,112,50,.20)');
      grass.addColorStop(1, 'rgba(54,83,35,.65)');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 800, 615, 105);
      ctx.save();
      ctx.globalAlpha = .16;
      for (let x = 0; x < 615; x += 34) {
        ctx.fillStyle = (x / 34) % 2 ? '#90a85f' : '#49662f';
        ctx.fillRect(x, 800, 17, 105);
      }
      ctx.restore();

      // 內野泥土
      const dirt = ctx.createLinearGradient(0, 900, 0, 1080);
      dirt.addColorStop(0, '#a95e2d');
      dirt.addColorStop(1, '#653416');
      ctx.fillStyle = dirt;
      ctx.fillRect(0, 900, 650, 180);
      ctx.save();
      ctx.globalAlpha = .22;
      ctx.fillStyle = '#2d160b';
      for (let y = 910; y < 1080; y += 13) {
        for (let x = 4; x < 650; x += 17) {
          ctx.fillRect(x + ((x + y) % 7), y, 2, 2);
        }
      }
      ctx.restore();

      // 白色界外線
      ctx.strokeStyle = 'rgba(255,255,255,.88)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 958);
      ctx.lineTo(585, 1080);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 915);
      ctx.lineTo(560, 1000);
      ctx.stroke();

      // 淡棒球縫線浮水印
      ctx.save();
      ctx.globalAlpha = .065;
      ctx.strokeStyle = '#9a765e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(735, 600, 245, -1.1, 1.35);
      ctx.stroke();
      for (let a = -1.0; a < 1.25; a += .18) {
        const x = 735 + Math.cos(a) * 245;
        const y = 600 + Math.sin(a) * 245;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 7);
        ctx.lineTo(x + 8, y + 7);
        ctx.stroke();
      }
      ctx.restore();

      // 右下姓名斜角帶
      ctx.fillStyle = '#f6f4f1';
      ctx.beginPath();
      ctx.moveTo(575, 1080);
      ctx.lineTo(1080, 805);
      ctx.lineTo(1080, 1080);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#10284a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(605, 1078);
      ctx.lineTo(1080, 820);
      ctx.stroke();
      ctx.strokeStyle = '#e1282d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(635, 1080);
      ctx.lineTo(1080, 842);
      ctx.stroke();

      // 最底部深藍帶
      ctx.fillStyle = '#071d32';
      ctx.beginPath();
      ctx.moveTo(705, 1080);
      ctx.lineTo(1080, 880);
      ctx.lineTo(1080, 1080);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e1282d';
      ctx.beginPath();
      ctx.moveTo(930, 1080);
      ctx.lineTo(1080, 975);
      ctx.lineTo(1080, 1010);
      ctx.lineTo(988, 1080);
      ctx.closePath();
      ctx.fill();

      // 再蓋一層淺色姓名帶，讓文字清楚
      ctx.fillStyle = 'rgba(248,246,243,.94)';
      ctx.beginPath();
      ctx.moveTo(620, 1080);
      ctx.lineTo(1080, 835);
      ctx.lineTo(1080, 1050);
      ctx.lineTo(1025, 1080);
      ctx.closePath();
      ctx.fill();

      // 小隊色裝飾線
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(635, 1065);
      ctx.lineTo(1035, 1065);
      ctx.stroke();

      drawBg2QEquipment(ctx);

      // 外圍對手色框線
      ctx.save();
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = 18;
      ctx.lineJoin = 'round';
      ctx.strokeRect(9, 9, W - 18, H - 18);
      ctx.strokeStyle = 'rgba(255,255,255,.72)';
      ctx.lineWidth = 2;
      ctx.strokeRect(21, 21, W - 42, H - 42);
      ctx.restore();
    }

    function drawBg2QEquipment(ctx) {
      // 陰影
      ctx.save();
      ctx.globalAlpha = .14;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(740, 238, 285, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Q版球棒
      ctx.save();
      ctx.translate(465, 152);
      ctx.rotate(-0.18);
      const batGrad = ctx.createLinearGradient(0, 0, 280, 0);
      batGrad.addColorStop(0, '#d99a4b');
      batGrad.addColorStop(.55, '#f0c477');
      batGrad.addColorStop(1, '#c27b32');
      ctx.fillStyle = batGrad;
      ctx.strokeStyle = '#5c371c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(22, -14);
      ctx.quadraticCurveTo(80, -24, 245, -22);
      ctx.quadraticCurveTo(282, -20, 286, 0);
      ctx.quadraticCurveTo(282, 20, 245, 22);
      ctx.quadraticCurveTo(80, 24, 22, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#172033';
      ctx.beginPath();
      ctx.roundRect(-18, -14, 52, 28, 10);
      ctx.fill();
      ctx.strokeStyle = '#667085';
      ctx.lineWidth = 2;
      for (let x = -10; x < 27; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -13);
        ctx.lineTo(x, 13);
        ctx.stroke();
      }
      ctx.fillStyle = '#d99a4b';
      ctx.strokeStyle = '#5c371c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-20, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Q版手套
      ctx.save();
      ctx.translate(690, 170);
      ctx.fillStyle = '#bd7432';
      ctx.strokeStyle = '#603416';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, 48);
      ctx.quadraticCurveTo(-68, 5, -38, -18);
      ctx.quadraticCurveTo(-22, -32, -8, -18);
      ctx.quadraticCurveTo(5, -42, 22, -25);
      ctx.quadraticCurveTo(34, -42, 48, -20);
      ctx.quadraticCurveTo(68, -25, 73, 0);
      ctx.quadraticCurveTo(87, 18, 71, 50);
      ctx.quadraticCurveTo(44, 79, 3, 76);
      ctx.quadraticCurveTo(-39, 77, -58, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#f2c184';
      ctx.lineWidth = 3;
      for (const x of [-30, -8, 15, 38]) {
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.quadraticCurveTo(x - 3, 22, x + 2, 48);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6b3b1c';
      ctx.beginPath();
      ctx.arc(8, 43, 30, .2, Math.PI - .15);
      ctx.stroke();
      ctx.restore();

      // Q版棒球（有表情）
      ctx.save();
      ctx.translate(832, 178);
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 43, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d52b31';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-24, 0, 33, -1.15, 1.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(24, 0, 33, Math.PI - 1.15, Math.PI + 1.15);
      ctx.stroke();
      for (let t = -20; t <= 20; t += 10) {
        ctx.beginPath();
        ctx.moveTo(-31, t - 4);
        ctx.lineTo(-22, t + 2);
        ctx.moveTo(31, t - 4);
        ctx.lineTo(22, t + 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#172033';
      ctx.beginPath(); ctx.arc(-11, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#172033';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 5, 10, .2, Math.PI - .2); ctx.stroke();
      ctx.fillStyle = '#f19aa0';
      ctx.beginPath(); ctx.arc(-21, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(21, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Q版打擊頭盔
      ctx.save();
      ctx.translate(955, 160);
      const helmetGrad = ctx.createLinearGradient(-55, -55, 60, 60);
      helmetGrad.addColorStop(0, '#263f63');
      helmetGrad.addColorStop(1, '#07192f');
      ctx.fillStyle = helmetGrad;
      ctx.strokeStyle = '#020b15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, 20);
      ctx.quadraticCurveTo(-58, -52, 5, -62);
      ctx.quadraticCurveTo(65, -57, 68, 8);
      ctx.lineTo(55, 42);
      ctx.quadraticCurveTo(20, 60, -28, 45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(40, 10);
      ctx.quadraticCurveTo(88, 12, 105, 34);
      ctx.quadraticCurveTo(76, 48, 34, 40);
      ctx.closePath();
      ctx.fillStyle = '#10284a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.beginPath();
      ctx.ellipse(-8, -33, 22, 8, -.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 小星星
      const stars = [[546,108,'#e1282d'], [613,133,'#10284a'], [787,94,'#e1282d'], [1010,92,'#d7ad52']];
      for (const [x,y,c] of stars) {
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0,-9); ctx.lineTo(3,-3); ctx.lineTo(9,0); ctx.lineTo(3,3); ctx.lineTo(0,9); ctx.lineTo(-3,3); ctx.lineTo(-9,0); ctx.lineTo(-3,-3); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function drawBg2Header(ctx, layout, opponent, dateText, frameColor) {
      const h = layout.header;
      ctx.textAlign = 'left';
      ctx.font = `900 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
      ctx.fillStyle = h.textColor || '#ffffff';
      ctx.fillText('VS ', h.vsX, h.vsY);
      const vsW = ctx.measureText('VS ').width;
      ctx.fillStyle = frameColor || '#ffffff';
      ctx.fillText(opponent, h.vsX + vsW, h.vsY);

      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.dateX, h.dateY - 24);
      ctx.lineTo(205, h.dateY - 24);
      ctx.stroke();

      ctx.fillStyle = h.dateColor || '#ffffff';
      ctx.font = `800 ${layout.fonts.headerDate}px Arial, "Microsoft JhengHei", sans-serif`;
      ctx.fillText(dateText, h.dateX, h.dateY);
      ctx.fillStyle = '#e1282d';
      ctx.fillRect(215, h.dateY - 22, 4, 25);
    }

    function drawBg2MetricFrame(ctx, card) {
      ctx.save();
      ctx.fillStyle = card.bg || 'rgba(255,255,255,.82)';
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = '#ef4f43';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = 'rgba(239,79,67,.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(card.x + 7, card.y + 7, card.w - 14, card.h - 14);
      ctx.restore();
    }

    function drawBg2DetailHeading(ctx, text, detail) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e1282d';
      ctx.fillRect(detail.headingX - 15, detail.headingY - 26, 5, 29);
      ctx.fillStyle = '#10284a';
      ctx.font = '900 31px "Microsoft JhengHei", sans-serif';
      ctx.fillText(text, detail.headingX, detail.headingY);
      ctx.strokeStyle = 'rgba(16,40,74,.42)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(detail.underlineX, detail.underlineY);
      ctx.lineTo(detail.underlineX + detail.underlineW, detail.underlineY);
      ctx.stroke();
      ctx.restore();
    }

