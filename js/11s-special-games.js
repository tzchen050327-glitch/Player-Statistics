    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v2:';
    const specialReplayMemory = new Map();
    let specialReplayActive = null;

    function ensureSpecialReplayStyles() {
      if (document.getElementById('specialReplayStyles')) return;
      const style = document.createElement('style');
      style.id = 'specialReplayStyles';
      style.textContent = `
        .special-game-card{width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer;transition:.15s transform,.15s border-color,.15s box-shadow}
        .special-game-card:hover{border-color:var(--accent);box-shadow:0 10px 28px rgba(0,0,0,.10)}
        .special-game-card:active{transform:scale(.992)}
        .special-game-card-foot{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding-top:11px;border-top:1px solid var(--line);font-size:11px;font-weight:900}
        .special-game-card-foot span:first-child{opacity:.58}.special-game-card-foot span:last-child{color:var(--accent)}

        .special-replay-overlay{
          --sr-accent:#56b8f2;position:fixed;inset:0;z-index:2147483000;overflow:hidden;
          background:
            radial-gradient(circle at 50% -12%,rgba(62,148,207,.22),transparent 36%),
            linear-gradient(180deg,#06121d 0%,#030a11 100%);
          color:#edf7fd;font-family:inherit;user-select:none
        }
        .special-replay-overlay *{box-sizing:border-box}
        .special-replay-overlay button{font:inherit}
        .special-replay-close{
          position:absolute;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));
          z-index:20;display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(150,208,247,.16);
          border-radius:50%;background:rgba(4,16,26,.72);backdrop-filter:blur(12px);color:#eaf7ff;font-size:20px;cursor:pointer
        }
        .special-replay-loading{height:100%;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 50% 42%,#15354c 0,#06121d 60%,#030a11 100%)}
        .special-replay-loading strong{display:block;font-size:24px}.special-replay-loading span{display:block;margin-top:8px;color:#7aa5c2;font-size:11px;font-weight:800}

        .special-replay-shell{
          height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;
          gap:10px;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))
              max(8px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))
        }

        .special-replay-scoreboard{
          min-height:92px;display:grid;grid-template-columns:minmax(150px,.75fr) minmax(0,2fr) minmax(150px,.75fr);
          align-items:center;gap:18px;padding:12px 56px 12px 18px;border:1px solid rgba(140,198,237,.10);
          border-radius:18px;background:linear-gradient(180deg,rgba(12,35,52,.86),rgba(7,24,38,.74));
          box-shadow:0 14px 36px rgba(0,0,0,.18)
        }
        .special-replay-brand{min-width:0}.special-replay-brand-kicker{display:block;color:#6ea9d1;font-size:9px;font-weight:1000;letter-spacing:.14em}
        .special-replay-brand-title{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dceefa;font-size:12px;font-weight:900}
        .special-replay-score-main{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto minmax(0,1fr);align-items:center;gap:12px}
        .special-replay-score-team{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f4fbff;font-size:17px;font-weight:1000}
        .special-replay-score-team.away{text-align:right}.special-replay-score-team.home{text-align:left}
        .special-replay-score-number{min-width:58px;text-align:center;color:#fff;font-size:54px;font-weight:1000;line-height:.9;font-variant-numeric:tabular-nums}
        .special-replay-inning-pill{min-width:86px;padding:8px 12px;border:1px solid rgba(117,184,229,.16);border-radius:999px;background:#0a2639;color:#9ed0f2;text-align:center;font-size:10px;font-weight:1000}
        .special-replay-score-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .special-replay-score-meta-item{padding:7px 6px;border-radius:9px;background:rgba(4,18,29,.50);text-align:center}
        .special-replay-score-meta-item span{display:block;color:#567c97;font-size:7px;font-weight:1000}
        .special-replay-score-meta-item strong{display:block;margin-top:3px;color:#dff3ff;font-size:12px;font-weight:1000}

        .special-replay-main{
          min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,34%);gap:10px
        }
        .special-replay-focus{
          --event-accent:#58baf1;position:relative;min-width:0;min-height:0;display:grid;
          grid-template-rows:auto auto minmax(0,1fr) auto;gap:16px;padding:22px 24px;border:1px solid rgba(140,198,237,.10);
          border-radius:18px;overflow:hidden;background:
            radial-gradient(circle at 84% 14%,color-mix(in srgb,var(--event-accent) 15%,transparent),transparent 34%),
            linear-gradient(145deg,rgba(12,40,58,.90),rgba(4,17,28,.97));
          box-shadow:0 18px 46px rgba(0,0,0,.19)
        }
        .special-replay-focus:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,transparent,var(--event-accent),transparent);opacity:.8}
        .special-replay-focus.tone-hr{--event-accent:#f5b94e}.special-replay-focus.tone-score{--event-accent:#57d7a4}
        .special-replay-focus.tone-k{--event-accent:#61aef1}.special-replay-focus.tone-walk{--event-accent:#b98aef}
        .special-replay-focus.tone-change{--event-accent:#68cbd3}.special-replay-focus.tone-half{--event-accent:#869cab}
        .special-replay-focus-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .special-replay-focus-label{display:inline-flex;align-items:center;gap:7px;color:#86bde1;font-size:9px;font-weight:1000;letter-spacing:.12em}
        .special-replay-focus-label i{width:8px;height:8px;border-radius:50%;background:var(--event-accent);box-shadow:0 0 14px color-mix(in srgb,var(--event-accent) 70%,transparent)}
        .special-replay-focus-event{color:#5e849d;font-size:8px;font-weight:900}
        .special-replay-matchup{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:18px;align-items:center;padding:9px 0 16px;border-bottom:1px solid rgba(132,194,235,.08)}
        .special-replay-person{min-width:0}.special-replay-person.right{text-align:right}
        .special-replay-person span{display:block;margin-bottom:5px;color:#5e8cac;font-size:8px;font-weight:1000;letter-spacing:.10em}
        .special-replay-person strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef9ff;font-size:20px;font-weight:1000}
        .special-replay-vs{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid rgba(133,200,242,.13);background:rgba(6,28,44,.70);color:#6f9fbe;font-size:9px;font-weight:1000}
        .special-replay-result{align-self:center;min-width:0}
        .special-replay-result-kicker{display:block;margin-bottom:10px;color:var(--event-accent);font-size:10px;font-weight:1000;letter-spacing:.10em}
        .special-replay-result-title{display:block;color:#fff;font-size:clamp(32px,4vw,64px);font-weight:1000;line-height:1.06;letter-spacing:-.03em;text-wrap:balance}
        .special-replay-result-caption{display:block;margin-top:12px;color:#86a5ba;font-size:12px;font-weight:800}
        .special-replay-state-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .special-replay-state-chip{padding:7px 10px;border:1px solid rgba(130,195,237,.09);border-radius:999px;background:rgba(6,28,44,.65);color:#87aec8;font-size:9px;font-weight:950}
        .special-replay-state-chip.primary{border-color:color-mix(in srgb,var(--event-accent) 26%,transparent);background:color-mix(in srgb,var(--event-accent) 10%,rgba(6,28,44,.65));color:color-mix(in srgb,var(--event-accent) 80%,white)}

        .special-replay-feed{
          min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:16px;
          border:1px solid rgba(140,198,237,.10);border-radius:18px;background:linear-gradient(180deg,rgba(9,32,48,.88),rgba(4,18,29,.94))
        }
        .special-replay-feed-head{display:flex;align-items:end;justify-content:space-between;gap:10px}
        .special-replay-feed-head span{display:block;color:#6aa5cd;font-size:8px;font-weight:1000;letter-spacing:.12em}
        .special-replay-feed-head strong{display:block;margin-top:3px;color:#eff8fd;font-size:18px;font-weight:1000}
        .special-replay-feed-count{color:#587a91;font-size:8px;font-weight:900}
        .special-replay-feed-list{min-height:0;display:flex;flex-direction:column;gap:6px;overflow:hidden}
        .special-replay-feed-item{
          min-height:0;display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;padding:9px 10px;border-radius:11px;
          background:rgba(5,23,36,.58);opacity:.58
        }
        .special-replay-feed-item.current{flex:1.35;background:linear-gradient(90deg,rgba(30,91,132,.40),rgba(8,35,53,.76));opacity:1;box-shadow:inset 3px 0 0 var(--sr-accent)}
        .special-replay-feed-inning{color:#6a99b7;font-size:8px;font-weight:1000}
        .special-replay-feed-copy{min-width:0}.special-replay-feed-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eaf6fd;font-size:10px;font-weight:1000}
        .special-replay-feed-copy span{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7898ad;font-size:8px;font-weight:800}
        .special-replay-feed-current-result{margin-top:5px!important;white-space:normal!important;color:#b9d9ed!important;font-size:10px!important;line-height:1.35}
        .special-replay-feed-footer{display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;align-items:center;padding-top:8px;border-top:1px solid rgba(130,195,237,.07)}
        .special-replay-diamond{position:relative;width:58px;aspect-ratio:1;transform:rotate(45deg);margin:auto}
        .special-replay-base{position:absolute;width:24%;aspect-ratio:1;border:1px solid #7896aa;background:#0a2234}
        .special-replay-base.on{border-color:#ffcf68;background:#ffca52;box-shadow:0 0 14px rgba(255,202,82,.28)}
        .special-replay-base.b2{left:0;top:0}.special-replay-base.b1{right:0;top:0}.special-replay-base.b3{left:0;bottom:0}
        .special-replay-homeplate{position:absolute;right:0;bottom:0;width:22%;aspect-ratio:1;border:1px solid #d6e8f3;background:#ecf7fd}
        .special-replay-feed-state span{display:block;color:#5d839b;font-size:7px;font-weight:900}
        .special-replay-feed-state strong{display:block;margin-top:4px;color:#eaf7ff;font-size:11px;font-weight:1000}
        .special-replay-outs{display:flex;gap:4px;margin-top:7px}.special-replay-outs i{width:8px;height:8px;border-radius:50%;border:1px solid rgba(255,104,104,.85)}.special-replay-outs i.on{background:#ff6161}

        .special-replay-lineups{
          display:grid;grid-template-columns:1fr 1fr;gap:10px
        }
        .special-replay-lineup-rail{
          min-width:0;display:grid;grid-template-columns:auto repeat(9,minmax(0,1fr));gap:5px;align-items:center;
          padding:8px 10px;border:1px solid rgba(140,198,237,.08);border-radius:14px;background:rgba(7,27,42,.76)
        }
        .special-replay-lineup-team{min-width:86px;padding-right:7px;border-right:1px solid rgba(130,195,237,.07)}
        .special-replay-lineup-team span{display:block;color:#5e8daa;font-size:7px;font-weight:1000;letter-spacing:.10em}
        .special-replay-lineup-team strong{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9f6fd;font-size:10px;font-weight:1000}
        .special-replay-lineup-cell{min-width:0;padding:6px 5px;border-radius:9px;text-align:center;background:rgba(4,18,29,.38)}
        .special-replay-lineup-cell b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9eb8c9;font-size:8px;font-weight:900}
        .special-replay-lineup-cell small{display:block;margin-top:2px;color:#557d98;font-size:6px;font-weight:900}
        .special-replay-lineup-cell.active{background:linear-gradient(180deg,rgba(44,127,183,.44),rgba(19,75,111,.38));box-shadow:inset 0 0 0 1px rgba(104,192,249,.20)}
        .special-replay-lineup-cell.active b{color:#fff}.special-replay-lineup-cell.active small{color:#91d1fb}

        .special-replay-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
        .special-replay-progress{display:grid;gap:4px}.special-replay-progress-top{display:flex;justify-content:space-between;color:#5e8097;font-size:8px;font-weight:850}
        .special-replay-progress-track{height:3px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.special-replay-progress-bar{height:100%;background:linear-gradient(90deg,#3b96d1,#72c7f7)}
        .special-replay-controls{display:flex;gap:5px}.special-replay-control{height:29px;min-width:34px;padding:0 8px;border:1px solid rgba(130,195,237,.10);border-radius:8px;background:#0a273b;color:#dff3ff;font-size:8px;font-weight:1000;cursor:pointer}.special-replay-control.primary{min-width:55px;background:#17679c}

        .special-replay-rotate-hint{display:none}

        @media (min-width:1200px) and (min-height:650px){
          .special-replay-shell{gap:12px;padding:16px}
          .special-replay-scoreboard{min-height:108px;padding:14px 62px 14px 22px}
          .special-replay-brand-kicker{font-size:11px}.special-replay-brand-title{font-size:15px}
          .special-replay-score-team{font-size:21px}.special-replay-score-number{min-width:72px;font-size:66px}
          .special-replay-inning-pill{min-width:102px;padding:10px 14px;font-size:12px}
          .special-replay-score-meta-item span{font-size:9px}.special-replay-score-meta-item strong{font-size:15px}
          .special-replay-main{grid-template-columns:minmax(0,1fr) minmax(360px,33%);gap:12px}
          .special-replay-focus{gap:20px;padding:28px 32px}.special-replay-focus-label{font-size:11px}.special-replay-focus-event{font-size:10px}
          .special-replay-matchup{gap:24px;padding:12px 0 20px}.special-replay-person span{font-size:10px}.special-replay-person strong{font-size:27px}
          .special-replay-vs{width:48px;height:48px;font-size:11px}
          .special-replay-result-kicker{font-size:12px}.special-replay-result-title{font-size:clamp(44px,4vw,72px)}.special-replay-result-caption{font-size:15px}
          .special-replay-state-chip{padding:8px 12px;font-size:11px}
          .special-replay-feed{gap:12px;padding:20px}.special-replay-feed-head span{font-size:10px}.special-replay-feed-head strong{font-size:22px}.special-replay-feed-count{font-size:10px}
          .special-replay-feed-list{gap:8px}.special-replay-feed-item{grid-template-columns:48px minmax(0,1fr);padding:11px 12px}
          .special-replay-feed-inning{font-size:10px}.special-replay-feed-copy strong{font-size:13px}.special-replay-feed-copy span{font-size:10px}.special-replay-feed-current-result{font-size:12px!important}
          .special-replay-feed-footer{grid-template-columns:104px minmax(0,1fr)}.special-replay-diamond{width:72px}.special-replay-feed-state span{font-size:9px}.special-replay-feed-state strong{font-size:14px}
          .special-replay-lineups{gap:12px}.special-replay-lineup-rail{padding:10px 12px;gap:6px}.special-replay-lineup-team{min-width:108px}.special-replay-lineup-team span{font-size:9px}.special-replay-lineup-team strong{font-size:13px}
          .special-replay-lineup-cell{padding:8px 6px}.special-replay-lineup-cell b{font-size:10px}.special-replay-lineup-cell small{font-size:8px}
          .special-replay-progress-top{font-size:9px}.special-replay-control{height:32px;min-width:38px;font-size:10px}.special-replay-control.primary{min-width:62px}
        }


        /* v7.78 dense Gamecast stage */
        .special-replay-focus{
          grid-template-rows:auto auto minmax(0,1fr) auto;
          gap:13px
        }
        .special-replay-focus-body{
          min-height:0;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(220px,.72fr);
          gap:12px
        }
        .special-replay-result-panel{
          min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;
          gap:10px;padding:16px 18px;border:1px solid rgba(132,194,235,.08);border-radius:14px;
          background:linear-gradient(155deg,rgba(5,25,39,.52),rgba(7,31,47,.78))
        }
        .special-replay-result{
          align-self:center
        }
        .special-replay-result-title{
          font-size:clamp(30px,3.25vw,54px)
        }
        .special-replay-result-detail{
          display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px
        }
        .special-replay-result-detail-card{
          min-width:0;padding:9px 10px;border-radius:10px;background:rgba(3,17,27,.52)
        }
        .special-replay-result-detail-card span{
          display:block;color:#577f99;font-size:7px;font-weight:950;letter-spacing:.08em
        }
        .special-replay-result-detail-card strong{
          display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#e9f7ff;font-size:10px;font-weight:1000
        }

        .special-replay-state-panel{
          min-width:0;min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr);
          gap:8px;padding:14px;border:1px solid rgba(132,194,235,.08);border-radius:14px;
          background:linear-gradient(180deg,rgba(10,42,62,.62),rgba(4,20,32,.72))
        }
        .special-replay-state-panel-head{
          display:flex;align-items:center;justify-content:space-between;gap:8px
        }
        .special-replay-state-panel-head span{
          color:#6b9cbb;font-size:7px;font-weight:1000;letter-spacing:.10em
        }
        .special-replay-state-panel-head strong{
          color:#f0f9ff;font-size:12px;font-weight:1000
        }
        .special-replay-state-big{
          display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:center;
          padding:9px;border-radius:11px;background:rgba(3,17,27,.50)
        }
        .special-replay-state-big .special-replay-diamond{width:62px}
        .special-replay-state-copy span{
          display:block;color:#5f88a2;font-size:7px;font-weight:900
        }
        .special-replay-state-copy strong{
          display:block;margin-top:4px;color:#eff8fd;font-size:13px;font-weight:1000
        }
        .special-replay-state-scoreline{
          display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:7px;
          padding:10px;border-radius:11px;background:rgba(3,17,27,.50)
        }
        .special-replay-state-scoreline span{
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7fa6bf;font-size:8px;font-weight:900
        }
        .special-replay-state-scoreline span:last-child{text-align:right}
        .special-replay-state-scoreline strong{
          color:#fff;font-size:20px;font-weight:1000;font-variant-numeric:tabular-nums
        }
        .special-replay-state-summary{
          align-self:end;display:grid;grid-template-columns:1fr 1fr;gap:7px
        }
        .special-replay-state-summary-card{
          min-width:0;padding:9px;border-radius:10px;background:rgba(3,17,27,.40)
        }
        .special-replay-state-summary-card span{
          display:block;color:#557e98;font-size:6px;font-weight:950;letter-spacing:.08em
        }
        .special-replay-state-summary-card strong{
          display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#dceef8;font-size:9px;font-weight:950
        }

        .special-replay-focus-bottom{
          display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px
        }
        .special-replay-context-card{
          min-width:0;padding:10px 11px;border:1px solid rgba(132,194,235,.07);border-radius:11px;
          background:rgba(5,23,36,.48)
        }
        .special-replay-context-card span{
          display:block;color:#567f99;font-size:7px;font-weight:950;letter-spacing:.08em
        }
        .special-replay-context-card strong{
          display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:#eaf7ff;font-size:10px;font-weight:1000
        }

        @media (min-width:1200px) and (min-height:650px){
          .special-replay-focus-body{grid-template-columns:minmax(0,1.5fr) minmax(270px,.78fr);gap:15px}
          .special-replay-result-panel{gap:13px;padding:20px 22px}
          .special-replay-result-title{font-size:clamp(38px,3.4vw,62px)}
          .special-replay-result-detail{gap:9px}
          .special-replay-result-detail-card{padding:11px 12px}
          .special-replay-result-detail-card span{font-size:9px}
          .special-replay-result-detail-card strong{font-size:13px}
          .special-replay-state-panel{gap:10px;padding:17px}
          .special-replay-state-panel-head span{font-size:9px}
          .special-replay-state-panel-head strong{font-size:16px}
          .special-replay-state-big{grid-template-columns:112px minmax(0,1fr);gap:15px;padding:12px}
          .special-replay-state-big .special-replay-diamond{width:78px}
          .special-replay-state-copy span{font-size:9px}
          .special-replay-state-copy strong{font-size:16px}
          .special-replay-state-scoreline{padding:12px}
          .special-replay-state-scoreline span{font-size:10px}
          .special-replay-state-scoreline strong{font-size:27px}
          .special-replay-state-summary{gap:9px}
          .special-replay-state-summary-card{padding:11px}
          .special-replay-state-summary-card span{font-size:8px}
          .special-replay-state-summary-card strong{font-size:12px}
          .special-replay-focus-bottom{gap:10px}
          .special-replay-context-card{padding:12px 13px}
          .special-replay-context-card span{font-size:9px}
          .special-replay-context-card strong{font-size:13px}
        }

        @media (max-height:560px) and (orientation:landscape){
          .special-replay-shell{grid-template-rows:auto minmax(0,1fr) auto auto;gap:5px;padding:5px}
          .special-replay-scoreboard{min-height:58px;grid-template-columns:115px minmax(0,1fr) 115px;gap:6px;padding:5px 40px 5px 8px;border-radius:10px}
          .special-replay-brand-kicker{font-size:6px}.special-replay-brand-title{margin-top:2px;font-size:7px}
          .special-replay-score-main{gap:5px}.special-replay-score-team{font-size:8px}.special-replay-score-number{min-width:28px;font-size:28px}.special-replay-inning-pill{min-width:52px;padding:4px 6px;font-size:6px}
          .special-replay-score-meta{gap:2px}.special-replay-score-meta-item{padding:3px 2px;border-radius:5px}.special-replay-score-meta-item span{font-size:4px}.special-replay-score-meta-item strong{margin-top:1px;font-size:7px}
          .special-replay-main{grid-template-columns:minmax(0,1fr) 34%;gap:5px}
          .special-replay-focus{gap:6px;padding:8px 10px;border-radius:9px}.special-replay-focus-label,.special-replay-focus-event{font-size:5px}.special-replay-focus-label i{width:5px;height:5px}
          .special-replay-matchup{gap:7px;padding:2px 0 5px}.special-replay-person span{margin-bottom:1px;font-size:4px}.special-replay-person strong{font-size:8px}.special-replay-vs{width:22px;height:22px;font-size:5px}
          .special-replay-result-kicker{margin-bottom:2px;font-size:5px}.special-replay-result-title{font-size:15px}.special-replay-result-caption{margin-top:3px;font-size:5px}
          .special-replay-state-row{gap:3px}.special-replay-state-chip{padding:3px 5px;font-size:5px}.special-replay-focus-body{grid-template-columns:minmax(0,1.35fr) 32%;gap:5px}.special-replay-result-panel{gap:4px;padding:6px 7px;border-radius:7px}.special-replay-result-detail{gap:3px}.special-replay-result-detail-card{padding:4px}.special-replay-result-detail-card span{font-size:4px}.special-replay-result-detail-card strong{font-size:5px}.special-replay-state-panel{gap:3px;padding:5px;border-radius:7px}.special-replay-state-panel-head span{font-size:4px}.special-replay-state-panel-head strong{font-size:6px}.special-replay-state-big{grid-template-columns:42px minmax(0,1fr);gap:4px;padding:4px}.special-replay-state-big .special-replay-diamond{width:31px}.special-replay-state-copy span{font-size:4px}.special-replay-state-copy strong{font-size:5px}.special-replay-state-scoreline{gap:3px;padding:4px}.special-replay-state-scoreline span{font-size:4px}.special-replay-state-scoreline strong{font-size:9px}.special-replay-state-summary{gap:3px}.special-replay-state-summary-card{padding:4px}.special-replay-state-summary-card span{font-size:4px}.special-replay-state-summary-card strong{font-size:5px}.special-replay-focus-bottom{gap:3px}.special-replay-context-card{padding:4px}.special-replay-context-card span{font-size:4px}.special-replay-context-card strong{font-size:5px}
          .special-replay-feed{gap:4px;padding:6px;border-radius:9px}.special-replay-feed-head span{font-size:5px}.special-replay-feed-head strong{font-size:9px}.special-replay-feed-count{font-size:5px}
          .special-replay-feed-list{gap:3px}.special-replay-feed-item{grid-template-columns:25px minmax(0,1fr);gap:4px;padding:4px 5px;border-radius:6px}.special-replay-feed-inning{font-size:5px}.special-replay-feed-copy strong{font-size:6px}.special-replay-feed-copy span{margin-top:1px;font-size:5px}.special-replay-feed-current-result{font-size:6px!important}
          .special-replay-feed-footer{grid-template-columns:45px minmax(0,1fr);gap:4px;padding-top:3px}.special-replay-diamond{width:34px}.special-replay-feed-state span{font-size:4px}.special-replay-feed-state strong{font-size:6px}.special-replay-outs{gap:2px;margin-top:2px}.special-replay-outs i{width:5px;height:5px}
          .special-replay-lineups{gap:5px}.special-replay-lineup-rail{grid-template-columns:52px repeat(9,minmax(0,1fr));gap:2px;padding:3px 4px;border-radius:8px}.special-replay-lineup-team{min-width:0;padding-right:3px}.special-replay-lineup-team span{font-size:4px}.special-replay-lineup-team strong{margin-top:1px;font-size:5px}.special-replay-lineup-cell{padding:3px 2px;border-radius:5px}.special-replay-lineup-cell b{font-size:5px}.special-replay-lineup-cell small{display:none}
          .special-replay-footer{gap:5px}.special-replay-progress-top{font-size:5px}.special-replay-control{height:20px;min-width:24px;padding:0 5px;font-size:5px}.special-replay-control.primary{min-width:36px}
        }

        @media (orientation:portrait){
          .special-replay-shell{grid-template-rows:auto minmax(0,1fr) auto auto;padding:8px;gap:7px}
          .special-replay-scoreboard{grid-template-columns:1fr;padding:10px 44px 10px 10px;gap:7px}.special-replay-brand{display:none}.special-replay-score-meta{display:none}
          .special-replay-score-team{font-size:10px}.special-replay-score-number{min-width:34px;font-size:34px}.special-replay-inning-pill{min-width:62px;padding:5px 7px;font-size:7px}
          .special-replay-main{grid-template-columns:1fr}.special-replay-feed{display:none}
          .special-replay-focus{padding:16px}.special-replay-result-title{font-size:clamp(28px,9vw,44px)}.special-replay-focus-body{grid-template-columns:1fr}.special-replay-state-panel{display:none}.special-replay-focus-bottom{grid-template-columns:1fr 1fr}.special-replay-context-card:last-child{display:none}
          .special-replay-lineups{grid-template-columns:1fr}.special-replay-lineup-rail:nth-child(2){display:none}
          .special-replay-lineup-rail{grid-template-columns:65px repeat(9,minmax(0,1fr));gap:2px;padding:4px}.special-replay-lineup-cell{padding:4px 2px}.special-replay-lineup-cell b{font-size:6px}.special-replay-lineup-cell small{display:none}
          .special-replay-rotate-hint{display:block;position:absolute;left:50%;top:7px;z-index:9;transform:translateX(-50%);padding:5px 9px;border:1px solid rgba(126,193,240,.12);border-radius:999px;background:rgba(3,18,30,.86);color:#8fc4e7;font-size:7px;font-weight:900}
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
      const cells = (Array.isArray(lineup) ? lineup : []).slice(0,9).map((player,index) => {
        const playerName = String(player && player.name || '');
        const active = isOffense && String(event.k || '') === 'pa' && playerName && String(event.n || '') === playerName;
        return '<div class="special-replay-lineup-cell ' + (active ? 'active' : '') + '"><b>' + escapeHtml(playerName || '-') + '</b><small>' + escapeHtml((player.order || index + 1) + ' · ' + (player.pos || '')) + '</small></div>';
      }).join('');
      return '<div class="special-replay-lineup-rail"><div class="special-replay-lineup-team"><span>' + sideLabel + '</span><strong>' + escapeHtml(teamName) + '</strong></div>' + cells + '</div>';
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

    function specialReplayTone(event) {
      const text = String((event && event.r) || '') + ' ' + String((event && event.k) || '');
      if (/全壘打|home run|homer|hr/i.test(text)) return 'tone-hr';
      if (/超前|追平|得分|跑回|兩分|三分|滿貫|score/i.test(text)) return 'tone-score';
      if (/三振|strikeout/i.test(text)) return 'tone-k';
      if (/保送|觸身|walk/i.test(text)) return 'tone-walk';
      if (/換投|代打|代跑|換人|pitch|sub/i.test(text)) return 'tone-change';
      if (/half|結束/.test(text)) return 'tone-half';
      return '';
    }

    function specialReplayScoreboardHtml(state,event) {
      const detail = state.detail;
      const summary = detail.payload && detail.payload.summary || {};
      const scores = Array.isArray(event.s) ? event.s : [0,0];
      const lastEvent = state.index >= state.events.length - 1;
      return '<header class="special-replay-scoreboard">'
        + '<div class="special-replay-brand"><span class="special-replay-brand-kicker">WBC 2026 · REPLAY</span><strong class="special-replay-brand-title">' + escapeHtml(detail.title || '特殊比賽') + '</strong></div>'
        + '<div class="special-replay-score-main">'
        +   '<span class="special-replay-score-team away">' + escapeHtml(detail.away_team || '中華台北') + '</span>'
        +   '<strong class="special-replay-score-number">' + (Number(scores[0]) || 0) + '</strong>'
        +   '<span class="special-replay-inning-pill">' + escapeHtml(lastEvent ? '比賽結束' : specialReplayInningLabel(event)) + '</span>'
        +   '<strong class="special-replay-score-number">' + (Number(scores[1]) || 0) + '</strong>'
        +   '<span class="special-replay-score-team home">' + escapeHtml(detail.home_team || '韓國') + '</span>'
        + '</div>'
        + '<div class="special-replay-score-meta">'
        +   '<div class="special-replay-score-meta-item"><span>R</span><strong>' + escapeHtml((Number(scores[0]) || 0) + '–' + (Number(scores[1]) || 0)) + '</strong></div>'
        +   '<div class="special-replay-score-meta-item"><span>H</span><strong>' + escapeHtml((summary.away_hits == null ? '-' : summary.away_hits) + '–' + (summary.home_hits == null ? '-' : summary.home_hits)) + '</strong></div>'
        +   '<div class="special-replay-score-meta-item"><span>E</span><strong>' + escapeHtml((summary.away_errors == null ? '-' : summary.away_errors) + '–' + (summary.home_errors == null ? '-' : summary.home_errors)) + '</strong></div>'
        + '</div>'
        + '</header>';
    }

    function specialReplayRecentEventsHtml(state,event) {
      const start = Math.max(0, state.index - 5);
      const items = state.events.slice(start, state.index + 1);
      return items.map((item,offset) => {
        const absoluteIndex = start + offset;
        const current = absoluteIndex === state.index;
        return '<div class="special-replay-feed-item ' + (current ? 'current' : '') + '">'
          + '<span class="special-replay-feed-inning">' + escapeHtml(specialReplayInningLabel(item)) + '</span>'
          + '<div class="special-replay-feed-copy"><strong>' + escapeHtml(item.n || specialReplayKindLabel(item.k)) + '</strong>'
          + '<span>' + escapeHtml(specialReplayKindLabel(item.k)) + '</span>'
          + (current ? '<span class="special-replay-feed-current-result">' + escapeHtml(item.r || '—') + '</span>' : '<span>' + escapeHtml(item.r || '—') + '</span>')
          + '</div></div>';
      }).join('');
    }

    function specialReplayNextBatter(state,event) {
      const payload = state.detail && state.detail.payload || {};
      const lineups = payload.lineups || specialReplayFallbackLineups();
      const side = String(event && event.h || 'T') === 'T' ? 'away' : 'home';
      const lineup = Array.isArray(lineups && lineups[side]) ? lineups[side] : [];
      if (!lineup.length) return '—';

      const currentName = String(event && event.n || '');
      const currentIndex = lineup.findIndex(player => String(player && player.name || '') === currentName);
      if (currentIndex >= 0) {
        const next = lineup[(currentIndex + 1) % lineup.length];
        return String(next && next.name || '—');
      }

      for (let i = state.index + 1; i < state.events.length; i += 1) {
        const nextEvent = state.events[i];
        if (nextEvent && nextEvent.h === event.h && nextEvent.k === 'pa' && nextEvent.n) return String(nextEvent.n);
        if (nextEvent && nextEvent.h !== event.h) break;
      }
      return '—';
    }

    function specialReplayCenterHtml(state,event) {
      const detail = state.detail;
      const payload = detail.payload || {};
      const lineScore = payload.line_score || {};
      const scores = Array.isArray(event.s) ? event.s : [0,0];
      const pitcher = specialReplayCurrentPitcher(state,event);
      const prev = specialReplayPreviousPa(state);
      const nextBatter = specialReplayNextBatter(state,event);
      const subject = event.n || specialReplayInningLabel(event);
      const isPlateAppearance = String(event.k || '') === 'pa';
      const subjectLabel = isPlateAppearance ? 'BATTER' : 'EVENT';
      const result = event.r || '—';
      const baseMask = Number(event.b) || 0;
      const baseText = baseMask === 0 ? '壘上無人'
        : [baseMask & 1 ? '一壘' : '', baseMask & 2 ? '二壘' : '', baseMask & 4 ? '三壘' : ''].filter(Boolean).join('、') + '有人';
      const outs = Math.max(0, Math.min(3, Number(event.o) || 0));
      const tone = specialReplayTone(event);
      const eventKind = specialReplayKindLabel(event.k);
      const inningIndex = Math.max(0, (Number(event.i) || 1) - 1);
      const awayInningRuns = Array.isArray(lineScore.away) && lineScore.away[inningIndex] != null ? lineScore.away[inningIndex] : 0;
      const homeInningRuns = Array.isArray(lineScore.home) && lineScore.home[inningIndex] != null ? lineScore.home[inningIndex] : 0;
      const battingTeam = String(event.h || 'T') === 'T' ? detail.away_team : detail.home_team;

      return '<div class="special-replay-main">'
        + '<section class="special-replay-focus ' + tone + '">'
        +   '<div class="special-replay-focus-head"><span class="special-replay-focus-label"><i></i>LIVE PLAY</span><span class="special-replay-focus-event">EVENT ' + (state.index + 1) + ' / ' + state.events.length + '</span></div>'
        +   '<div class="special-replay-matchup">'
        +     '<div class="special-replay-person"><span>PITCHER</span><strong>' + escapeHtml(pitcher || '-') + '</strong></div>'
        +     '<div class="special-replay-vs">VS</div>'
        +     '<div class="special-replay-person right"><span>' + subjectLabel + '</span><strong>' + escapeHtml(subject) + '</strong></div>'
        +   '</div>'
        +   '<div class="special-replay-focus-body">'
        +     '<div class="special-replay-result-panel">'
        +       '<div class="special-replay-result"><span class="special-replay-result-kicker">' + escapeHtml(eventKind) + '</span><strong class="special-replay-result-title">' + escapeHtml(result) + '</strong><span class="special-replay-result-caption">' + escapeHtml(specialReplayInningLabel(event)) + ' · ' + escapeHtml(battingTeam || '') + ' 進攻</span></div>'
        +       '<div></div>'
        +       '<div class="special-replay-result-detail">'
        +         '<div class="special-replay-result-detail-card"><span>當下比分</span><strong>' + (Number(scores[0]) || 0) + '：' + (Number(scores[1]) || 0) + '</strong></div>'
        +         '<div class="special-replay-result-detail-card"><span>本局得分</span><strong>' + escapeHtml(String(awayInningRuns) + '：' + String(homeInningRuns)) + '</strong></div>'
        +         '<div class="special-replay-result-detail-card"><span>事件類型</span><strong>' + escapeHtml(eventKind) + '</strong></div>'
        +       '</div>'
        +     '</div>'
        +     '<aside class="special-replay-state-panel">'
        +       '<div class="special-replay-state-panel-head"><span>GAME STATE</span><strong>' + escapeHtml(specialReplayInningLabel(event)) + '</strong></div>'
        +       '<div class="special-replay-state-big"><div>' + specialReplayBaseHtml(event.b) + '</div><div class="special-replay-state-copy"><span>壘況</span><strong>' + escapeHtml(baseText) + '</strong>' + specialReplayOutsHtml(outs) + '</div></div>'
        +       '<div class="special-replay-state-scoreline"><span>' + escapeHtml(detail.away_team || '') + '</span><strong>' + (Number(scores[0]) || 0) + '–' + (Number(scores[1]) || 0) + '</strong><span>' + escapeHtml(detail.home_team || '') + '</span></div>'
        +       '<div class="special-replay-state-summary">'
        +         '<div class="special-replay-state-summary-card"><span>投手</span><strong>' + escapeHtml(pitcher || '-') + '</strong></div>'
        +         '<div class="special-replay-state-summary-card"><span>下一棒</span><strong>' + escapeHtml(nextBatter) + '</strong></div>'
        +       '</div>'
        +     '</aside>'
        +   '</div>'
        +   '<div class="special-replay-focus-bottom">'
        +     '<div class="special-replay-context-card"><span>上一打席</span><strong>' + escapeHtml(prev ? prev.n + '｜' + prev.r : '—') + '</strong></div>'
        +     '<div class="special-replay-context-card"><span>目前打者</span><strong>' + escapeHtml(subject) + '</strong></div>'
        +     '<div class="special-replay-context-card"><span>下一棒</span><strong>' + escapeHtml(nextBatter) + '</strong></div>'
        +   '</div>'
        + '</section>'
        + '<aside class="special-replay-feed">'
        +   '<div class="special-replay-feed-head"><div><span>PLAY-BY-PLAY</span><strong>' + escapeHtml(specialReplayInningLabel(event)) + '</strong></div><span class="special-replay-feed-count">最近 ' + Math.min(6,state.index+1) + ' 個事件</span></div>'
        +   '<div class="special-replay-feed-list">' + specialReplayRecentEventsHtml(state,event) + '</div>'
        +   '<div class="special-replay-feed-footer"><div>' + specialReplayBaseHtml(event.b) + '</div><div class="special-replay-feed-state"><span>GAME STATE</span><strong>' + escapeHtml(baseText) + ' · ' + outs + ' 出局</strong>' + specialReplayOutsHtml(outs) + '</div></div>'
        + '</aside>'
        + '</div>';
    }

    function specialReplayFooterHtml(state,event) {
      const progress = Math.max(0, Math.min(100, ((state.index + 1) / state.events.length) * 100));
      const lastEvent = state.index >= state.events.length - 1;
      const eventKind = specialReplayKindLabel(event.k);
      return '<div class="special-replay-footer"><div class="special-replay-progress"><div class="special-replay-progress-top"><span>' + escapeHtml(eventKind) + ' · ' + (Math.max(250,Number(event.d)||1000)/1000).toFixed(1) + ' 秒</span><span>' + (state.index + 1) + ' / ' + state.events.length + '</span></div><div class="special-replay-progress-track"><div class="special-replay-progress-bar" style="width:' + progress.toFixed(2) + '%"></div></div></div><div class="special-replay-controls"><button class="special-replay-control" type="button" data-special-replay-prev>‹</button><button class="special-replay-control primary" type="button" data-special-replay-toggle>' + (state.playing ? '暫停' : (lastEvent ? '重播' : '播放')) + '</button><button class="special-replay-control" type="button" data-special-replay-next>›</button></div></div>';
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

      state.overlay.classList.remove('tone-hr','tone-score','tone-k','tone-walk','tone-change','tone-half');
      const tone = specialReplayTone(event);
      if (tone) state.overlay.classList.add(tone);

      state.overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button>'
        + '<div class="special-replay-shell">'
        + specialReplayScoreboardHtml(state,event)
        + specialReplayCenterHtml(state,event)
        + '<div class="special-replay-lineups">'
        + specialReplayLineupHtml('away',state.detail.away_team || '中華台北',lineups.away,event)
        + specialReplayLineupHtml('home',state.detail.home_team || '韓國',lineups.home,event)
        + '</div>'
        + specialReplayFooterHtml(state,event)
        + '</div>';

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
