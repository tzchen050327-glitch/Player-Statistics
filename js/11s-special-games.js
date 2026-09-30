    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v2:';
    const specialReplayMemory = new Map();
    let specialReplayActive = null;

    function ensureSpecialReplayStyles() {
      if (document.getElementById('specialReplayStyles')) return;
      const style = document.createElement('style');
      style.id = 'specialReplayStyles';
      style.textContent = `
        .special-game-card{
          width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer;
          transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease
        }
        .special-game-card:hover{border-color:var(--accent);box-shadow:0 10px 28px rgba(0,0,0,.10)}
        .special-game-card:active{transform:scale(.992)}
        .special-game-card-foot{
          display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding-top:11px;
          border-top:1px solid var(--line);font-size:11px;font-weight:900
        }
        .special-game-card-foot span:first-child{opacity:.58}
        .special-game-card-foot span:last-child{color:var(--accent)}

        .special-replay-overlay{
          position:fixed;inset:0;z-index:2147483000;overflow:hidden;
          background:
            radial-gradient(circle at 50% 10%,rgba(38,111,164,.20),transparent 38%),
            linear-gradient(180deg,#061827 0%,#03111d 100%);
          color:#eef8ff;font-family:inherit;user-select:none
        }
        .special-replay-overlay *{box-sizing:border-box}
        .special-replay-overlay button{font:inherit}
        .special-replay-close{
          position:absolute;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));
          z-index:10;display:grid;place-items:center;width:32px;height:32px;
          border:1px solid rgba(158,211,248,.14);border-radius:999px;
          background:rgba(3,16,27,.72);backdrop-filter:blur(12px);
          color:#e9f7ff;font-size:19px;cursor:pointer
        }
        .special-replay-loading{
          height:100%;display:grid;place-items:center;text-align:center;
          background:radial-gradient(circle at 50% 42%,#123752 0,#061827 58%,#03111d 100%)
        }
        .special-replay-loading strong{display:block;font-size:22px}
        .special-replay-loading span{display:block;margin-top:7px;color:#7ea9c8;font-size:10px;font-weight:800}

        .special-replay-broadcast{
          height:100%;display:grid;grid-template-columns:minmax(155px,19%) minmax(0,62%) minmax(155px,19%);
          padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right))
                  max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));
          gap:8px
        }

        .special-replay-lineup{
          min-width:0;min-height:0;display:grid;grid-template-rows:58px 28px minmax(0,1fr);
          border:1px solid rgba(139,194,234,.10);border-radius:16px;overflow:hidden;
          background:linear-gradient(180deg,rgba(13,43,67,.96),rgba(6,27,44,.96));
          box-shadow:0 16px 40px rgba(0,0,0,.18)
        }
        .special-replay-lineup-head{
          display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;
          padding:0 12px;border-bottom:1px solid rgba(139,194,234,.10)
        }
        .special-replay-lineup-side{
          color:#78b9e8;font-size:8px;font-weight:1000;letter-spacing:.14em
        }
        .special-replay-lineup-team{
          min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          font-size:14px;font-weight:1000
        }
        .special-replay-lineup-title{
          padding:4px 6px;border-radius:999px;background:rgba(112,181,230,.08);
          color:#79b4dd;font-size:7px;font-weight:1000;letter-spacing:.08em
        }
        .special-replay-lineup-cols,.special-replay-lineup-row{
          display:grid;grid-template-columns:18px minmax(0,1fr) 22px 22px 26px 32px;
          align-items:center;gap:2px;padding:0 8px
        }
        .special-replay-lineup-cols{
          color:#628eae;font-size:7px;font-weight:900;letter-spacing:.02em
        }
        .special-replay-lineup-cols span:not(:nth-child(2)){text-align:center}
        .special-replay-lineup-list{
          min-height:0;display:grid;grid-template-rows:repeat(9,minmax(0,1fr));padding:5px
        }
        .special-replay-lineup-row{
          min-height:0;margin:1px 0;border-radius:9px;color:#9eb8cb;font-size:8px;font-weight:850;
          transition:background .14s ease,box-shadow .14s ease
        }
        .special-replay-lineup-row>span:not(.special-replay-lineup-name){text-align:center}
        .special-replay-lineup-name{
          min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#e9f6ff;font-size:10px;font-weight:950
        }
        .special-replay-lineup-pos{
          color:#6fb5e7!important;font-size:7px!important;font-weight:1000!important
        }
        .special-replay-lineup-row.active{
          background:linear-gradient(90deg,rgba(61,153,221,.28),rgba(61,153,221,.10));
          box-shadow:inset 3px 0 0 #69c4ff,0 0 0 1px rgba(111,196,255,.18)
        }
        .special-replay-lineup-row.active .special-replay-lineup-name{color:#fff}

        .special-replay-center{
          min-width:0;min-height:0;display:grid;grid-template-rows:82px 70px minmax(0,1fr) 38px;
          border:1px solid rgba(139,194,234,.08);border-radius:18px;overflow:hidden;
          background:linear-gradient(180deg,rgba(5,25,41,.88),rgba(3,17,29,.96));
          box-shadow:0 18px 50px rgba(0,0,0,.20)
        }

        .special-replay-score{
          position:relative;display:grid;grid-template-columns:minmax(70px,1fr) auto auto auto minmax(70px,1fr);
          align-items:center;gap:8px;padding:8px 34px 5px;
          background:linear-gradient(180deg,rgba(10,42,66,.78),rgba(5,25,41,.20))
        }
        .special-replay-score-team{
          min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#dceefb;font-size:12px;font-weight:950
        }
        .special-replay-score-team.away{text-align:right}
        .special-replay-score-team.home{text-align:left}
        .special-replay-score-num{
          min-width:42px;text-align:center;font-size:40px;font-weight:1000;line-height:1;
          font-variant-numeric:tabular-nums;text-shadow:0 6px 24px rgba(0,0,0,.25)
        }
        .special-replay-status-pill{
          min-width:68px;padding:6px 10px;border:1px solid rgba(126,193,240,.15);
          border-radius:999px;background:rgba(10,42,66,.72);
          color:#94c9ee;text-align:center;font-size:8px;font-weight:1000
        }
        .special-replay-score-sub{
          position:absolute;left:50%;bottom:5px;transform:translateX(-50%);
          max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#5f88a5;font-size:6px;font-weight:800
        }

        .special-replay-linescore{
          min-width:0;overflow:hidden;border-top:1px solid rgba(126,193,240,.06);
          border-bottom:1px solid rgba(126,193,240,.08)
        }
        .special-replay-linescore table{
          width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums
        }
        .special-replay-linescore th,.special-replay-linescore td{
          padding:0 2px;text-align:center;font-size:7px
        }
        .special-replay-linescore thead th{
          height:22px;color:#557f9e;font-size:6px;font-weight:950
        }
        .special-replay-linescore th:first-child,.special-replay-linescore td:first-child{
          width:82px;text-align:left;padding-left:12px;color:#dfeef8;font-weight:950
        }
        .special-replay-linescore tbody tr+tr{border-top:1px solid rgba(126,193,240,.06)}
        .special-replay-linescore th.current,.special-replay-linescore td.current{
          color:#9ad5ff;background:rgba(71,154,214,.08)
        }
        .special-replay-linescore td.total{color:#85c9f8;font-weight:1000}

        .special-replay-arena{
          min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 25%;
          gap:8px;padding:8px
        }
        .special-replay-field,.special-replay-state-card{
          min-height:0;position:relative;border-radius:14px;overflow:hidden
        }

        .special-replay-field{
          border:1px solid rgba(126,193,240,.10);
          background:
            radial-gradient(ellipse at 50% 83%,rgba(29,112,112,.22) 0 26%,transparent 27%),
            radial-gradient(ellipse at 50% 95%,rgba(179,155,92,.12) 0 16%,transparent 17%),
            linear-gradient(180deg,rgba(9,44,66,.72),rgba(4,25,40,.96))
        }
        .special-replay-field:before{
          content:"";position:absolute;left:50%;bottom:3%;width:48%;aspect-ratio:1;
          border:1px solid rgba(203,190,135,.40);
          transform:translateX(-50%) rotate(45deg);border-radius:3px
        }
        .special-replay-field:after{
          content:"";position:absolute;left:50%;bottom:3%;width:2px;height:70%;
          background:linear-gradient(180deg,transparent,rgba(203,190,135,.30));
          transform:translateX(-50%)
        }
        .special-replay-field-label{
          position:absolute;left:12px;top:10px;z-index:4;
          padding:4px 7px;border-radius:999px;background:rgba(3,17,29,.45);
          color:#70a8cf;font-size:7px;font-weight:950
        }
        .special-replay-field-lines{position:absolute;inset:0;opacity:.48}
        .special-replay-field-line{
          position:absolute;left:50%;bottom:3%;width:1px;height:75%;
          background:rgba(203,190,135,.36);transform-origin:bottom
        }
        .special-replay-field-line.left{transform:rotate(-47deg)}
        .special-replay-field-line.right{transform:rotate(47deg)}
        .special-replay-infield-line{display:none}

        .special-replay-defender{
          position:absolute;z-index:3;transform:translate(-50%,-50%);
          max-width:120px;padding:4px 7px;border:1px solid rgba(141,201,243,.10);
          border-radius:999px;background:rgba(3,18,31,.82);backdrop-filter:blur(8px);
          color:#f0f9ff;box-shadow:0 5px 18px rgba(0,0,0,.20);
          font-size:7px;font-weight:950;white-space:nowrap
        }
        .special-replay-defender small{
          margin-left:4px;color:#63a9d9;font-size:5px;font-weight:1000
        }
        .special-replay-defender[data-pos="CF"]{left:50%;top:20%}
        .special-replay-defender[data-pos="LF"]{left:24%;top:35%}
        .special-replay-defender[data-pos="RF"]{left:76%;top:35%}
        .special-replay-defender[data-pos="SS"]{left:39%;top:56%}
        .special-replay-defender[data-pos="2B"]{left:61%;top:56%}
        .special-replay-defender[data-pos="3B"]{left:28%;top:73%}
        .special-replay-defender[data-pos="1B"]{left:72%;top:73%}
        .special-replay-defender[data-pos="P"]{left:50%;top:73%}
        .special-replay-defender[data-pos="C"]{left:50%;top:91%}

        .special-replay-callout{
          position:absolute;left:10px;right:10px;bottom:9px;z-index:5;
          display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;
          padding:7px 10px;border:1px solid rgba(116,189,239,.12);border-radius:12px;
          background:linear-gradient(90deg,rgba(4,22,37,.94),rgba(8,38,59,.91));
          box-shadow:0 10px 24px rgba(0,0,0,.24);backdrop-filter:blur(10px)
        }
        .special-replay-callout-tag{
          padding:4px 7px;border-radius:999px;background:#17527d;color:#a8dcff;
          font-size:6px;font-weight:1000
        }
        .special-replay-callout-copy{min-width:0}
        .special-replay-callout-copy strong,.special-replay-callout-copy span{
          display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
        }
        .special-replay-callout-copy strong{font-size:9px}
        .special-replay-callout-copy span{margin-top:2px;color:#97afc1;font-size:7px;font-weight:800}

        .special-replay-state-card{
          display:grid;grid-template-rows:auto 104px auto minmax(0,1fr);
          padding:10px;border:1px solid rgba(126,193,240,.10);
          background:linear-gradient(180deg,rgba(9,42,64,.76),rgba(4,24,39,.94))
        }
        .special-replay-state-title{
          color:#67a4cf;font-size:7px;font-weight:1000;letter-spacing:.08em
        }
        .special-replay-diamond-wrap{display:grid;place-items:center}
        .special-replay-diamond{
          position:relative;width:64px;aspect-ratio:1;transform:rotate(45deg)
        }
        .special-replay-base{
          position:absolute;width:24%;aspect-ratio:1;border:1px solid #7997ad;background:#0a2238
        }
        .special-replay-base.on{
          border-color:#ffd978;background:#ffd05a;box-shadow:0 0 16px rgba(255,208,90,.30)
        }
        .special-replay-base.b2{left:0;top:0}
        .special-replay-base.b1{right:0;top:0}
        .special-replay-base.b3{left:0;bottom:0}
        .special-replay-homeplate{
          position:absolute;right:0;bottom:0;width:22%;aspect-ratio:1;
          border:1px solid #dbeaf4;background:#eef8ff
        }
        .special-replay-state-inning{
          margin-top:-2px;text-align:center;color:#eef8ff;font-size:10px;font-weight:1000
        }
        .special-replay-state-info{
          align-self:end;display:grid;gap:6px;padding-top:8px;border-top:1px solid rgba(126,193,240,.08)
        }
        .special-replay-state-info-row{
          display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:5px;align-items:center
        }
        .special-replay-state-info-row span:first-child{color:#5d8faf;font-size:6px;font-weight:900}
        .special-replay-state-info-row strong{
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eff8ff;font-size:7px
        }
        .special-replay-outs{display:flex;gap:3px}
        .special-replay-outs i{
          width:6px;height:6px;border-radius:50%;border:1px solid rgba(255,108,108,.85)
        }
        .special-replay-outs i.on{background:#ff6262}
        .special-replay-prev{
          margin-top:2px;padding-top:6px;border-top:1px solid rgba(126,193,240,.06);
          color:#6688a0;font-size:6px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
        }

        .special-replay-footer{
          display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;
          padding:4px 8px 6px
        }
        .special-replay-progress{display:grid;gap:3px}
        .special-replay-progress-top{
          display:flex;justify-content:space-between;color:#5f859f;font-size:6px;font-weight:850
        }
        .special-replay-progress-track{
          height:3px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden
        }
        .special-replay-progress-bar{height:100%;background:linear-gradient(90deg,#3c9ee5,#72c9ff)}
        .special-replay-controls{display:flex;gap:4px}
        .special-replay-control{
          height:25px;min-width:30px;padding:0 7px;border:1px solid rgba(126,193,240,.10);
          border-radius:8px;background:rgba(10,42,64,.72);color:#dff3ff;font-size:7px;font-weight:950;cursor:pointer
        }
        .special-replay-control.primary{
          min-width:48px;border-color:rgba(106,194,255,.16);
          background:linear-gradient(180deg,#1d6da8,#155680)
        }
        .special-replay-rotate-hint{display:none}

        @media (max-width:1100px){
          .special-replay-broadcast{grid-template-columns:minmax(132px,18%) minmax(0,64%) minmax(132px,18%)}
          .special-replay-lineup-cols,.special-replay-lineup-row{
            grid-template-columns:18px minmax(0,1fr) 28px
          }
          .special-replay-lineup-cols span:nth-child(3),
          .special-replay-lineup-cols span:nth-child(4),
          .special-replay-lineup-cols span:nth-child(5),
          .special-replay-lineup-row span:nth-child(3),
          .special-replay-lineup-row span:nth-child(4),
          .special-replay-lineup-row span:nth-child(5){display:none}
        }

        @media (max-height:520px) and (orientation:landscape){
          .special-replay-broadcast{padding:5px;gap:5px}
          .special-replay-lineup{grid-template-rows:40px 22px minmax(0,1fr);border-radius:11px}
          .special-replay-lineup-head{padding:0 7px}
          .special-replay-lineup-team{font-size:10px}
          .special-replay-lineup-side,.special-replay-lineup-title{font-size:6px}
          .special-replay-lineup-cols,.special-replay-lineup-row{
            grid-template-columns:15px minmax(0,1fr) 24px;padding:0 3px;font-size:6px
          }
          .special-replay-lineup-name{font-size:7px}
          .special-replay-center{grid-template-rows:58px 55px minmax(0,1fr) 30px;border-radius:12px}
          .special-replay-score{padding:3px 22px 4px;gap:5px}
          .special-replay-score-num{font-size:28px;min-width:32px}
          .special-replay-score-team{font-size:8px}
          .special-replay-status-pill{min-width:50px;padding:4px 6px;font-size:6px}
          .special-replay-score-sub{bottom:2px;font-size:5px}
          .special-replay-linescore thead th{height:17px}
          .special-replay-linescore th,.special-replay-linescore td{font-size:6px}
          .special-replay-linescore th:first-child,.special-replay-linescore td:first-child{width:58px;padding-left:6px}
          .special-replay-arena{gap:5px;padding:5px}
          .special-replay-state-card{grid-template-rows:auto 70px auto minmax(0,1fr);padding:6px;border-radius:9px}
          .special-replay-diamond{width:44px}
          .special-replay-defender{font-size:5px;padding:2px 4px}
          .special-replay-defender small{font-size:4px}
          .special-replay-callout{left:6px;right:6px;bottom:5px;padding:4px 6px;border-radius:8px}
          .special-replay-callout-tag{padding:3px 5px;font-size:5px}
          .special-replay-callout-copy strong{font-size:6px}
          .special-replay-callout-copy span{font-size:5px}
          .special-replay-state-info{gap:3px;padding-top:4px}
          .special-replay-state-info-row{grid-template-columns:20px minmax(0,1fr) auto}
          .special-replay-state-info-row span:first-child{font-size:5px}
          .special-replay-state-info-row strong{font-size:6px}
          .special-replay-prev{font-size:5px;padding-top:3px}
          .special-replay-footer{padding:2px 5px 3px}
          .special-replay-control{height:20px;font-size:6px}
        }


        .special-replay-event-panel{
          display:grid;gap:5px;padding:9px 10px;margin-bottom:7px;
          border:1px solid rgba(126,193,240,.10);border-radius:10px;
          background:linear-gradient(180deg,rgba(20,72,106,.30),rgba(5,28,44,.22))
        }
        .special-replay-event-kicker{color:#71b7e6;font-size:7px;font-weight:1000;letter-spacing:.10em}
        .special-replay-event-batter{
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#fff;font-size:11px;font-weight:1000
        }
        .special-replay-event-result{color:#b9d9ef;font-size:8px;font-weight:850;line-height:1.35}
        .special-replay-event-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
        .special-replay-event-badge{
          padding:3px 6px;border-radius:999px;background:rgba(108,183,235,.10);
          color:#8cccf7;font-size:6px;font-weight:950
        }

        @media (min-width:1200px) and (min-height:650px){
          .special-replay-broadcast{
            grid-template-columns:minmax(250px,20%) minmax(0,60%) minmax(250px,20%);
            gap:12px;padding:14px
          }
          .special-replay-lineup{grid-template-rows:72px 38px minmax(0,1fr)}
          .special-replay-lineup-head{padding:0 16px}
          .special-replay-lineup-side{font-size:11px}
          .special-replay-lineup-team{font-size:20px}
          .special-replay-lineup-title{font-size:9px;padding:5px 8px}
          .special-replay-lineup-cols,.special-replay-lineup-row{
            grid-template-columns:24px minmax(0,1fr) 30px 30px 38px 48px;
            gap:4px;padding:0 12px
          }
          .special-replay-lineup-cols{font-size:10px}
          .special-replay-lineup-list{padding:8px}
          .special-replay-lineup-row{font-size:11px}
          .special-replay-lineup-name{font-size:15px}
          .special-replay-lineup-pos{font-size:10px!important}

          .special-replay-center{grid-template-rows:110px 96px minmax(0,1fr) 48px}
          .special-replay-score{gap:12px;padding:10px 42px 8px}
          .special-replay-score-team{font-size:18px}
          .special-replay-score-num{font-size:58px;min-width:60px}
          .special-replay-status-pill{min-width:88px;padding:8px 13px;font-size:11px}
          .special-replay-score-sub{bottom:6px;font-size:9px}

          .special-replay-linescore th,.special-replay-linescore td{font-size:11px}
          .special-replay-linescore thead th{height:32px;font-size:10px}
          .special-replay-linescore th:first-child,.special-replay-linescore td:first-child{
            width:112px;padding-left:16px;font-size:12px
          }

          .special-replay-arena{grid-template-columns:minmax(0,1fr) 31%;gap:12px;padding:12px}
          .special-replay-field-label{left:14px;top:12px;font-size:10px;padding:5px 9px}
          .special-replay-defender{font-size:11px;padding:6px 10px}
          .special-replay-defender small{font-size:8px}
          .special-replay-callout{left:14px;right:14px;bottom:12px;padding:10px 13px}
          .special-replay-callout-tag{font-size:9px;padding:5px 8px}
          .special-replay-callout-copy strong{font-size:14px}
          .special-replay-callout-copy span{font-size:11px}

          .special-replay-state-card{
            grid-template-rows:auto auto 132px auto minmax(0,1fr);
            padding:14px
          }
          .special-replay-state-title{font-size:10px}
          .special-replay-event-panel{gap:7px;padding:12px 13px;margin-bottom:8px}
          .special-replay-event-kicker{font-size:9px}
          .special-replay-event-batter{font-size:16px}
          .special-replay-event-result{font-size:13px;line-height:1.45}
          .special-replay-event-badge{font-size:9px;padding:4px 7px}
          .special-replay-diamond{width:86px}
          .special-replay-state-inning{font-size:14px}
          .special-replay-state-info{gap:8px;padding-top:10px}
          .special-replay-state-info-row{grid-template-columns:40px minmax(0,1fr) auto;gap:8px}
          .special-replay-state-info-row span:first-child{font-size:9px}
          .special-replay-state-info-row strong{font-size:12px}
          .special-replay-outs{gap:5px}
          .special-replay-outs i{width:9px;height:9px}
          .special-replay-prev{font-size:9px;padding-top:8px}

          .special-replay-progress-top{font-size:9px}
          .special-replay-control{height:32px;min-width:38px;font-size:10px}
          .special-replay-control.primary{min-width:62px}
        }

        @media (orientation:portrait){
          .special-replay-broadcast{grid-template-columns:1fr;padding:7px}
          .special-replay-lineup{display:none}
          .special-replay-center{grid-template-rows:76px 66px minmax(0,1fr) 38px}
          .special-replay-rotate-hint{
            display:block;position:absolute;left:50%;top:8px;z-index:9;transform:translateX(-50%);
            padding:5px 9px;border:1px solid rgba(126,193,240,.12);border-radius:999px;
            background:rgba(3,18,30,.86);color:#8fc4e7;font-size:7px;font-weight:900
          }
          .special-replay-arena{grid-template-columns:1fr}
          .special-replay-state-card{display:none}
        }
      `;
      document.head.appendChild(style);
    }

    function specialReplayCacheKey(game) {
      return SPECIAL_REPLAY_CACHE_PREFIX + String(game && game.slug || '') + ':' + String(game && game.updated_at || 'latest');
    }

    function readSpecialReplayCache(game) {
      const key = specialReplayCacheKey(game);
      if (specialReplayMemory.has(key)) return specialReplayMemory.get(key);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const detail = JSON.parse(raw);
        specialReplayMemory.set(key, detail);
        return detail;
      } catch { return null; }
    }

    function writeSpecialReplayCache(game, detail) {
      const key = specialReplayCacheKey(game);
      specialReplayMemory.set(key, detail);
      try {
        const prefix = SPECIAL_REPLAY_CACHE_PREFIX + String(game && game.slug || '') + ':';
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const oldKey = localStorage.key(i);
          if (oldKey && oldKey.startsWith(prefix) && oldKey !== key) localStorage.removeItem(oldKey);
        }
        localStorage.setItem(key, JSON.stringify(detail));
      } catch {}
    }

    async function loadSpecialGameDetail(game) {
      const cached = readSpecialReplayCache(game);
      if (cached && cached.payload && Array.isArray(cached.payload.events) && cached.payload.events.length) return cached;
      const slug = String(game && game.slug || '').trim();
      if (!slug) throw new Error('特殊比賽缺少識別碼');
      const response = await fetch(SPECIAL_GAMES_API_URL + '?slug=' + encodeURIComponent(slug), { cache:'default' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const body = await response.json();
      if (!body || !body.game || !body.game.payload || !Array.isArray(body.game.payload.events) || !body.game.payload.events.length) throw new Error('找不到重播時間軸');
      writeSpecialReplayCache(game, body.game);
      return body.game;
    }

    async function loadSpecialGames() {
      if (!els.homeSpecialGamesExplorer) return [];
      try {
        const response = await fetch(SPECIAL_GAMES_API_URL, { cache:'default' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const payload = await response.json();
        homeSpecialGames = (Array.isArray(payload && payload.games) ? payload.games : []).filter(game => !['CPBL','中職','中華職棒'].includes(String(game && game.league || '').trim().toUpperCase()));
      } catch (error) {
        console.warn('特殊比賽讀取失敗', error);
        homeSpecialGames = [];
      }
      return homeSpecialGames;
    }

    function renderSpecialGamesExplorer() {
      if (!els.homeSpecialGamesExplorer || homeRootSection !== 'special') return;
      ensureSpecialReplayStyles();
      if (!Array.isArray(homeSpecialGames) || !homeSpecialGames.length) {
        els.homeSpecialGamesExplorer.innerHTML = '<div class="special-games-empty"><strong>目前沒有特殊比賽</strong><span>你指定要收錄的比賽之後會顯示在這裡。</span></div>';
        void loadSpecialGames().then(() => { if (homeRootSection === 'special' && homeSpecialGames.length) renderSpecialGamesExplorer(); });
        return;
      }
      els.homeSpecialGamesExplorer.innerHTML = homeSpecialGames.map(game => '<button class="special-game-card" type="button" data-special-replay-slug="' + escapeHtml(game.slug || '') + '"><div class="special-game-card-top"><strong>' + escapeHtml(game.title || '特殊比賽') + '</strong><span>' + escapeHtml(game.status || '') + '</span></div><div class="special-game-matchup">' + escapeHtml(game.away_team || '') + '<b>VS</b>' + escapeHtml(game.home_team || '') + '</div><div class="special-game-meta">' + escapeHtml([game.game_date, game.game_time, game.venue].filter(Boolean).join('｜')) + '</div><div class="special-game-card-foot"><span>' + escapeHtml(game.league || 'SPECIAL') + '</span><span>▶ 橫向重播</span></div></button>').join('');
      els.homeSpecialGamesExplorer.querySelectorAll('[data-special-replay-slug]').forEach(button => button.addEventListener('click', () => {
        const game = homeSpecialGames.find(item => String(item && item.slug || '') === String(button.dataset.specialReplaySlug || ''));
        if (game) void openSpecialGameReplay(game);
      }));
    }

    function specialReplayKindLabel(kind) {
      return ({pa:'打席',runner:'跑壘',pitch:'換投',sub:'換人',half:'半局'})[String(kind || '')] || '事件';
    }

    function specialReplayInningLabel(event) {
      return String(Number(event && event.i) || 1) + '局' + (String(event && event.h || 'T') === 'B' ? '下' : '上');
    }

    function specialReplayBaseHtml(mask) {
      const b = Number(mask) || 0;
      return '<div class="special-replay-diamond"><i class="special-replay-base b2 ' + (b & 2 ? 'on' : '') + '"></i><i class="special-replay-base b1 ' + (b & 1 ? 'on' : '') + '"></i><i class="special-replay-base b3 ' + (b & 4 ? 'on' : '') + '"></i><i class="special-replay-homeplate"></i></div>';
    }

    function specialReplayOutsHtml(outs) {
      const value = Math.max(0, Math.min(3, Number(outs) || 0));
      return '<div class="special-replay-outs">' + [1,2,3].map(n => '<i class="' + (value >= n ? 'on' : '') + '"></i>').join('') + '</div>';
    }

    function specialReplayFallbackLineups() {
      return {
        away:[
          {order:1,name:'鄭宗哲',pos:'2B'},{order:2,name:'陳晨威',pos:'CF'},{order:3,name:'費柴德',pos:'RF'},
          {order:4,name:'張育成',pos:'1B'},{order:5,name:'吳念庭',pos:'3B'},{order:6,name:'林安可',pos:'LF'},
          {order:7,name:'吉力吉撈・鞏冠',pos:'DH'},{order:8,name:'林家正',pos:'C'},{order:9,name:'江坤宇',pos:'SS'}
        ],
        home:[
          {order:1,name:'金倒永',pos:'3B'},{order:2,name:'Jahmai Jones',pos:'LF'},{order:3,name:'李政厚',pos:'CF'},
          {order:4,name:'Ahn Hyeon-min',pos:'RF'},{order:5,name:'文保景',pos:'1B'},{order:6,name:'Shay Whitcomb',pos:'DH'},
          {order:7,name:'金周元',pos:'SS'},{order:8,name:'朴東原',pos:'C'},{order:9,name:'金慧成',pos:'2B'}
        ]
      };
    }

    function specialReplayLineupHtml(side, teamName, lineup, event) {
      const isOffense = (String(event.h || 'T') === 'T' && side === 'away') || (String(event.h || 'T') === 'B' && side === 'home');
      const sideLabel = side === 'away' ? 'AWAY' : 'HOME';
      const rows = (Array.isArray(lineup) ? lineup : []).slice(0,9).map((player,index) => {
        const playerName = String(player && player.name || '');
        const active = isOffense && String(event.k || '') === 'pa' && playerName && String(event.n || '') === playerName;
        return '<div class="special-replay-lineup-row ' + (active ? 'active' : '') + '"><span>' + escapeHtml(player.order || index + 1) + '</span><span class="special-replay-lineup-name">' + escapeHtml(playerName) + '</span><span>' + escapeHtml(player.h == null ? '-' : player.h) + '</span><span>' + escapeHtml(player.hr == null ? '-' : player.hr) + '</span><span>' + escapeHtml(player.rbi == null ? '-' : player.rbi) + '</span><span class="special-replay-lineup-pos">' + escapeHtml(player.pos || '') + '</span></div>';
      }).join('');
      return '<aside class="special-replay-lineup ' + (side === 'home' ? 'home' : '') + '"><div class="special-replay-lineup-head"><span class="special-replay-lineup-side">' + sideLabel + '</span><strong class="special-replay-lineup-team">' + escapeHtml(teamName) + '</strong><span class="special-replay-lineup-title">LINEUP</span></div><div class="special-replay-lineup-cols"><span>#</span><span>姓名</span><span>H</span><span>HR</span><span>RBI</span><span>守位</span></div><div class="special-replay-lineup-list">' + rows + '</div></aside>';
    }

    function specialReplayCurrentPitcher(state, event) {
      for (let i = state.index; i >= 0; i -= 1) {
        const item = state.events[i];
        if (item && item.p && item.h === event.h) return item.p;
        if (item && Number(item.i) < Number(event.i) - 1) break;
      }
      const defenseSide = String(event.h || 'T') === 'T' ? 'home' : 'away';
      return state.detail && state.detail.payload && state.detail.payload.defense && state.detail.payload.defense[defenseSide] && state.detail.payload.defense[defenseSide].P || '';
    }

    function specialReplayPreviousPa(state) {
      for (let i = state.index - 1; i >= 0; i -= 1) {
        const item = state.events[i];
        if (item && item.k === 'pa') return item;
      }
      return null;
    }

    function specialReplayDefenseHtml(state, event) {
      const payload = state.detail && state.detail.payload || {};
      const fieldingSide = String(event.h || 'T') === 'T' ? 'home' : 'away';
      const defense = Object.assign({}, payload.defense && payload.defense[fieldingSide] || {});
      const pitcher = specialReplayCurrentPitcher(state,event);
      if (pitcher) defense.P = pitcher;
      return ['LF','CF','RF','3B','SS','2B','1B','P','C'].map(pos => {
        const name = defense[pos] || pos;
        return '<span class="special-replay-defender" data-pos="' + pos + '">' + escapeHtml(name) + '<small>' + pos + '</small></span>';
      }).join('');
    }

    function specialReplayLineScoreHtml(detail,event) {
      const payload = detail.payload || {};
      const lineScore = payload.line_score || {};
      const away = Array.isArray(lineScore.away) ? lineScore.away : [];
      const home = Array.isArray(lineScore.home) ? lineScore.home : [];
      const summary = payload.summary || {};
      const innings = Math.max(9, away.length, home.length, Number(summary.innings) || 9);
      const current = Math.max(1, Number(event.i) || 1);
      let head = '<th></th>';
      for (let i=1;i<=innings;i+=1) head += '<th class="' + (i === current ? 'current' : '') + '">' + i + '</th>';
      head += '<th>R</th><th>H</th><th>E</th>';
      const row = (name,arr,r,h,e) => {
        let cells = '<td>' + escapeHtml(name) + '</td>';
        for (let i=1;i<=innings;i+=1) cells += '<td class="' + (i === current ? 'current' : '') + '">' + escapeHtml(arr[i-1] == null ? '' : arr[i-1]) + '</td>';
        cells += '<td class="total">' + escapeHtml(r) + '</td><td>' + escapeHtml(h == null ? '-' : h) + '</td><td>' + escapeHtml(e == null ? '-' : e) + '</td>';
        return '<tr>' + cells + '</tr>';
      };
      return '<div class="special-replay-linescore"><table><thead><tr>' + head + '</tr></thead><tbody>' + row(detail.away_team || '中華台北',away,summary.away_score,summary.away_hits,summary.away_errors) + row(detail.home_team || '韓國',home,summary.home_score,summary.home_hits,summary.home_errors) + '</tbody></table></div>';
    }

    function specialReplayCenterHtml(state,event) {
      const detail = state.detail;
      const payload = detail.payload || {};
      const scores = Array.isArray(event.s) ? event.s : [0,0];
      const prev = specialReplayPreviousPa(state);
      const pitcher = specialReplayCurrentPitcher(state,event);
      const batter = event.k === 'pa' ? event.n : '';
      const fieldLabel = String(event.h || 'T') === 'T' ? (detail.home_team || '韓國') + ' 守備' : (detail.away_team || '中華台北') + ' 守備';
      const lastEvent = state.index >= state.events.length - 1;
      const statusText = lastEvent ? '比賽結束' : specialReplayInningLabel(event);
      const eventTitle = event.n || specialReplayInningLabel(event);
      const eventCopy = event.r || '';
      const progress = Math.max(0, Math.min(100, ((state.index + 1) / state.events.length) * 100));
      const baseMask = Number(event.b) || 0;
      const baseText = baseMask === 0 ? '壘上無人'
        : [baseMask & 1 ? '一壘' : '', baseMask & 2 ? '二壘' : '', baseMask & 4 ? '三壘' : ''].filter(Boolean).join('、') + '有人';
      const eventBadges = [
        specialReplayInningLabel(event),
        String(Math.max(0,Math.min(3,Number(event.o)||0))) + ' 出局',
        baseText,
        (Number(scores[0]) || 0) + '：' + (Number(scores[1]) || 0)
      ];

      return '<main class="special-replay-center">'
        + '<div class="special-replay-rotate-hint">請將手機橫向觀看</div>'
        + '<div class="special-replay-score">'
        + '<span class="special-replay-score-team away">' + escapeHtml(detail.away_team || '中華台北') + '</span>'
        + '<strong class="special-replay-score-num">' + (Number(scores[0]) || 0) + '</strong>'
        + '<span class="special-replay-status-pill">' + escapeHtml(statusText) + '</span>'
        + '<strong class="special-replay-score-num">' + (Number(scores[1]) || 0) + '</strong>'
        + '<span class="special-replay-score-team home">' + escapeHtml(detail.home_team || '韓國') + '</span>'
        + '<span class="special-replay-score-sub">' + escapeHtml([detail.game_date,detail.venue].filter(Boolean).join('｜')) + '</span>'
        + '</div>'
        + specialReplayLineScoreHtml(detail,event)
        + '<div class="special-replay-arena">'
        + '<section class="special-replay-field">'
        + '<span class="special-replay-field-label">' + escapeHtml(fieldLabel) + '</span>'
        + '<div class="special-replay-field-lines"><i class="special-replay-field-line left"></i><i class="special-replay-field-line right"></i><i class="special-replay-infield-line"></i></div>'
        + specialReplayDefenseHtml(state,event)
        + '<div class="special-replay-callout"><span class="special-replay-callout-tag">' + escapeHtml(specialReplayKindLabel(event.k)) + '</span><div class="special-replay-callout-copy"><strong>' + escapeHtml(eventTitle) + '</strong><span>' + escapeHtml(eventCopy) + '</span></div></div>'
        + '</section>'
        + '<aside class="special-replay-state-card">'
        + '<span class="special-replay-state-title">本打席 / 本事件</span>'
        + '<div class="special-replay-event-panel">'
        + '<span class="special-replay-event-kicker">' + escapeHtml(specialReplayKindLabel(event.k)) + '</span>'
        + '<strong class="special-replay-event-batter">' + escapeHtml(eventTitle) + '</strong>'
        + '<div class="special-replay-event-result">' + escapeHtml(eventCopy || '—') + '</div>'
        + '<div class="special-replay-event-badges">' + eventBadges.map(text => '<span class="special-replay-event-badge">' + escapeHtml(text) + '</span>').join('') + '</div>'
        + '</div>'
        + '<div class="special-replay-diamond-wrap">' + specialReplayBaseHtml(event.b) + '</div>'
        + '<div class="special-replay-state-inning">' + escapeHtml(specialReplayInningLabel(event)) + '</div>'
        + '<div class="special-replay-state-info">'
        + '<div class="special-replay-state-info-row"><span>投手</span><strong>' + escapeHtml(pitcher || '-') + '</strong>' + specialReplayOutsHtml(event.o) + '</div>'
        + '<div class="special-replay-state-info-row"><span>打者</span><strong>' + escapeHtml(batter || event.n || '-') + '</strong><span></span></div>'
        + '<div class="special-replay-prev">上一棒　' + escapeHtml(prev ? prev.n + '｜' + prev.r : '—') + '</div>'
        + '</div>'
        + '</aside>'
        + '</div>'
        + '<div class="special-replay-footer">'
        + '<div class="special-replay-progress"><div class="special-replay-progress-top"><span>' + escapeHtml(specialReplayKindLabel(event.k)) + ' · ' + (Math.max(250,Number(event.d)||1000)/1000).toFixed(1) + ' 秒</span><span>' + (state.index + 1) + ' / ' + state.events.length + '</span></div><div class="special-replay-progress-track"><div class="special-replay-progress-bar" style="width:' + progress.toFixed(2) + '%"></div></div></div>'
        + '<div class="special-replay-controls"><button class="special-replay-control" type="button" data-special-replay-prev>‹</button><button class="special-replay-control primary" type="button" data-special-replay-toggle>' + (state.playing ? '暫停' : (lastEvent ? '重播' : '播放')) + '</button><button class="special-replay-control" type="button" data-special-replay-next>›</button></div>'
        + '</div>'
        + '</main>';
    }

    async function openSpecialGameReplay(game) {
      ensureSpecialReplayStyles();
      closeSpecialGameReplay();
      const overlay = document.createElement('section');
      overlay.className = 'special-replay-overlay';
      overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-loading"><div><strong>準備轉播畫面</strong><span>正在讀取手機快取／比賽時間軸…</span></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      try {
        const full = overlay.requestFullscreen && overlay.requestFullscreen();
        if (full && full.then) full.then(() => {
          try {
            const lock = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape');
            if (lock && lock.catch) lock.catch(() => {});
          } catch {}
        }).catch(() => {});
      } catch {}
      specialReplayActive = { overlay:overlay, game:game, detail:null, events:[], index:0, playing:false, timer:0, remainingMs:0, startedAt:0 };
      try {
        const detail = await loadSpecialGameDetail(game);
        if (!specialReplayActive || specialReplayActive.overlay !== overlay) return;
        specialReplayActive.detail = detail;
        specialReplayActive.events = detail.payload.events;
        specialReplayActive.playing = true;
        specialReplayActive.remainingMs = Math.max(250, Number(detail.payload.events[0] && detail.payload.events[0].d) || 1000);
        renderSpecialReplayFrame();
        scheduleSpecialReplayAdvance();
      } catch (error) {
        console.warn('特殊比賽重播載入失敗', error);
        overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-loading"><div><strong>重播載入失敗</strong><span>' + escapeHtml(error && error.message || '請稍後再試') + '</span></div></div>';
        overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      }
    }

    function renderSpecialReplayFrame() {
      const state = specialReplayActive;
      if (!state || !state.overlay || !state.events.length || !state.detail) return;
      const event = state.events[state.index] || state.events[0];
      const payload = state.detail.payload || {};
      const lineups = payload.lineups || specialReplayFallbackLineups();
      state.overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-broadcast">' + specialReplayLineupHtml('away',state.detail.away_team || '中華台北',lineups.away,event) + specialReplayCenterHtml(state,event) + specialReplayLineupHtml('home',state.detail.home_team || '韓國',lineups.home,event) + '</div>';
      state.overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      state.overlay.querySelector('[data-special-replay-toggle]').addEventListener('click', toggleSpecialReplayPlayback);
      state.overlay.querySelector('[data-special-replay-prev]').addEventListener('click', () => seekSpecialReplay(-1));
      state.overlay.querySelector('[data-special-replay-next]').addEventListener('click', () => seekSpecialReplay(1));
    }

    function scheduleSpecialReplayAdvance() {
      const state = specialReplayActive;
      if (!state || !state.playing || !state.events.length) return;
      clearTimeout(state.timer);
      state.remainingMs = Math.max(100, Number(state.remainingMs) || Number(state.events[state.index] && state.events[state.index].d) || 1000);
      state.startedAt = performance.now();
      state.timer = setTimeout(() => {
        const current = specialReplayActive;
        if (!current || !current.playing) return;
        if (current.index >= current.events.length - 1) {
          current.playing = false;
          renderSpecialReplayFrame();
          return;
        }
        current.index += 1;
        current.remainingMs = Math.max(250, Number(current.events[current.index] && current.events[current.index].d) || 1000);
        renderSpecialReplayFrame();
        scheduleSpecialReplayAdvance();
      }, state.remainingMs);
    }

    function toggleSpecialReplayPlayback() {
      const state = specialReplayActive;
      if (!state || !state.events.length) return;
      if (state.playing) {
        clearTimeout(state.timer);
        state.remainingMs = Math.max(100, state.remainingMs - Math.max(0, performance.now() - state.startedAt));
        state.playing = false;
        renderSpecialReplayFrame();
        return;
      }
      if (state.index >= state.events.length - 1) {
        state.index = 0;
        state.remainingMs = Math.max(250, Number(state.events[0] && state.events[0].d) || 1000);
      }
      state.playing = true;
      renderSpecialReplayFrame();
      scheduleSpecialReplayAdvance();
    }

    function seekSpecialReplay(delta) {
      const state = specialReplayActive;
      if (!state || !state.events.length) return;
      clearTimeout(state.timer);
      state.index = Math.max(0, Math.min(state.events.length - 1, state.index + Number(delta || 0)));
      state.remainingMs = Math.max(250, Number(state.events[state.index] && state.events[state.index].d) || 1000);
      renderSpecialReplayFrame();
      if (state.playing) scheduleSpecialReplayAdvance();
    }

    function closeSpecialGameReplay() {
      const state = specialReplayActive;
      if (!state) return;
      clearTimeout(state.timer);
      const overlay = state.overlay;
      specialReplayActive = null;
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch {}
      try {
        if (document.fullscreenElement === overlay && document.exitFullscreen) {
          const exit = document.exitFullscreen();
          if (exit && exit.catch) exit.catch(() => {});
        }
      } catch {}
      if (overlay && overlay.remove) overlay.remove();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && specialReplayActive && specialReplayActive.playing) toggleSpecialReplayPlayback();
    });
