    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v2:';
    const specialReplayMemory = new Map();
    let specialReplayActive = null;
    let specialGamesLoadedOnce = false;

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


        /* v7.79 sizing, semantic event colors, scoring emphasis */
        .special-replay-main{
          grid-template-columns:minmax(0,56%) minmax(0,44%);
        }
        .special-replay-focus.event-hit{--event-accent:#ff6767}
        .special-replay-focus.event-walk{--event-accent:#55d88a}
        .special-replay-focus.event-sac{--event-accent:#5f9eff}
        .special-replay-focus.event-hr{--event-accent:#b978ff}
        .special-replay-focus.event-scored{
          border-color:#e7bc58;
          box-shadow:0 0 0 1px rgba(231,188,88,.25),0 0 28px rgba(231,188,88,.16),0 18px 46px rgba(0,0,0,.19)
        }
        .special-replay-focus.event-scored:after{
          height:4px;background:linear-gradient(90deg,transparent,#f2c965 18%,#ffe4a0 50%,#f2c965 82%,transparent);opacity:1
        }
        .special-replay-focus.event-hit .special-replay-result-title{color:#ff7d7d}
        .special-replay-focus.event-walk .special-replay-result-title{color:#6ee49d}
        .special-replay-focus.event-sac .special-replay-result-title{color:#79b0ff}
        .special-replay-focus.event-hr .special-replay-result-title{color:#c590ff}
        .special-replay-focus.event-scored .special-replay-result-panel{
          border-color:rgba(235,194,94,.24);
          box-shadow:inset 0 0 0 1px rgba(235,194,94,.06)
        }
        .special-replay-focus.event-scored .special-replay-result-kicker{color:#f0c75e}

        .special-replay-feed-head span{font-size:10px}
        .special-replay-feed-head strong{font-size:21px}
        .special-replay-feed-count{font-size:10px}
        .special-replay-feed-inning{font-size:10px}
        .special-replay-feed-copy strong{font-size:13px}
        .special-replay-feed-copy span{font-size:10px}
        .special-replay-feed-current-result{font-size:12px!important}

        .special-replay-score-meta-item span{font-size:9px}
        .special-replay-score-meta-item strong{font-size:15px}
        .special-replay-result-detail-card span{font-size:9px}
        .special-replay-result-detail-card strong{font-size:13px}
        .special-replay-state-panel-head span{font-size:9px}
        .special-replay-state-panel-head strong{font-size:15px}
        .special-replay-state-copy span{font-size:9px}
        .special-replay-state-copy strong{font-size:16px}
        .special-replay-state-summary-card span{font-size:8px}
        .special-replay-state-summary-card strong{font-size:12px}
        .special-replay-context-card span{font-size:9px}
        .special-replay-context-card strong{font-size:13px}

        .special-replay-lineup-team span{font-size:9px}
        .special-replay-lineup-team strong{font-size:13px}
        .special-replay-lineup-cell b{font-size:11px}
        .special-replay-lineup-cell small{font-size:8px}

        .special-replay-download{
          min-width:76px!important;padding:0 11px!important;
          border-color:rgba(125,202,247,.18)!important;
          background:linear-gradient(180deg,#124a70,#0d3856)!important
        }

        @media (min-width:1200px) and (min-height:650px){
          .special-replay-main{
            grid-template-columns:minmax(0,56%) minmax(430px,44%);
            gap:14px
          }
          .special-replay-feed{padding:22px}
          .special-replay-feed-head span{font-size:12px}
          .special-replay-feed-head strong{font-size:26px}
          .special-replay-feed-count{font-size:11px}
          .special-replay-feed-inning{font-size:12px}
          .special-replay-feed-copy strong{font-size:16px}
          .special-replay-feed-copy span{font-size:12px}
          .special-replay-feed-current-result{font-size:14px!important}
          .special-replay-feed-state span{font-size:11px}
          .special-replay-feed-state strong{font-size:16px}

          .special-replay-score-meta-item span{font-size:10px}
          .special-replay-score-meta-item strong{font-size:17px}
          .special-replay-result-detail-card span{font-size:10px}
          .special-replay-result-detail-card strong{font-size:15px}
          .special-replay-state-panel-head span{font-size:10px}
          .special-replay-state-panel-head strong{font-size:18px}
          .special-replay-state-copy span{font-size:10px}
          .special-replay-state-copy strong{font-size:18px}
          .special-replay-state-summary-card span{font-size:9px}
          .special-replay-state-summary-card strong{font-size:14px}
          .special-replay-context-card span{font-size:10px}
          .special-replay-context-card strong{font-size:15px}

          .special-replay-lineup-team span{font-size:10px}
          .special-replay-lineup-team strong{font-size:15px}
          .special-replay-lineup-cell b{font-size:12px}
          .special-replay-lineup-cell small{font-size:9px}
          .special-replay-progress-top{font-size:10px}
        }

        @media (max-height:560px) and (orientation:landscape){
          .special-replay-shell{grid-template-rows:auto minmax(0,1fr) auto auto;gap:5px;padding:5px}
          .special-replay-scoreboard{min-height:58px;grid-template-columns:115px minmax(0,1fr) 115px;gap:6px;padding:5px 40px 5px 8px;border-radius:10px}
          .special-replay-brand-kicker{font-size:6px}.special-replay-brand-title{margin-top:2px;font-size:7px}
          .special-replay-score-main{gap:5px}.special-replay-score-team{font-size:8px}.special-replay-score-number{min-width:28px;font-size:28px}.special-replay-inning-pill{min-width:52px;padding:4px 6px;font-size:6px}
          .special-replay-score-meta{gap:2px}.special-replay-score-meta-item{padding:3px 2px;border-radius:5px}.special-replay-score-meta-item span{font-size:4px}.special-replay-score-meta-item strong{margin-top:1px;font-size:7px}
          .special-replay-main{grid-template-columns:minmax(0,58%) minmax(0,42%);gap:5px}
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


        /* v7.80 readability pass */
        @media (min-width:1200px) and (min-height:650px){
          .special-replay-brand-kicker{font-size:12px}
          .special-replay-brand-title{font-size:17px}
          .special-replay-score-team{font-size:24px}
          .special-replay-score-number{font-size:72px}
          .special-replay-inning-pill{font-size:14px}
          .special-replay-score-meta-item span{font-size:11px}
          .special-replay-score-meta-item strong{font-size:19px}
          .special-replay-focus-label{font-size:13px}
          .special-replay-focus-event{font-size:12px}
          .special-replay-person span{font-size:12px}
          .special-replay-person strong{font-size:30px}
          .special-replay-result-kicker{font-size:14px}
          .special-replay-result-title{font-size:clamp(48px,4.4vw,78px)}
          .special-replay-result-caption{font-size:17px}
          .special-replay-result-detail-card span{font-size:11px}
          .special-replay-result-detail-card strong{font-size:17px}
          .special-replay-state-panel-head span{font-size:11px}
          .special-replay-state-panel-head strong{font-size:20px}
          .special-replay-state-copy span{font-size:11px}
          .special-replay-state-copy strong{font-size:20px}
          .special-replay-state-summary-card span{font-size:10px}
          .special-replay-state-summary-card strong{font-size:16px}
          .special-replay-context-card span{font-size:11px}
          .special-replay-context-card strong{font-size:17px}
          .special-replay-feed-head span{font-size:13px}
          .special-replay-feed-head strong{font-size:28px}
          .special-replay-feed-count{font-size:12px}
          .special-replay-feed-inning{font-size:13px}
          .special-replay-feed-copy strong{font-size:17px}
          .special-replay-feed-copy span{font-size:13px}
          .special-replay-feed-current-result{font-size:16px!important}
          .special-replay-feed-state span{font-size:12px}
          .special-replay-feed-state strong{font-size:17px}
          .special-replay-lineup-team span{font-size:11px}
          .special-replay-lineup-team strong{font-size:17px}
          .special-replay-lineup-cell b{font-size:14px}
          .special-replay-lineup-cell small{font-size:10px}
          .special-replay-progress-top{font-size:11px}
          .special-replay-control{font-size:12px;height:36px}
        }

        @media (max-height:560px) and (orientation:landscape){
          .special-replay-shell{gap:6px;padding:6px;grid-template-rows:64px minmax(0,1fr) 48px 30px}
          .special-replay-scoreboard{min-height:64px;grid-template-columns:104px minmax(0,1fr) 104px;gap:8px;padding:6px 40px 6px 8px}
          .special-replay-brand-kicker{font-size:8px}.special-replay-brand-title{font-size:9px}
          .special-replay-score-main{gap:7px}.special-replay-score-team{font-size:12px}
          .special-replay-score-number{min-width:34px;font-size:36px}.special-replay-inning-pill{min-width:60px;padding:5px 7px;font-size:8px}
          .special-replay-score-meta-item span{font-size:6px}.special-replay-score-meta-item strong{font-size:9px}

          .special-replay-main{grid-template-columns:minmax(0,55%) minmax(0,45%);gap:6px}
          .special-replay-focus{gap:7px;padding:9px 10px}
          .special-replay-focus-label{font-size:8px}.special-replay-focus-event{font-size:7px}.special-replay-focus-label i{width:7px;height:7px}
          .special-replay-matchup{gap:8px;padding:4px 0 6px}
          .special-replay-person span{font-size:7px}.special-replay-person strong{font-size:12px}.special-replay-vs{width:28px;height:28px;font-size:7px}
          .special-replay-focus-body{grid-template-columns:minmax(0,1.15fr) minmax(118px,.85fr);gap:6px}
          .special-replay-result-panel{gap:5px;padding:7px 8px}
          .special-replay-result-kicker{font-size:7px}
          .special-replay-result-title{font-size:clamp(18px,3.2vw,28px);line-height:1.08}
          .special-replay-result-caption{font-size:7px}
          .special-replay-result-detail{grid-template-columns:1fr 1fr;gap:4px}
          .special-replay-result-detail-card{padding:5px 6px}
          .special-replay-result-detail-card:nth-child(3){display:none}
          .special-replay-result-detail-card span{font-size:6px}.special-replay-result-detail-card strong{font-size:8px}
          .special-replay-state-panel{gap:5px;padding:7px}
          .special-replay-state-panel-head span{font-size:6px}.special-replay-state-panel-head strong{font-size:9px}
          .special-replay-state-big{grid-template-columns:52px minmax(0,1fr);gap:6px;padding:5px}
          .special-replay-state-big .special-replay-diamond{width:38px}
          .special-replay-state-copy span{font-size:6px}.special-replay-state-copy strong{font-size:8px}
          .special-replay-state-scoreline{gap:4px;padding:5px}.special-replay-state-scoreline span{font-size:6px}.special-replay-state-scoreline strong{font-size:11px}
          .special-replay-state-summary{grid-template-columns:1fr;gap:4px}.special-replay-state-summary-card{padding:5px}
          .special-replay-state-summary-card:last-child{display:none}
          .special-replay-state-summary-card span{font-size:6px}.special-replay-state-summary-card strong{font-size:8px}
          .special-replay-focus-bottom{grid-template-columns:1fr 1fr;gap:4px}
          .special-replay-context-card{padding:5px 6px}.special-replay-context-card:first-child{display:none}
          .special-replay-context-card span{font-size:6px}.special-replay-context-card strong{font-size:8px}

          .special-replay-feed{gap:5px;padding:7px}.special-replay-feed-head span{font-size:7px}.special-replay-feed-head strong{font-size:11px}.special-replay-feed-count{font-size:6px}
          .special-replay-feed-list{gap:4px}.special-replay-feed-item{grid-template-columns:30px minmax(0,1fr);gap:5px;padding:5px 6px}
          .special-replay-feed-inning{font-size:7px}.special-replay-feed-copy strong{font-size:8px}.special-replay-feed-copy span{font-size:7px}
          .special-replay-feed-current-result{font-size:8px!important}
          .special-replay-feed-footer{grid-template-columns:50px minmax(0,1fr);gap:6px;padding-top:4px}
          .special-replay-diamond{width:38px}.special-replay-feed-state span{font-size:6px}.special-replay-feed-state strong{font-size:8px}
          .special-replay-outs i{width:6px;height:6px}

          .special-replay-lineups{gap:5px}
          .special-replay-lineup-rail{grid-template-columns:60px repeat(9,minmax(0,1fr));gap:2px;padding:4px 5px}
          .special-replay-lineup-team span{font-size:6px}.special-replay-lineup-team strong{font-size:8px}
          .special-replay-lineup-cell{padding:4px 2px}.special-replay-lineup-cell b{font-size:7px}.special-replay-lineup-cell small{display:none}
          .special-replay-progress-top{font-size:6px}
          .special-replay-control{height:24px;min-width:28px;padding:0 6px;font-size:7px}
          .special-replay-download{min-width:68px!important;padding:0 7px!important}
        }

        @media (orientation:portrait){
          .special-replay-score-team{font-size:13px}.special-replay-score-number{font-size:38px}.special-replay-inning-pill{font-size:9px}
          .special-replay-focus-label{font-size:9px}.special-replay-focus-event{font-size:8px}
          .special-replay-person span{font-size:8px}.special-replay-person strong{font-size:15px}
          .special-replay-result-kicker{font-size:9px}.special-replay-result-title{font-size:clamp(30px,10vw,48px)}.special-replay-result-caption{font-size:10px}
          .special-replay-result-detail-card span{font-size:8px}.special-replay-result-detail-card strong{font-size:11px}
          .special-replay-context-card span{font-size:8px}.special-replay-context-card strong{font-size:11px}
          .special-replay-lineup-team span{font-size:7px}.special-replay-lineup-team strong{font-size:10px}.special-replay-lineup-cell b{font-size:8px}
          .special-replay-progress-top{font-size:7px}.special-replay-control{font-size:8px;height:28px}
        }

        .special-replay-exporting{
          position:absolute;inset:0;z-index:30;display:grid;place-items:center;
          background:rgba(2,9,15,.78);backdrop-filter:blur(8px)
        }
        .special-replay-export-card{
          width:min(420px,82vw);padding:22px;border:1px solid rgba(132,200,244,.16);border-radius:16px;
          background:#081c2b;box-shadow:0 24px 70px rgba(0,0,0,.36);text-align:center
        }
        .special-replay-export-card strong{display:block;font-size:20px}
        .special-replay-export-card span{display:block;margin-top:7px;color:#83aac3;font-size:11px;font-weight:850}
        .special-replay-export-track{height:6px;margin-top:15px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
        .special-replay-export-bar{height:100%;width:0;background:linear-gradient(90deg,#4aa6df,#8bd5ff);transition:width .12s linear}
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
      specialGamesLoadedOnce = true;
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

    function authorCollectionRecord() {
      return {
        slug:'liu-jun-hao-2026-nine-positions',
        player:'劉俊豪',
        team:'富邦悍將',
        season:'2026',
        title:'單季九守位・中職史上第一人',
        achieved:'2026/10/06',
        opponent:'樂天桃猿',
        venue:'桃園',
        positions:[
          {code:'P',name:'投手',date:'06/03'},
          {code:'C',name:'捕手',date:'10/06'},
          {code:'1B',name:'一壘',date:'08/18'},
          {code:'2B',name:'二壘',date:'04/14'},
          {code:'3B',name:'三壘',date:'04/19'},
          {code:'SS',name:'游擊',date:'04/14'},
          {code:'LF',name:'左外野',date:'06/19'},
          {code:'CF',name:'中外野',date:'08/16'},
          {code:'RF',name:'右外野',date:'04/06'}
        ],
        timeline:[
          {date:'04/06',title:'右外野',detail:'本季一軍首戰，代跑後接手右外野，九守位之旅從這裡開始。'},
          {date:'04/14',title:'游擊 → 二壘',detail:'先發游擊，之後移防二壘，同場解鎖兩個內野位置。'},
          {date:'04/19',title:'三壘',detail:'替補出賽後站上三壘，內野工具人版圖持續擴張。'},
          {date:'06/03',title:'投手',detail:'澄清湖對台鋼，八局下以野手身分登板消化局數。'},
          {date:'06/19',title:'左外野',detail:'替補守左外野，完成第二個外野位置。'},
          {date:'08/16',title:'中外野',detail:'先發鎮守中外野，外野三個位置全部到齊。'},
          {date:'08/18',title:'一壘',detail:'比賽後段移防一壘，單季累積八個守備位置。'},
          {date:'10/06',title:'捕手・九守位完成',detail:'五局下接替林岱安蹲捕，補上最後一塊拼圖，正式寫下中職史上首次單季九守位。'}
        ]
      };
    }

    function authorCollectionFeatureCardHtml() {
      const record=authorCollectionRecord();
      const chips=record.positions.map(item => '<span><b>'+escapeHtml(item.code)+'</b><small>'+escapeHtml(item.name)+'</small></span>').join('');
      return '<button class="author-collection-feature" type="button" data-author-collection="'+escapeHtml(record.slug)+'">'
        + '<div class="author-collection-feature-head"><span>作者收藏 · CPBL HISTORY</span><em>NEW</em></div>'
        + '<div class="author-collection-feature-body"><div><small>2026 · 富邦悍將</small><strong>劉俊豪</strong><h3>單季九守位<br>中職史上第一人</h3><p>從右外野開始，最後以捕手完成九個守備位置。這不是單場噱頭，而是一整季累積出的歷史紀錄。</p></div><div class="author-collection-nine"><b>9</b><span>POSITIONS</span><small>2026.10.06</small></div></div>'
        + '<div class="author-collection-position-strip">'+chips+'</div>'
        + '<div class="author-collection-feature-foot"><span>人物紀錄 · 2026/10/06</span><b>開啟紀念頁 →</b></div>'
        + '</button>';
    }

    function authorCollectionNewsItems() {
      return [
        {
          slug:'lin-che-hsuan-retirement-2026',
          tone:'retirement',
          tag:'RETIREMENT',
          date:'2026/04/06',
          category:'人物專題',
          person:'林哲瑄',
          eyebrow:'悍將遊俠・最後一舞',
          title:'蝦哥謝幕',
          headline:'林哲瑄的最後一舞，從「蝦池」走進回憶',
          deck:'最後一戰敲出生涯第 772 安，最後一次守備仍在最熟悉的中外野。11 年中職生涯，在新莊滿場掌聲中正式落幕。',
          cardMetric:'772',
          cardMetricLabel:'CAREER HITS',
          stats:[
            {value:'803',label:'中職出賽'},
            {value:'772',label:'生涯安打'},
            {value:'64',label:'全壘打'},
            {value:'109',label:'盜壘'}
          ],
          sections:[
            {
              kicker:'THE LAST GAME',
              title:'最後一個打席，留下最後一支安打',
              body:'2026 年 4 月 5 日對樂天桃猿，林哲瑄以第一棒、中外野手先發。首局首打席敲出中外野安打，成為中職生涯第 772 支安打，隨後跑回富邦全場第 1 分。二局上，他接殺宋嘉翔的中外野飛球，完成球員生涯最後一次正式守備，之後在 11,201 名球迷掌聲中退場。',
              accent:'772'
            },
            {
              kicker:'THE FAREWELL',
              title:'隔天再回中外野，完成真正的告別',
              body:'4 月 6 日，富邦在新莊主場為林哲瑄舉行引退儀式，現場 11,600 人滿場。他繞完四個壘包、收下球團與親友祝福，最後再次拿起手套站回中外野，由好友高國輝擊球，完成象徵性的最後一次守備。',
              accent:'11,600'
            },
            {
              kicker:'LEGACY',
              title:'「蝦池」不只是一個守備位置',
              body:'旅美時期曾在 2012 年登上大聯盟，2015 年返台投入中職選秀後加盟義大犀牛。2016 年幫助義大拿下總冠軍並獲台灣大賽 MVP；2016 至 2019 年完成外野手金手套四連霸。富邦接手球隊後，他也長期擔任隊長，成為悍將世代最具辨識度的中外野身影之一。',
              accent:'4×GG'
            }
          ],
          quote:'中外野那塊草皮，往後仍會讓人想起「蝦哥」。',
          timeline:[
            {year:'國小三年級',title:'崇學國小・棒球啟蒙',detail:'原本同時接觸田徑，因為速度與運動能力被少棒教練注意，加入崇學國小少棒隊。棒球也成為他一路走下去的起點。'},
            {year:'2000',title:'世界少棒冠軍',detail:'隨中華隊參加小馬聯盟世界少棒賽，在冠軍戰轟出滿貫全壘打，幫助台灣奪冠。'},
            {year:'國中',title:'金城國中・棒球與田徑雙棲',detail:'在父親林漢森的田徑訓練下持續強化速度、爆發力與協調性；棒球場上也曾兼任投手，奠定日後大範圍中外野守備的身體基礎。'},
            {year:'高中',title:'南英商工・轉向專職野手',detail:'進入南英商工後因手臂不適逐漸放棄投手身分，專心朝野手發展。青棒階段的速度、守備與打擊表現，讓他受到美職球探高度關注。'},
            {year:'2007',title:'18 歲簽約波士頓紅襪',detail:'6 月 8 日以國際自由球員身分與紅襪簽約，正式展開旅美生涯。'},
            {year:'2008',title:'未來之星賽 MVP・北京奧運',detail:'在舊洋基球場舉行的 MLB 未來之星賽開轟並獲選 MVP；同年也代表中華隊參加北京奧運，開始在更大的國際舞台被看見。'},
            {year:'2012',title:'登上大聯盟',detail:'4 月 14 日首次升上波士頓紅襪大聯盟，該季共出賽 9 場、敲出 3 支安打，成為台灣旅美野手的重要里程碑。'},
            {year:'2015',title:'返台加盟義大犀牛',detail:'中職選秀由義大犀牛第一輪選進，8 月 14 日完成中職初登場，開啟超過 10 年的台灣職棒生涯。'},
            {year:'2016',title:'台灣大賽 MVP',detail:'義大犀牛奪下年度總冠軍，林哲瑄在系列賽攻守兩端都扮演關鍵角色，最終獲選台灣大賽 MVP。'},
            {year:'2016–2019',title:'外野金手套四連霸',detail:'連續四年拿下外野手金手套，守備判斷、第一步與覆蓋範圍讓「蝦池」成為中職中外野的代表畫面。'},
            {year:'2022',title:'新竹撲接重傷',detail:'7 月 23 日在新竹棒球場撲接飛球造成左肩關節唇破裂並伴隨旋轉肌傷勢，之後接受手術與長期復健。這次受傷也成為他生涯後段的重要轉折。'},
            {year:'2025',title:'宣布球季後引退',detail:'在富邦悍將生涯進入尾聲後，正式宣布將卸下球員身分，準備把多年外野經驗轉往下一個角色。'},
            {year:'2026/04/05',title:'最後一舞',detail:'新莊對樂天以第一棒、中外野手先發，首打席敲出生涯第 772 支安打，二局再完成最後一次正式接殺後退場。'},
            {year:'2026/04/06',title:'正式引退',detail:'新莊引退儀式最後再次站回中外野，接下好友高國輝擊出的飛球，為從少棒一路走到大聯盟與中職的球員生涯正式收尾。'}
          ],
          source:'資料整理：CPBL、MLB、中央社、聯合報、TSNA；截至 2026/10/06。'
        },
        {
          slug:'lin-dai-an-fubon-impact-2026',
          tone:'transfer',
          tag:'TRANSFER REVIEW',
          date:'2026/10/06',
          category:'球季觀察',
          person:'林岱安',
          eyebrow:'FA 轉隊・第一年',
          title:'轉隊至今',
          headline:'林岱安來到富邦後，貢獻不只在打擊欄',
          deck:'第一年並不順遂：打擊陷入生涯少見低潮、出賽空間有限，但在捕手最難量化的區域，他仍留下幾場具代表性的內容。',
          cardMetric:'64',
          cardMetricLabel:'PA · 2026',
          stats:[
            {value:'64',label:'一軍打席'},
            {value:'.088',label:'打擊率'},
            {value:'.129',label:'上壘率'},
            {value:'.175',label:'長打率'}
          ],
          sections:[
            {
              kicker:'NEW HOME',
              title:'7 年合約之後，先面對的是適應',
              body:'林岱安在 2025 球季後行使自由球員權利，離開長年效力的統一獅，以最高總值 5,600 萬元、附帶教練約的 7 年合約加盟富邦。新環境、新投手群與新的捕手分工，使他的第一年沒有直接複製過去在統一的角色。開季一軍 8 場、11 打數無安打後，他在 4 月下旬被下放二軍調整，5 月底重新回到一軍。',
              accent:'7 YEARS'
            },
            {
              kicker:'GAME CALLING',
              title:'94 球完封，捕手價值最清楚的一晚',
              body:'7 月 23 日對統一，林岱安先發蹲捕搭配陳仕朋。陳仕朋僅用 94 球投完 9 局，沒有失分、沒有四死球，完成生涯首次百球內完封。對林岱安而言，這場比賽也是轉隊後最具代表性的捕手工作之一：面對老東家，從配球、節奏到投捕溝通，完整陪先發投手走完 27 個出局數。',
              accent:'94 PITCHES'
            },
            {
              kicker:'TURNING POINT',
              title:'9 月 16 日，終於用球棒直接改變比賽',
              body:'對味全龍一戰，林岱安單場 4 打數 2 安打，先敲二壘安打送回球隊第一分，七局再轟出轉隊富邦後首發全壘打；兩支長打、2 分打點，包含勝利打點，幫助富邦 6：0 中止 4 連敗，並獲選單場 MVP。那支全壘打也是他相隔 437 天再次開轟。',
              accent:'MVP'
            },
            {
              kicker:'NOW',
              title:'數字仍低，但第一年的價值正在重新定義',
              body:'截至 10 月 6 日，林岱安本季一軍 64 打席，打擊三圍為 .088／.129／.175，攻擊端明顯低於他過往水準；同時，他的出賽順位也受到戴培峰等捕手競爭影響。若只看打擊數字，這不是理想的轉隊首季；但 94 球完封的投捕搭配、9 月中止連敗的 MVP 戰，以及資深捕手在投手準備與比賽閱讀上的經驗，構成他目前最具體的貢獻。',
              accent:'.088'
            }
          ],
          quote:'第一年不是「立即兌現」，而是重新找到自己在新球隊的使用方式。',
          source:'資料整理：CPBL、中央社、自由體育；打擊數據截至 2026/10/06。'
        }
      ];
    }

    function authorCollectionNewsCardsHtml() {
      const items=authorCollectionNewsItems();
      return '<div class="author-collection-subhead author-news-subhead"><span>EDITORIAL</span><strong>人物新聞</strong></div>'
        + '<div class="author-news-grid">'
        + items.map(item => '<button class="author-news-card tone-'+escapeHtml(item.tone)+'" type="button" data-author-news="'+escapeHtml(item.slug)+'">'
          + '<div class="author-news-card-top"><span>'+escapeHtml(item.tag)+'</span><small>'+escapeHtml(item.date)+'</small></div>'
          + '<div class="author-news-card-main"><div><em>'+escapeHtml(item.eyebrow)+'</em><strong>'+escapeHtml(item.person)+'</strong><h3>'+escapeHtml(item.headline)+'</h3><p>'+escapeHtml(item.deck)+'</p></div>'
          + '<div class="author-news-card-metric"><b>'+escapeHtml(item.cardMetric)+'</b><span>'+escapeHtml(item.cardMetricLabel)+'</span></div></div>'
          + '<div class="author-news-card-foot"><span>'+escapeHtml(item.category)+'</span><b>閱讀專題 →</b></div>'
          + '</button>').join('')
        + '</div>';
    }

    function authorNewsTimelineHtml(item) {
      if(!Array.isArray(item.timeline) || !item.timeline.length) return '';
      return '<section class="author-news-life">'
        + '<div class="author-record-section-head"><span>LIFE TIMELINE</span><h3>從少棒到最後一舞</h3><p>一條從台南少棒、美國職棒最高殿堂，再回到新莊中外野的生涯軌跡。</p></div>'
        + '<div class="author-news-life-rail">'
        + item.timeline.map((step,index) => '<article class="author-news-life-item '+(index===item.timeline.length-1?'final':'')+'">'
          + '<div class="author-news-life-year">'+escapeHtml(step.year)+'</div>'
          + '<div class="author-news-life-dot"></div>'
          + '<div class="author-news-life-copy"><strong>'+escapeHtml(step.title)+'</strong><p>'+escapeHtml(step.detail)+'</p></div>'
          + '</article>').join('')
        + '</div>'
        + '</section>';
    }

    function openAuthorCollectionNews(slug) {
      const item=authorCollectionNewsItems().find(entry => entry.slug===String(slug||''));
      if(!item) return;
      const overlay=document.createElement('section');
      overlay.className='author-record-overlay author-news-overlay tone-'+item.tone;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-label',item.person+' '+item.headline);
      const stats=item.stats.map(stat => '<div class="author-news-stat"><strong>'+escapeHtml(stat.value)+'</strong><span>'+escapeHtml(stat.label)+'</span></div>').join('');
      const sections=item.sections.map((section,index) => '<section class="author-news-section">'
        + '<div class="author-news-section-index">'+String(index+1).padStart(2,'0')+'</div>'
        + '<div class="author-news-section-copy"><span>'+escapeHtml(section.kicker)+'</span><h2>'+escapeHtml(section.title)+'</h2><p>'+escapeHtml(section.body)+'</p></div>'
        + '<div class="author-news-section-accent">'+escapeHtml(section.accent)+'</div>'
        + '</section>').join('');
      overlay.innerHTML='<div class="author-record-shell author-news-shell">'
        + '<header class="author-record-topbar"><button type="button" data-author-news-close>← 返回作者收藏</button><span>DIAMONDSCOPE · EDITORIAL</span></header>'
        + '<main class="author-news-page">'
        + '<section class="author-news-hero">'
        + '<div class="author-news-hero-meta"><span>'+escapeHtml(item.tag)+'</span><b>'+escapeHtml(item.date)+'</b></div>'
        + '<div class="author-news-hero-grid"><div><small>'+escapeHtml(item.eyebrow)+'</small><h1>'+escapeHtml(item.person)+'</h1><h2>'+escapeHtml(item.headline)+'</h2><p>'+escapeHtml(item.deck)+'</p></div>'
        + '<div class="author-news-hero-number"><strong>'+escapeHtml(item.cardMetric)+'</strong><span>'+escapeHtml(item.cardMetricLabel)+'</span></div></div>'
        + '<div class="author-news-stats">'+stats+'</div>'
        + '</section>'
        + '<div class="author-news-story">'+sections+'</div>'
        + authorNewsTimelineHtml(item)
        + '<blockquote class="author-news-quote">'+escapeHtml(item.quote)+'</blockquote>'
        + '<footer class="author-record-source">'+escapeHtml(item.source)+'</footer>'
        + '</main></div>';
      document.body.appendChild(overlay);
      const oldOverflow=document.documentElement.style.overflow;
      document.documentElement.style.overflow='hidden';
      const close=()=>{document.documentElement.style.overflow=oldOverflow;document.removeEventListener('keydown',onKey);overlay.remove();};
      const onKey=event=>{if(event.key==='Escape') close();};
      overlay.querySelector('[data-author-news-close]')?.addEventListener('click',close);
      document.addEventListener('keydown',onKey);
      overlay.scrollTop=0;
    }

    function authorCollectionDiamondHtml(record) {
      const byCode = Object.fromEntries(
        (record.positions || []).map(item => [String(item.code || '').toUpperCase(), item])
      );

      const node = (code, cls) => {
        const item = byCode[code] || {};
        return '<div class="author-position-node '+cls+'">'
          + '<strong>劉俊豪</strong>'
          + '<span>'+escapeHtml(item.name || code)+'</span>'
          + '<small>首次：2026/'+escapeHtml(item.date || '—')+'</small>'
          + '</div>';
      };

      return '<div class="author-record-field" aria-label="劉俊豪九個守備位置">'
        + '<div class="author-field-grass"></div>'
        + '<div class="author-field-diamond"></div>'
        + node('CF','cf')
        + node('LF','lf')
        + node('RF','rf')
        + node('SS','ss')
        + node('2B','b2')
        + node('3B','b3')
        + node('1B','b1')
        + node('P','p')
        + node('C','c')
        + '<div class="author-field-center"><strong>9 / 9</strong><span>ALL POSITIONS</span></div>'
        + '</div>';
    }

    function authorCollectionTimelineHtml(record) {
      return record.timeline.map((item,index) => '<article class="author-record-timeline-item '+(index===record.timeline.length-1?'final':'')+'"><div class="author-record-timeline-date">2026/'+escapeHtml(item.date)+'</div><div class="author-record-timeline-copy"><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.detail)+'</p></div></article>').join('');
    }

    function openAuthorCollectionRecord(slug) {
      const record=authorCollectionRecord();
      if(String(slug||'')!==record.slug) return;
      const overlay=document.createElement('section');
      overlay.className='author-record-overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-label','劉俊豪單季九守位紀念頁');
      const positionCards=record.positions.map(item => '<div class="author-record-position-card"><span>'+escapeHtml(item.code)+'</span><strong>'+escapeHtml(item.name)+'</strong><small>首次：2026/'+escapeHtml(item.date)+'</small></div>').join('');
      overlay.innerHTML='<div class="author-record-shell">'
        + '<header class="author-record-topbar"><button type="button" data-author-record-close>← 返回作者收藏</button><span>DIAMONDSCOPE · AUTHOR ARCHIVE</span></header>'
        + '<main class="author-record-page">'
        + '<section class="author-record-hero"><div class="author-record-hero-copy"><span class="author-record-kicker">CPBL HISTORY · 2026</span><h1><span>劉俊豪</span><b>9</b></h1><h2>單季九個守備位置<br>中職史上第一人</h2><p>2026 年 10 月 6 日，富邦悍將對樂天桃猿。五局下，劉俊豪接替林岱安蹲捕，完成本季第九個守備位置，也完成中華職棒從未有人達成的單季全守位紀錄。</p><div class="author-record-badges"><span><b>9</b> 守備位置</span><span><b>1st</b> 聯盟史上首位</span><span><b>10/06</b> 紀錄完成</span></div></div><div class="author-record-hero-mark"><small>ULTIMATE UTILITY</small><strong>9</strong><span>POSITION<br>PLAYER</span></div></section>'
        + '<section class="author-record-section"><div class="author-record-section-head"><span>THE FIELD</span><h3>一個球季，站遍整座球場</h3><p>投手、捕手、四個內野位置與三個外野位置，全數留下正式出賽紀錄。</p></div>'+authorCollectionDiamondHtml(record)+'</section>'
        + '<section class="author-record-section"><div class="author-record-section-head"><span>9 POSITIONS</span><h3>九個位置全部解鎖</h3></div><div class="author-record-position-grid">'+positionCards+'</div></section>'
        + '<section class="author-record-section author-record-story"><div class="author-record-section-head"><span>ROAD TO NINE</span><h3>九守位完成時間線</h3></div><div class="author-record-timeline">'+authorCollectionTimelineHtml(record)+'</div></section>'
        + '<section class="author-record-final"><span>2026.10.06 · 桃園</span><strong>最後一塊拼圖：捕手</strong><p>五局下兩出局時上場蹲捕，生涯首度以捕手身分出賽。完成一個出局數後，六局持續蹲捕，之後再移防二壘。從 4 月的右外野到 10 月的本壘後方，九個守位在同一個球季全部集滿。</p><div><b>中職原有單季最多：8 守位</b><b>劉俊豪：9 守位</b></div></section>'
        + '<footer class="author-record-source">紀錄依 2026 球季公開賽事資訊整理 · 作者收藏</footer>'
        + '</main></div>';
      document.body.appendChild(overlay);
      const oldOverflow=document.documentElement.style.overflow;
      document.documentElement.style.overflow='hidden';
      const close=()=>{document.documentElement.style.overflow=oldOverflow;document.removeEventListener('keydown',onKey);overlay.remove();};
      const onKey=event=>{if(event.key==='Escape') close();};
      overlay.querySelector('[data-author-record-close]')?.addEventListener('click',close);
      document.addEventListener('keydown',onKey);
      overlay.scrollTop=0;
    }

    function renderSpecialGamesExplorer() {
      if (!els.homeSpecialGamesExplorer || homeRootSection !== 'special') return;
      ensureSpecialReplayStyles();
      const recordCard=authorCollectionFeatureCardHtml();
      const newsCards=authorCollectionNewsCardsHtml();
      const replayCards=Array.isArray(homeSpecialGames) && homeSpecialGames.length
        ? '<div class="author-collection-subhead"><span>GAME ARCHIVE</span><strong>比賽收藏</strong></div>' + homeSpecialGames.map(game => '<button class="special-game-card" type="button" data-special-replay-slug="' + escapeHtml(game.slug || '') + '"><div class="special-game-card-top"><strong>' + escapeHtml(game.title || '特殊比賽') + '</strong><span>' + escapeHtml(game.status || '') + '</span></div><div class="special-game-matchup">' + escapeHtml(game.away_team || '') + '<b>VS</b>' + escapeHtml(game.home_team || '') + '</div><div class="special-game-meta">' + escapeHtml([game.game_date, game.game_time, game.venue].filter(Boolean).join('｜')) + '</div><div class="special-game-card-foot"><span>' + escapeHtml(game.league || 'SPECIAL') + '</span><span>▶ 橫向重播</span></div></button>').join('')
        : '';
      els.homeSpecialGamesExplorer.innerHTML =
        '<div class="author-collection-scroll-head"><div><span>AUTHOR ARCHIVE</span><strong>作者收藏</strong></div><small>左右滑動瀏覽 →</small></div>'
        + '<div class="author-collection-rail" data-author-collection-rail>'
        + recordCard + newsCards + replayCards
        + '</div>';
      els.homeSpecialGamesExplorer.querySelector('[data-author-collection]')?.addEventListener('click',event => openAuthorCollectionRecord(event.currentTarget.dataset.authorCollection));
      els.homeSpecialGamesExplorer.querySelectorAll('[data-author-news]').forEach(button => button.addEventListener('click',() => openAuthorCollectionNews(button.dataset.authorNews)));
      els.homeSpecialGamesExplorer.querySelectorAll('[data-special-replay-slug]').forEach(button => button.addEventListener('click', () => {
        const game = homeSpecialGames.find(item => String(item && item.slug || '') === String(button.dataset.specialReplaySlug || ''));
        if (game) void openSpecialGameReplay(game);
      }));
      if (!specialGamesLoadedOnce) {
        void loadSpecialGames().then(() => { if (homeRootSection === 'special') renderSpecialGamesExplorer(); });
      }
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

    function specialReplayEventSemantic(event, previousEvent) {
      const text = String((event && event.r) || '');
      const previousScores = previousEvent && Array.isArray(previousEvent.s) ? previousEvent.s : [0,0];
      const scores = event && Array.isArray(event.s) ? event.s : previousScores;
      const scored = (Number(scores[0]) || 0) > (Number(previousScores[0]) || 0)
        || (Number(scores[1]) || 0) > (Number(previousScores[1]) || 0);

      let type = 'normal';
      if (/全壘打|home run|homer/i.test(text)) type = 'hr';
      else if (/犧牲|sacrifice|犧牲觸擊|犧牲飛球/i.test(text)) type = 'sac';
      else if (/四壞|保送|故意四壞|觸身球|walk|hit by pitch/i.test(text)) type = 'walk';
      else if (/一壘安打|二壘安打|三壘安打|內野安打|安打|single|double|triple/i.test(text)) type = 'hit';

      const onBase = type === 'hr' || type === 'walk' || type === 'hit'
        || /失誤.*上壘|野手選擇|上壘/i.test(text);

      return { type, scored, onBase };
    }

    function specialReplayTone(event, previousEvent) {
      const semantic = specialReplayEventSemantic(event, previousEvent);
      if (semantic.type === 'hr') return 'event-hr';
      if (semantic.type === 'hit') return 'event-hit';
      if (semantic.type === 'walk') return 'event-walk';
      if (semantic.type === 'sac') return 'event-sac';
      const text = String((event && event.r) || '') + ' ' + String((event && event.k) || '');
      if (/三振|strikeout/i.test(text)) return 'tone-k';
      if (/換投|代打|代跑|換人|pitch|sub/i.test(text)) return 'tone-change';
      if (/half|結束/.test(text)) return 'tone-half';
      return '';
    }

    function specialReplayVisualClasses(state,event) {
      const previous = state.index > 0 ? state.events[state.index - 1] : null;
      const semantic = specialReplayEventSemantic(event, previous);
      const classes = [];
      const tone = specialReplayTone(event, previous);
      if (tone) classes.push(tone);
      if (semantic.scored) classes.push('event-scored');
      return classes.join(' ');
    }

    function specialReplayDurationMs(state,index) {
      const event = state.events[index] || {};
      const previous = index > 0 ? state.events[index - 1] : null;
      const semantic = specialReplayEventSemantic(event, previous);
      const kind = String(event.k || '');
      if (kind === 'half') return 5000;
      if (semantic.type === 'hr') return 4000;
      if (semantic.scored) return 3000;
      if (semantic.onBase) return 2200;
      return 1000;
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
      const visualClasses = specialReplayVisualClasses(state,event);
      const eventKind = specialReplayKindLabel(event.k);
      const inningIndex = Math.max(0, (Number(event.i) || 1) - 1);
      const awayInningRuns = Array.isArray(lineScore.away) && lineScore.away[inningIndex] != null ? lineScore.away[inningIndex] : 0;
      const homeInningRuns = Array.isArray(lineScore.home) && lineScore.home[inningIndex] != null ? lineScore.home[inningIndex] : 0;
      const battingTeam = String(event.h || 'T') === 'T' ? detail.away_team : detail.home_team;

      return '<div class="special-replay-main">'
        + '<section class="special-replay-focus ' + visualClasses + '">'
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

    function specialReplayCanvasRoundRect(ctx,x,y,w,h,r,fill,stroke) {
      const radius = Math.max(0,Math.min(r,Math.min(w,h)/2));
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,radius);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    function specialReplayCanvasText(ctx,text,x,y,maxWidth,size,weight,color,align='left') {
      ctx.save();
      ctx.font = weight + ' ' + size + 'px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      let value = String(text == null ? '' : text);
      if (maxWidth > 0 && ctx.measureText(value).width > maxWidth) {
        while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0,-1);
        value += '…';
      }
      ctx.fillText(value,x,y,maxWidth > 0 ? maxWidth : undefined);
      ctx.restore();
    }

    function specialReplayCanvasBaseState(ctx,mask,x,y,size) {
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(Math.PI/4);
      const s=size;
      const b=Math.max(0,Number(mask)||0);
      const draw=(dx,dy,on)=>{
        ctx.fillStyle=on?'#ffd15e':'#0a2539';
        ctx.strokeStyle=on?'#ffd15e':'#6e91a8';
        ctx.lineWidth=2;
        ctx.fillRect(dx,dy,s*.23,s*.23);
        ctx.strokeRect(dx,dy,s*.23,s*.23);
      };
      draw(-s*.5,-s*.5,Boolean(b&2));
      draw(s*.27,-s*.5,Boolean(b&1));
      draw(-s*.5,s*.27,Boolean(b&4));
      ctx.fillStyle='#edf8ff';
      ctx.fillRect(s*.27,s*.27,s*.20,s*.20);
      ctx.restore();
    }

    function specialReplayCanvasEventColors(state,event,index) {
      const previous=index>0?state.events[index-1]:null;
      const semantic=specialReplayEventSemantic(event,previous);
      let color='#f3f8fb';
      if (semantic.type==='hit') color='#ff7070';
      if (semantic.type==='walk') color='#62db91';
      if (semantic.type==='sac') color='#6ea7ff';
      if (semantic.type==='hr') color='#bd83ff';
      return { color, scored:semantic.scored };
    }

    function specialReplayRenderMp4Frame(ctx,state,index,width,height) {
      const event=state.events[index]||{};
      const detail=state.detail;
      const scores=Array.isArray(event.s)?event.s:[0,0];
      const pitcher=specialReplayCurrentPitcher({...state,index},event);
      const subject=event.n||specialReplayInningLabel(event);
      const result=event.r||'—';
      const outs=Math.max(0,Math.min(3,Number(event.o)||0));
      const baseMask=Number(event.b)||0;
      const baseText=baseMask===0?'壘上無人':[baseMask&1?'一壘':'',baseMask&2?'二壘':'',baseMask&4?'三壘':''].filter(Boolean).join('、')+'有人';
      const colors=specialReplayCanvasEventColors(state,event,index);
      const scale=width/1280;

      ctx.clearRect(0,0,width,height);
      const g=ctx.createLinearGradient(0,0,0,height);
      g.addColorStop(0,'#081c2c'); g.addColorStop(1,'#030a11');
      ctx.fillStyle=g; ctx.fillRect(0,0,width,height);

      // score header
      specialReplayCanvasRoundRect(ctx,24*scale,22*scale,1232*scale,112*scale,18*scale,'#0a2639','rgba(135,200,240,.18)');
      specialReplayCanvasText(ctx,detail.away_team||'中華台北',315*scale,78*scale,220*scale,27*scale,'800','#eaf7ff','right');
      specialReplayCanvasText(ctx,String(Number(scores[0])||0),390*scale,78*scale,70*scale,60*scale,'900','#ffffff','center');
      specialReplayCanvasRoundRect(ctx,520*scale,51*scale,240*scale,54*scale,27*scale,'#0d3149',null);
      specialReplayCanvasText(ctx,specialReplayInningLabel(event),640*scale,78*scale,210*scale,20*scale,'900','#9bd0ef','center');
      specialReplayCanvasText(ctx,String(Number(scores[1])||0),890*scale,78*scale,70*scale,60*scale,'900','#ffffff','center');
      specialReplayCanvasText(ctx,detail.home_team||'韓國',965*scale,78*scale,220*scale,27*scale,'800','#eaf7ff','left');

      // main card
      const mainX=24*scale, mainY=154*scale, mainW=790*scale, mainH=514*scale;
      ctx.lineWidth=colors.scored?4*scale:1.5*scale;
      specialReplayCanvasRoundRect(ctx,mainX,mainY,mainW,mainH,20*scale,'#081b29',colors.scored?'#e8bd58':'rgba(135,200,240,.15)');
      specialReplayCanvasText(ctx,'PLAY BY PLAY',52*scale,184*scale,220*scale,14*scale,'900','#75afd3');
      specialReplayCanvasText(ctx,'PITCHER',55*scale,233*scale,150*scale,13*scale,'800','#5f8aa5');
      specialReplayCanvasText(ctx,pitcher||'-',55*scale,270*scale,280*scale,31*scale,'900','#eef9ff');
      specialReplayCanvasText(ctx,'VS',407*scale,263*scale,70*scale,18*scale,'900','#6c9ab8','center');
      specialReplayCanvasText(ctx,String(event.k)==='pa'?'BATTER':'EVENT',760*scale,233*scale,150*scale,13*scale,'800','#5f8aa5','right');
      specialReplayCanvasText(ctx,subject,760*scale,270*scale,280*scale,31*scale,'900','#eef9ff','right');

      ctx.strokeStyle='rgba(135,200,240,.10)'; ctx.lineWidth=1*scale;
      ctx.beginPath(); ctx.moveTo(55*scale,307*scale); ctx.lineTo(782*scale,307*scale); ctx.stroke();

      specialReplayCanvasText(ctx,specialReplayKindLabel(event.k),55*scale,348*scale,300*scale,16*scale,'900',colors.scored?'#efc968':colors.color);
      const resultSize = result.length>18 ? 38 : result.length>10 ? 46 : 56;
      specialReplayCanvasText(ctx,result,55*scale,421*scale,705*scale,resultSize*scale,'900',colors.color);
      specialReplayCanvasText(ctx,(detail.away_team||'')+' '+(Number(scores[0])||0)+' : '+(Number(scores[1])||0)+' '+(detail.home_team||''),55*scale,486*scale,700*scale,20*scale,'800','#8dacbf');

      // chips
      const chips=[baseText,outs+' 出局',specialReplayKindLabel(event.k)];
      let chipX=55*scale;
      for(const chip of chips){
        const chipW=Math.max(105,chip.length*22+32)*scale;
        specialReplayCanvasRoundRect(ctx,chipX,535*scale,chipW,42*scale,21*scale,'#0d3149',null);
        specialReplayCanvasText(ctx,chip,chipX+chipW/2,556*scale,chipW-18*scale,15*scale,'900','#9fc9e1','center');
        chipX+=chipW+10*scale;
      }

      // side card
      const sideX=836*scale, sideY=154*scale, sideW=420*scale, sideH=514*scale;
      specialReplayCanvasRoundRect(ctx,sideX,sideY,sideW,sideH,20*scale,'#071a28','rgba(135,200,240,.15)');
      specialReplayCanvasText(ctx,'GAME STATE',866*scale,188*scale,200*scale,14*scale,'900','#75afd3');
      specialReplayCanvasBaseState(ctx,baseMask,925*scale,288*scale,94*scale);
      specialReplayCanvasText(ctx,baseText,1020*scale,250*scale,195*scale,22*scale,'900','#eef9ff');
      specialReplayCanvasText(ctx,outs+' 出局',1020*scale,288*scale,195*scale,18*scale,'800','#ff7b7b');

      ctx.strokeStyle='rgba(135,200,240,.10)'; ctx.beginPath(); ctx.moveTo(866*scale,350*scale); ctx.lineTo(1226*scale,350*scale); ctx.stroke();
      specialReplayCanvasText(ctx,'投手',866*scale,390*scale,90*scale,14*scale,'800','#5d869f');
      specialReplayCanvasText(ctx,pitcher||'-',1226*scale,390*scale,250*scale,20*scale,'900','#eef9ff','right');
      specialReplayCanvasText(ctx,'打者 / 事件',866*scale,438*scale,120*scale,14*scale,'800','#5d869f');
      specialReplayCanvasText(ctx,subject,1226*scale,438*scale,250*scale,20*scale,'900','#eef9ff','right');
      specialReplayCanvasText(ctx,'事件 '+(index+1)+' / '+state.events.length,866*scale,488*scale,180*scale,14*scale,'800','#5d869f');
      specialReplayCanvasText(ctx,specialReplayInningLabel(event),1226*scale,488*scale,180*scale,20*scale,'900','#9bd0ef','right');

      // footer
      const duration=specialReplayDurationMs(state,index)/1000;
      specialReplayCanvasText(ctx,'DiamondScope Replay',28*scale,699*scale,260*scale,14*scale,'800','#587c93');
      specialReplayCanvasText(ctx,duration.toFixed(1)+' 秒',1250*scale,699*scale,120*scale,14*scale,'800','#587c93','right');
    }

    async function specialReplayDownloadMp4() {
      const state=specialReplayActive;
      if(!state||!state.detail||!state.events.length)return;
      if(state.exporting)return;

      if(typeof VideoEncoder==='undefined'){
        alert('這台裝置目前不支援本機 MP4 編碼（WebCodecs）。請改用最新版 Chrome / Edge / Safari 後再試。');
        return;
      }

      state.exporting=true;
      const wasPlaying=state.playing;
      if(wasPlaying) toggleSpecialReplayPlayback();

      const overlay=document.createElement('div');
      overlay.className='special-replay-exporting';
      overlay.innerHTML='<div class="special-replay-export-card"><strong>正在產生 MP4</strong><span data-special-export-text>準備編碼…</span><div class="special-replay-export-track"><div class="special-replay-export-bar" data-special-export-bar></div></div></div>';
      state.overlay.appendChild(overlay);

      try{
        const mb=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/+esm');
        const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,Quality}=mb;

        const width=1280,height=720;
        const canvas=document.createElement('canvas');
        canvas.width=width; canvas.height=height;
        const ctx=canvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('Canvas unavailable');

        const target=new BufferTarget();
        const output=new Output({format:new Mp4OutputFormat(),target});
        const source=new CanvasSource(canvas,{
          codec:'avc',
          quality:new Quality({bitrate:900000})
        });
        output.addVideoTrack(source,{frameRate:30});
        await output.start();

        let timestamp=0;
        for(let i=0;i<state.events.length;i+=1){
          const duration=specialReplayDurationMs(state,i)/1000;
          specialReplayRenderMp4Frame(ctx,state,i,width,height);
          await source.add(timestamp,duration);
          timestamp+=duration;

          if(i%3===0||i===state.events.length-1){
            const pct=Math.round(((i+1)/state.events.length)*100);
            const bar=overlay.querySelector('[data-special-export-bar]');
            const label=overlay.querySelector('[data-special-export-text]');
            if(bar)bar.style.width=pct+'%';
            if(label)label.textContent='編碼 '+pct+'% · '+(i+1)+' / '+state.events.length;
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }

        await output.finalize();
        const bytes=target.buffer;
        if(!bytes||!bytes.byteLength)throw new Error('MP4 output is empty');

        const blob=new Blob([bytes],{type:'video/mp4'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        const safe=value=>String(value||'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_');
        a.href=url;
        a.download=[safe(state.detail.game_date),safe(state.detail.away_team),safe(state.detail.home_team),'replay'].filter(Boolean).join('_')+'.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),3000);
      }catch(error){
        console.error('MP4 export failed',error);
        alert('MP4 產生失敗：'+(error&&error.message?error.message:'此裝置暫不支援'));
      }finally{
        state.exporting=false;
        overlay.remove();
        if(wasPlaying&&!document.hidden&&specialReplayActive===state){
          state.playing=true;
          state.remainingMs=specialReplayDurationMs(state,state.index);
          renderSpecialReplayFrame();
          scheduleSpecialReplayAdvance();
        }
      }
    }

    function specialReplayFooterHtml(state,event) {
      const progress = Math.max(0, Math.min(100, ((state.index + 1) / state.events.length) * 100));
      const lastEvent = state.index >= state.events.length - 1;
      const eventKind = specialReplayKindLabel(event.k);
      const duration = specialReplayDurationMs(state,state.index);
      return '<div class="special-replay-footer"><div class="special-replay-progress"><div class="special-replay-progress-top"><span>' + escapeHtml(eventKind) + ' · ' + (duration/1000).toFixed(1) + ' 秒</span><span>' + (state.index + 1) + ' / ' + state.events.length + '</span></div><div class="special-replay-progress-track"><div class="special-replay-progress-bar" style="width:' + progress.toFixed(2) + '%"></div></div></div><div class="special-replay-controls"><button class="special-replay-control special-replay-download" type="button" data-special-replay-download>下載 MP4</button><button class="special-replay-control" type="button" data-special-replay-prev>‹</button><button class="special-replay-control primary" type="button" data-special-replay-toggle>' + (state.playing ? '暫停' : (lastEvent ? '重播' : '播放')) + '</button><button class="special-replay-control" type="button" data-special-replay-next>›</button></div></div>';
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
        specialReplayActive.remainingMs = specialReplayDurationMs(specialReplayActive,0);
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

      state.overlay.className = 'special-replay-overlay';

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
      state.overlay.querySelector('[data-special-replay-download]').addEventListener('click', specialReplayDownloadMp4);
      state.overlay.querySelector('[data-special-replay-prev]').addEventListener('click', () => seekSpecialReplay(-1));
      state.overlay.querySelector('[data-special-replay-next]').addEventListener('click', () => seekSpecialReplay(1));
    }

    function scheduleSpecialReplayAdvance() {
      const state = specialReplayActive;
      if (!state || !state.playing || !state.events.length) return;
      clearTimeout(state.timer);
      state.remainingMs = Math.max(100, Number(state.remainingMs) || specialReplayDurationMs(state,state.index));
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
        current.remainingMs = specialReplayDurationMs(current,current.index);
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
        state.remainingMs = specialReplayDurationMs(state,0);
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
      state.remainingMs = specialReplayDurationMs(state,state.index);
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
