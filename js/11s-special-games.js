    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v2:';
    const specialReplayMemory = new Map();
    let specialReplayActive = null;
    let specialGamesLoadedOnce = false;
    let authorCollectionSection = '';

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
          collectionSection:'people-records',
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
          timelineTitle:'從少棒到最後一舞',
          timelineIntro:'一條從台南少棒、美國職棒最高殿堂，再回到新莊中外野的生涯軌跡。',
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
          internationalTitle:'三大國際賽事・全部開轟',
          internationalBadge:'3 / 3',
          internationalIntro:'奧運、世界棒球經典賽、世界12強，是台灣成棒最具代表性的三項一級國際賽。林哲瑄不只全部參加過，還在三個舞台都留下全壘打；截至 2026 年，他仍是台灣唯一完成這項紀錄的球員。',
          international:[
            {year:'2008',event:'北京奧運',opponent:'加拿大',score:'中華 6：5 加拿大',inning:'2局上',homer:'2分全壘打',detail:'19 歲、旅美第二年的林哲瑄已是中華隊主戰中外野手。面對加拿大，他在二局上轟出兩分砲，幫助中華隊單局攻下 4 分，最終延長 12 局以 6：5 勝出。這支全壘打成為「三大賽開轟」的第一塊拼圖。'},
            {year:'2017',event:'世界棒球經典賽',opponent:'南韓',score:'中華 8：11 南韓',inning:'4局下',homer:'2分全壘打',detail:'首爾台韓戰，中華隊一度落後 0：6。四局下林哲瑄轟出兩分砲，把比分追近到 5：8；球隊後來一路追成 8：8，最終才在延長賽落敗。這一轟是那場經典逆襲的重要節點。'},
            {year:'2019',event:'世界12強',opponent:'澳洲',score:'中華 5：1 澳洲',inning:'8局下',homer:'3分全壘打',detail:'東京巨蛋最後一戰，前七局仍是 1：1。八局王威晨先敲超前安打，林哲瑄隨後補上一發三分砲，把比賽直接拉開成 5：1，也替中華隊的 2019 12強之旅畫下最有力的句點。'}
          ],
          honorsTitle:'生涯榮譽牆',
          honorsIntro:'把一整段職業生涯濃縮成幾個最能代表林哲瑄的里程碑。',
          honors:[
            {value:'2008',title:'MLB 未來之星賽 MVP',detail:'在舊洋基球場開轟，成為少數在全球頂尖新秀舞台拿下 MVP 的台灣野手。'},
            {value:'2012',title:'登上美國大聯盟',detail:'波士頓紅襪 9 場出賽、12 打數 3 安，完成台灣野手的重要旅美里程碑。'},
            {value:'2016',title:'台灣大賽 MVP',detail:'義大犀牛最後一季奪下總冠軍，他在系列賽攻守兩端都留下代表性表現。'},
            {value:'4×',title:'外野金手套四連霸',detail:'2016–2019 連續四季拿下外野手金手套，「蝦池」成為中職中外野守備的代名詞。'},
            {value:'3/3',title:'三大一級國際賽皆開轟',detail:'2008 奧運、2017 經典賽、2019 世界12強全部敲出全壘打；截至 2026 年為台灣唯一。'},
            {value:'772',title:'中職生涯安打',detail:'2026 年最後一戰首打席敲出生涯第 772 安，讓球員生涯以一支安打作結。'}
          ],
          usPeriod:'USA BASEBALL · 2007–2014',
          usCareerTitle:'旅美職棒逐年檔案',
          usCareerIntro:'2007 年以 18 歲之姿投入紅襪體系，從新人聯盟一路爬到 3A，2012 年登上大聯盟；離開紅襪後又在太空人 3A延續外野生涯，2014 年於遊騎兵體系改練投手。這段 8 年旅美路，是「蝦哥」守備、速度與職業球感真正成形的地方。',
          usCareerSummary:[
            {value:'690',label:'MiLB 安打'},
            {value:'164',label:'MiLB 盜壘'},
            {value:'.688',label:'MiLB OPS'},
            {value:'9',label:'MLB 出賽'}
          ],
          usCareer:[
            {year:'2007',level:'Rk / A-',team:'GCL Red Sox → Lowell Spinners',line:'54 G｜218 AB｜53 H｜4 HR｜25 RBI｜17 SB｜.243/.317/.408｜OPS .726',label:'18 歲的第一個職業球季',story:'6 月與波士頓紅襪簽約後直接赴美。先在新人聯盟站穩腳步，再升到短期 1A Lowell。第一年最醒目的不是長打，而是速度、臂力與外野防守；紅襪系統很早就把他視為高階守備型中外野手。'},
            {year:'2008',level:'A',team:'Greenville Drive',line:'91 G｜362 AB｜90 H｜5 HR｜37 RBI｜33 SB｜.249/.342/.359｜OPS .701',label:'未來之星賽 MVP',story:'第一個完整球季就跑出 33 次盜壘，並在洋基球場舉行的未來之星賽敲出兩分砲、獲選 MVP。這一年確立他「速度＋中外野防守」的招牌，也被評為紅襪農場頂尖防守外野手。'},
            {year:'2009',level:'A+',team:'Salem Red Sox',line:'131 G｜479 AB｜127 H｜7 HR｜54 RBI｜26 SB｜.265/.355/.365｜OPS .720',label:'進階 1A 全季主力',story:'出賽 131 場，安打、保送與盜壘都維持穩定產量，並入選 Carolina League 季後明星隊。除了 26 盜，他在外野助殺與防守覆蓋範圍上的評價也持續上升。'},
            {year:'2010',level:'AA',team:'Portland Sea Dogs',line:'119 G｜458 AB｜126 H｜2 HR｜34 RBI｜26 SB｜.275/.386/.343｜OPS .728',label:'AA 的上壘與守備巔峰',story:'上壘率 .386、72 次保送、26 盜，攻擊端靠選球與速度製造價值；守備端則獲紅襪小聯盟年度最佳防守球員。這一年他已經不是單純「工具很多」，而是距離大聯盟只剩最後一段路。'},
            {year:'2011',level:'AA → AAA',team:'Portland → Pawtucket',line:'119 G｜466 AB｜114 H｜2 HR｜36 RBI｜28 SB｜.245/.340/.305｜OPS .644',label:'第一次升上 3A',story:'先在 AA 出賽 34 場，5 月升上 Pawtucket 3A 後再打 85 場；全年 28 盜。球季結束後被紅襪放進 40 人名單，正式站到大聯盟門口。'},
            {year:'2012',level:'AAA + MLB',team:'Pawtucket / Boston Red Sox',line:'AAA：113 G｜98 H｜2 HR｜30 RBI｜15 SB｜.247/.323/.316｜OPS .638　／　MLB：9 G｜12 AB｜3 H｜.250/.250/.250｜OPS .500',label:'大聯盟的一年',story:'大部分時間仍在 3A，但全年四度被紅襪叫上大聯盟。4 月 14 日完成 MLB 初登場，全年 9 場、12 打數 3 安打；也是首位在紅襪出賽的台灣出生球員。10 月 1 日對洋基單場 3 打數 2 安，成為他的大聯盟最後一戰。'},
            {year:'2013',level:'AAA',team:'Oklahoma City RedHawks｜Astros',line:'122 G｜350 AB｜82 H｜3 HR｜42 RBI｜19 SB｜.234/.356/.309｜OPS .665　／　投球：2 G｜1.2 IP｜0.00 ERA｜1 K',label:'太空人 3A・也開始登板',story:'被太空人接手後整季留在 3A。打擊率不高，但 60 次保送讓上壘率仍有 .356，另有 19 次盜壘；同季還以野手身分兩度登板，1.2 局沒有失分，替下一年的角色轉換埋下伏筆。'},
            {year:'2014',level:'Rookie｜P',team:'AZL Rangers｜Texas',line:'14 G｜12.1 IP｜1–1｜2 SV｜5.84 ERA｜14 K｜3 BB｜WHIP 1.22',label:'從中外野手改練投手',story:'遊騎兵將他正式改造成投手。新人聯盟出賽 14 場全部後援，12.1 局送出 14 次三振並拿下 2 次救援。年底遭釋出，8 年美國職棒旅程在一個完全不同的位置告一段落。'}
          ],
          usCareerTotals:{
            milb:'MiLB 打擊：2729 AB｜690 H｜25 HR｜258 RBI｜164 SB｜AVG .253｜OBP .349｜OPS .688',
            mlb:'MLB 打擊：9 G｜12 AB｜3 H｜1 R｜AVG .250｜OBP .250｜SLG .250｜OPS .500',
            pitching:'MiLB 投球：16 G｜14.0 IP｜1–1｜2 SV｜5.14 ERA｜15 K｜WHIP 1.07'
          },
          yearbookTitle:'中職逐年球季檔案',
          yearbookIntro:'如果把林哲瑄的中職生涯拆成年份來看，可以清楚看到一條從巔峰攻守、金手套連霸，到傷勢、角色轉換與最後一舞的曲線。以下不是只有數字，而是每一季他在球隊裡的樣子。',
          yearbook:[
            {year:'2015',team:'義大犀牛',line:'20 G｜.244/.359/.372｜19 H｜1 HR｜8 RBI',label:'回台元年',story:'季中返台、第一輪加入義大，只有 20 場例行賽，但中外野的速度與守備範圍立即讓聯盟感受到不同層級的壓迫感。這一年更像適應期，也是下一季全面爆發的前奏。'},
            {year:'2016',team:'義大犀牛',line:'107 G｜.345/.434/.570｜22 HR｜79 RBI｜12 SB｜OPS 1.004',label:'生涯代表作',story:'打擊、長打、選球與速度同時拉到最高檔。22 轟、79 打點，拿下最佳十人與外野金手套；季後賽更帶著義大完成最後一座總冠軍，並獲台灣大賽 MVP。這是「攻守一體林哲瑄」最完整的一季。'},
            {year:'2017',team:'富邦悍將',line:'91 G｜.296/.375/.405｜104 H｜43 RBI｜9 SB',label:'悍將元年',story:'球隊更名富邦後，他成為新世代悍將的核心人物。長打下降，但上壘與中外野防區仍具高價值，完成金手套二連霸，也開始形成日後球迷熟悉的「蝦池」形象。'},
            {year:'2018',team:'富邦悍將',line:'106 G｜.278/.345/.425｜10 HR｜59 RBI｜18 SB',label:'速度與守備',story:'打線中不再只是強攻型角色，18 次盜壘讓速度重新成為武器；守備穩定度持續維持高檔，外野金手套三連霸。'},
            {year:'2019',team:'富邦悍將',line:'112 G｜.314/.366/.469｜130 H｜9 HR｜15 SB',label:'攻守再登峰',story:'單季 130 安、打擊率超過三成，外野守備 112 場零失誤，完成金手套四連霸。這一年是他在富邦時期最平衡、最成熟的球季之一。'},
            {year:'2020',team:'富邦悍將',line:'73 G｜.291/.392/.455｜9 HR｜32 RBI｜14 SB',label:'高上壘率的一年',story:'出賽數下降，但攻擊效率沒有跟著掉。上壘率接近四成、仍有 9 轟與 14 盜，顯示即使球季不完整，他依舊能透過選球、跑壘與守備維持影響力。'},
            {year:'2021',team:'富邦悍將',line:'84 G｜.238/.334/.331｜69 H｜5 HR｜13 SB',label:'打擊震盪',story:'打擊率進入低潮，但仍靠保送與速度維持一定上壘能力。此時的價值開始從「主砲級中外野手」逐漸轉向守備、跑壘與資深球員角色。'},
            {year:'2022',team:'富邦悍將',line:'38 G｜.244/.321/.319｜29 H｜5 SB',label:'傷勢轉折',story:'7 月新竹球場撲接造成左肩關節唇破裂與旋轉肌傷勢，球季幾乎被迫中止。這不只影響當年，也改變了生涯後段的身體狀態與出賽節奏。'},
            {year:'2023',team:'富邦悍將',line:'105 G｜.240/.313/.311｜80 H｜18 SB',label:'回到球場',story:'重傷後重新站回一軍，而且出賽超過百場。打擊火力不若巔峰，但 18 次盜壘證明速度仍在；對球隊而言，能回到中外野本身就是一次完整復出。'},
            {year:'2024',team:'富邦悍將',line:'55 G｜.192/.304/.219｜28 H｜17 RBI',label:'角色轉換',story:'出賽與打擊內容都明顯縮減，先發位置逐漸交棒給更年輕的外野手。這一年開始更清楚看見他從場上核心轉為資深領袖與守備支援者。'},
            {year:'2025',team:'富邦悍將',line:'11 G｜.095/.136/.143｜2 H｜2 RBI',label:'最後一季前夕',story:'一軍出賽只剩 11 場，身體與球隊戰力布局都讓他的角色進一步縮小。季後宣布將在下一個球季初完成正式告別。'},
            {year:'2026',team:'富邦悍將',line:'1 G｜1 PA｜1 H｜生涯第 772 安',label:'最後一舞',story:'4 月 5 日最後一戰，首打席就敲出安打並跑回分數；二局完成最後一次正式中外野接殺後退場。隔天的引退儀式，再一次站回最熟悉的中外野，為球員生涯畫下句點。'}
          ],
          source:'資料整理：CPBL、MLB、中央社、聯合報、TSNA；截至 2026/10/06。'
        },
        {
          slug:'chen-yung-chi-career-retirement-2026',
          tone:'legacy',
          tag:'CAREER SPECIAL',
          date:'2026/10/06',
          category:'人物特刊',
          collectionSection:'people-records',
          person:'陳鏞基',
          eyebrow:'Mayaw Ciru・鏞不止步',
          title:'鏞不止步',
          headline:'陳鏞基：從台東海邊，到世界，再回到獅子的家',
          deck:'童年用報紙做球、漂流木當球棒；旅美一路爬到 3A 與 40 人名單門口，國家隊無役不與，回台後成為統一隊史全壘打王。43 歲的最後一年，他仍然在替自己的故事加頁。',
          cardMetric:'137',
          cardMetricLabel:'CPBL CAREER HR',
          stats:[
            {value:'137',label:'中職全壘打'},
            {value:'16',label:'連續開轟球季'},
            {value:'515',label:'MiLB 安打'},
            {value:'2006',label:'杜哈亞運金牌'}
          ],
          sections:[
            {
              kicker:'THE ORIGIN',
              title:'台東不是後山，是他望向世界的起點',
              body:'陳鏞基出生在台東成功鎮，童年最早的棒球場就在海邊。沒有正式器材，就把報紙揉成球、纏上膠帶，拿筆直的漂流木當球棒，在沙灘畫出界外線和壘包。看著哥哥打球，他也走進長濱國小少棒隊；從那片面向太平洋的海岸開始，他後來真的跨過海洋，走進美國職棒。',
              accent:'TAITUNG'
            },
            {
              kicker:'ALMOST MLB',
              title:'離大聯盟最近的時候，身體卻按下暫停鍵',
              body:'2006 年他在水手農場打出旅美最佳球季，從高階 1A 升上 2A，隔年直接從 3A Tacoma 開季，也進入球團 40 人名單視野。但肩膀手術讓 2007 球季只打 5 場，之後膝傷又反覆干擾。2007 到 2009，他連續站上 3A，卻也連續被傷勢打斷。沒有真正踏進 MLB，成了他自己承認最深的職業遺憾。',
              accent:'AAA'
            },
            {
              kicker:'THE LION',
              title:'沒有登上大聯盟，卻把另一段傳奇留在台灣',
              body:'2010 年底返台選秀，統一獅以第一輪第一指名選進陳鏞基。2011 年 3 月 20 日中職初登場，他就繳出 5 打數 4 安打、3 打點與全壘打。往後 16 個球季，他從游擊、二壘一路轉到三壘與一壘，從中心打線核心變成更衣室裡的老大哥，並把隊史全壘打紀錄一路推到 137 支。',
              accent:'16 YEARS'
            },
            {
              kicker:'THE FAREWELL',
              title:'引退儀式不是終點，他還在繼續比賽',
              body:'2026 年是陳鏞基公開宣告的最後一季。8 月先回到台東完成「回家的路」，9 月 19、20 日在亞太主場舉辦引退系列與儀式；但他沒有在儀式後立刻停下來。9 月 22 日生涯第一次以投手身分登板，9 月 24 日又轟出生涯第 137 轟，完成連續 16 季開轟。這很像他的生涯：告別也不是停下，而是做到最後一刻。',
              accent:'137'
            }
          ],
          quote:'謝謝你們愛棒球，因為我也很愛。',
          timelineTitle:'從海邊棒球少年，到 43 歲的最後一季',
          timelineIntro:'他的路不是直線：曾經嫌訓練太苦想放棄、曾經只差一步就可能上大聯盟，也曾在中職低潮時考慮 40 歲退休。每一次轉彎，最後都又回到棒球。',
          timeline:[
            {year:'童年',title:'成功鎮海邊・報紙球與漂流木',detail:'在台東海線長大，和部落朋友直接在沙灘畫球場，用揉成團的報紙與漂流木打球。棒球最初不是訓練，而是一種遊戲。'},
            {year:'國小',title:'長濱國小・跟著哥哥開始打球',detail:'看著大哥陳志偉打球而走上棒球路。年紀小、身材也小，甚至曾用尼龍繩綁住太鬆的球褲，但球棒從此沒有真正放下。'},
            {year:'國中',title:'泰源國中・一度退隊，又自己走回來',detail:'開始住校接受科班訓練後，因晨操與高強度生活太苦而一度退隊回家；後來看中華隊比賽又發現自己仍然愛棒球，甚至曾為了想回球隊和父母賭氣逃家。母親最後以「課業不能荒廢、品行不能變壞」為條件支持他繼續打。'},
            {year:'高中',title:'高苑工商・離開台東',detail:'高中離開家鄉到高雄，進入棒球名校高苑工商。內野攻守逐漸成熟，也開始走進各級國家隊視野。'},
            {year:'大學',title:'國立體育學院・北上再升級',detail:'大學再從南部移往北部，進入國立體育學院。2002 年哈連盃首度披上成棒中華隊戰袍，國際賽生涯正式開始。'},
            {year:'2004',title:'西雅圖水手・旅美起點',detail:'與水手簽約，從短期 1A Everett 開始職業生涯。第一年就打出 .300、25 次盜壘，也同時從小聯盟回應國家隊徵召，參加雅典奧運。'},
            {year:'2006',title:'旅美高峰＋國家隊黃金年',detail:'小聯盟全年打擊率 .324，從高階 1A 升上 2A；同一年又打 WBC、洲際盃與杜哈亞運，在亞運首戰對韓國單場雙響砲，最後幫助台灣拿下亞運棒球正式賽首金。'},
            {year:'2007',title:'3A、40 人名單與肩膀手術',detail:'開季直接從 3A Tacoma 出發，距離大聯盟只差一步，但肩膀舊傷惡化，5 場後動刀、球季報銷。秋季聯盟復出後仍被水手放進 40 人名單，證明球團沒有放棄他。'},
            {year:'2008–2010',title:'傷勢、轉隊與旅美最後三年',detail:'膝傷影響 2008 球季，之後離開水手轉戰運動家；2009 再打上 3A Sacramento，2010 先後待過運動家與海盜 2A。年底決定結束 7 年旅美，返台投入中職選秀。'},
            {year:'2011',title:'統一獅・中職第一天就開轟',detail:'第一輪第一指名加入統一，3 月 20 日初登場就 5 打數 4 安打、3 打點並開轟。也以阿美族名 Mayaw Ciru 登錄，成為中職以原住民族名登錄的重要先例。'},
            {year:'2020',title:'千安、百轟、百盜',detail:'先後完成生涯百轟、千安，再於 8 月 26 日跑出生涯第 100 次盜壘，成為中職史上第 8 位「千安百轟百盜」球員。'},
            {year:'2021–2022',title:'低潮與退休念頭',detail:'打擊成績跌到生涯低點，他曾把 40 歲設定成可能的終點；但不想在狀態最差時離開，決定再拚，把退休時間往後延。'},
            {year:'2023–2025',title:'老將反彈',detail:'2023 年打擊率回到 .336，2024 年仍有 .311，2025 年 42 歲球季也維持 .288。不是靠情懷留在一軍，而是持續證明自己仍能打。'},
            {year:'2026/08',title:'回家的路・第一次在台東打中職',detail:'引退系列首部曲回到家鄉台東，也是他 16 年中職生涯第一次在台東出賽。故鄉部落、長濱國小與家人一起把他送回棒球夢開始的地方。'},
            {year:'2026/09/20',title:'亞太引退儀式',detail:'在台南亞太主場完成「鏞不止步」引退儀式，回顧從台東、國家隊、旅美到統一的完整生涯。球季結束後，他將正式卸下球員身分。'},
            {year:'2026/09/24',title:'第 137 轟・還沒停下',detail:'引退儀式後仍繼續出賽，從伍鐸手中敲出本季首轟、生涯第 137 轟，連續第 16 個中職球季開轟。'}
          ],
          internationalTitle:'一件國家隊球衣，穿了十五年',
          internationalBadge:'CT',
          internationalIntro:'從 2002 哈連盃初次進入成棒中華隊，到 2017 世界棒球經典賽，陳鏞基幾乎經歷了那個世代所有重要國際舞台。旅美最關鍵的發展期，他仍多次返台參賽；他自己在引退年回頭看，答案仍是：「重來一次，我還是會為國家隊出戰。」',
          international:[
            {year:'2002',event:'哈連盃',opponent:'成棒國家隊',score:'國際賽起點',inning:'大學時期',homer:'第一次披上成棒 CT',detail:'還在國立體院時就進入成棒代表隊，開啟長達十多年的國家隊生涯。'},
            {year:'2004',event:'雅典奧運',opponent:'世界舞台',score:'中華隊第 5 名',inning:'旅美第一年',homer:'1A 新人直接進奧運',detail:'剛進水手小聯盟第一年就接受奧運徵召，甚至因此錯過西北聯盟明星賽。對 21 歲的內野手而言，國際賽與旅美從一開始就是平行進行。'},
            {year:'2005',event:'世界盃',opponent:'荷蘭',score:'大會明星',inning:'二壘手',homer:'入選世界盃明星二壘手',detail:'在小聯盟 A 級完整球季後返隊參賽，最終獲選賽會明星二壘手；當時他已被視為台灣最有機會挑戰大聯盟的內野新星之一。'},
            {year:'2006',event:'世界棒球經典賽',opponent:'首屆 WBC',score:'.357 / 1 HR / 5 RBI',inning:'3 場',homer:'5 安、5 打點',detail:'首屆經典賽 14 打數敲 5 安，包括 3 支二壘打與 1 支全壘打，OPS 1.143；國際賽打擊能力在這屆被世界看見。'},
            {year:'2006',event:'洲際盃',opponent:'台中',score:'中華隊銅牌',inning:'9 場',homer:'打擊率接近五成',detail:'整屆賽事攻守俱佳，獲選明星二壘手，幫助中華隊拿下銅牌。'},
            {year:'2006',event:'杜哈亞運',opponent:'南韓',score:'中華 4：2 南韓',inning:'首戰',homer:'單場雙響砲',detail:'面對韓國王牌投手群，陳鏞基單場兩發全壘打、2 分打點，成為關鍵勝利核心；中華隊最終一路奪下台灣亞運棒球正式賽史上第一面金牌，也是他最難忘的國際賽冠軍。'},
            {year:'2010',event:'廣州亞運',opponent:'南韓',score:'銀牌',inning:'金牌戰',homer:'旅美最後一年仍回國參戰',detail:'旅美生涯尾聲仍接受國家隊徵召，中華隊一路闖進金牌戰，最終不敵韓國拿下銀牌。'},
            {year:'2013',event:'世界棒球經典賽',opponent:'日本',score:'東京八強戰',inning:'延長賽',homer:'那次撲一壘，成為一代人的畫面',detail:'中華隊史上最接近擊敗日本的一場經典戰役。延長賽陳鏞基擊出雙殺打後全力撲向一壘，最終仍出局；多年後他說，2024 世界12強奪冠像是後輩替那一代人補起了一個夢。'},
            {year:'2015',event:'世界12強',opponent:'首屆 Premier12',score:'中華隊主場',inning:'資深內野核心',homer:'再披 CT 戰袍',detail:'回到中職後仍是國家隊常客，首屆 12 強持續扮演中華隊內野與中心打線的重要角色。'},
            {year:'2017',event:'世界棒球經典賽',opponent:'首爾',score:'第三度 WBC',inning:'34 歲',homer:'國家隊一級賽事最後篇章',detail:'第三次參加經典賽，也是他一級國際賽生涯的最後一站。從 2002 到 2017，他的國家隊跨度橫跨旅美、中職與不同世代。'}
          ],
          usPeriod:'USA BASEBALL · 2004–2010',
          usCareerTitle:'七年旅美：離大聯盟只差一通電話',
          usCareerIntro:'陳鏞基的旅美不是「曾經待過小聯盟」而已。2006 年他是水手農場打擊率最高的打者之一，2007 年直接從 3A 開季並進入 40 人名單；真正阻止他再往上一步的，是接連的肩膀與膝傷。七年後回頭看，515 支小聯盟安打是一段差點通往 MLB 的完整履歷。',
          usCareerSummary:[
            {value:'466',label:'MiLB 出賽'},
            {value:'515',label:'MiLB 安打'},
            {value:'24',label:'MiLB 全壘打'},
            {value:'.742',label:'MiLB OPS'}
          ],
          usCareerTotalsRows:[
            {label:'MiLB',value:'466 G｜1799 AB｜515 H｜24 HR｜263 RBI｜84 SB｜AVG .286｜OBP .340｜SLG .402｜OPS .742'},
            {label:'AAA',value:'101 G｜358 AB｜93 H｜4 HR｜36 RBI｜14 SB｜AVG .260｜OBP .316｜SLG .335｜OPS .651'},
            {label:'MLB',value:'未完成大聯盟初登場；2007 年已從 3A 開季，並在季後進入水手 40 人名單。'}
          ],
          usCareer:[
            {year:'2004',level:'A-',team:'Everett AquaSox｜Seattle',line:'49 G｜200 AB｜60 H｜3 HR｜34 RBI｜25 SB｜.300/.353/.420｜OPS .773',label:'旅美第一年就打三成',story:'1 月與水手簽約，從短期 1A 開始。除了 .300 打擊率，更跑出 25 次盜壘並拿下聯盟盜壘王級表現；同年中途離隊參加雅典奧運。'},
            {year:'2005',level:'A',team:'Wisconsin Timber Rattlers｜Seattle',line:'121 G｜503 AB｜147 H｜7 HR｜80 RBI｜15 SB｜.292/.339/.416｜OPS .755',label:'完整球季、80 打點',story:'第一次完整打滿小聯盟球季，147 安、80 打點都非常亮眼，並入選 Midwest League 明星賽。球季後段再離隊參加世界盃，最後獲選大會明星二壘手。'},
            {year:'2006',level:'A+ → AA',team:'Inland Empire → San Antonio｜Seattle',line:'110 G｜438 AB｜142 H｜8 HR｜72 RBI｜26 SB｜.324/.380/.468｜OPS .848',label:'旅美生涯最高峰',story:'全年打擊率 .324，是水手農場最突出的打者之一。高階 1A 打 .342 後升上 2A仍有 .295，並參加未來之星賽；如果只看發展曲線，下一站就是 3A 與大聯盟。'},
            {year:'2007',level:'AAA / AFL',team:'Tacoma Rainiers → Peoria Javelinas｜Seattle',line:'AAA：5 G｜15 AB｜5 H｜.333　／　AFL：17 G｜.339/.444/.424｜OPS .868',label:'最接近 MLB，卻先進手術房',story:'春天直接從 3A 開季，但肩膀舊傷在 5 場後惡化，接受手術、例行賽報銷。秋季聯盟復出表現出色，11 月水手仍把他放進 40 人名單，代表大聯盟機會並沒有消失。'},
            {year:'2008',level:'AAA',team:'Tacoma Rainiers｜Seattle',line:'69 G｜251 AB｜62 H｜3 HR｜25 RBI｜9 SB｜.247/.304/.327｜OPS .631',label:'膝傷再把進度打斷',story:'肩膀復原後重返 3A，卻又陸續受到傷勢影響，6 月底因膝傷進傷兵名單並手術。季後水手將他移出 40 人名單，運動家隨即接手。'},
            {year:'2009',level:'Rk / AA / AAA',team:'Athletics → Midland → Sacramento｜Oakland',line:'52 G｜186 AB｜57 H｜2 HR｜26 RBI｜6 SB｜.306/.375/.409｜OPS .784',label:'換體系後再回 3A',story:'在運動家系統從復健賽一路往上，AA Midland 打 .324，3A Sacramento 也有 .283。傷後依然能回到 3A，證明他的打擊與內野價值仍被球團肯定。'},
            {year:'2010',level:'AA',team:'Midland → Altoona｜Oakland / Pittsburgh',line:'60 G｜206 AB｜42 H｜1 HR｜23 RBI｜2 SB｜.204/.258/.296｜OPS .554',label:'旅美最後一年',story:'先在運動家 2A 開季，6 月離隊後轉投海盜 2A Altoona。球季結束後成為自由球員，決定返台參加中職選秀；美國夢沒有走到 MLB，但七年旅美讓他回台後立即具備成熟職業球員的完整度。'}
          ],
          yearbookTitle:'統一獅逐年球季檔案',
          yearbookIntro:'陳鏞基 28 歲才進中職，卻仍打滿 16 個球季。前半段是能守二游三壘、能跑能轟的中心打者；中段把長打推到生涯最高；後半段又從主力變成代打、輪替與更衣室領袖。這條曲線，也是統一獅 2010 年代到 2020 年代的縮影。',
          yearbook:[
            {year:'2011',team:'統一7-ELEVEn獅',line:'69 G｜84 H｜7 HR｜45 RBI｜5 SB｜.313/.377/.474｜OPS .851',label:'初登場就 4 安開轟',story:'旅美歸國第一年沒有適應期。首戰直接 5 打數 4 安打，整季打擊率 .313；季後也跟著統一拿下總冠軍，迅速成為獅隊內野核心。'},
            {year:'2012',team:'統一7-ELEVEn獅',line:'104 G｜107 H｜8 HR｜57 RBI｜6 SB｜.273/.348/.398｜OPS .746',label:'第一個百場球季',story:'出賽突破百場，承擔更完整的先發工作量。打擊率雖下降，但 57 打點讓他持續留在打線核心。'},
            {year:'2013',team:'統一7-ELEVEn獅',line:'101 G｜121 H｜9 HR｜51 RBI｜18 SB｜.314/.376/.439｜OPS .815',label:'國際賽與中職雙線高峰',story:'經典賽結束後回到中職仍維持三成以上打擊率，單季 18 盜更是中職生涯最高；同年統一再拿總冠軍。'},
            {year:'2014',team:'統一7-ELEVEn獅',line:'100 G｜111 H｜6 HR｜54 RBI｜14 SB｜.314/.367/.442｜OPS .809',label:'穩定的三成內野手',story:'連兩年打擊率 .314，安打、打點、速度都維持高水準，是球隊最可靠的攻守連結者之一。'},
            {year:'2015',team:'統一7-ELEVEn獅',line:'107 G｜95 H｜14 HR｜50 RBI｜16 SB｜.278/.344/.480｜OPS .824',label:'長打開始放大',story:'全壘打提高到 14 支、16 盜，開始從速度型內野手轉成更明顯的長打威脅；季後再代表台灣參加首屆世界12強。'},
            {year:'2016',team:'統一7-ELEVEn獅',line:'99 G｜129 H｜20 HR｜95 RBI｜11 SB｜.327/.385/.528｜OPS .913',label:'中職生涯最強一季',story:'20 轟、95 打點、129 安與 .327 打擊率全面爆發，是他中職生涯最具代表性的進攻球季。旅美時期的打擊成熟度，在 33 歲這年完整轉化成中職頂級中心棒火力。'},
            {year:'2017',team:'統一7-ELEVEn獅',line:'111 G｜115 H｜15 HR｜69 RBI｜9 SB｜.305/.361/.462｜OPS .823',label:'三成、15 轟',story:'前一年的火力不是曇花一現，仍繳出三成打擊率與 15 轟；同年第三度出征世界棒球經典賽。'},
            {year:'2018',team:'統一7-ELEVEn獅',line:'96 G｜93 H｜12 HR｜54 RBI｜8 SB｜.304/.347/.458｜OPS .805',label:'35 歲仍是中心打者',story:'連續第三年雙位數全壘打，打擊率仍超過三成。守備位置逐步往三壘、一壘移動，但攻擊端仍沒有離開核心。'},
            {year:'2019',team:'統一7-ELEVEn獅',line:'85 G｜85 H｜11 HR｜44 RBI｜6 SB｜.318/.391/.491｜OPS .882',label:'百轟之年',story:'9 月完成中職生涯第 100 支全壘打。出賽數下降，但 OPS 反而升高；老將階段開始以更有效率的打席內容延續生涯。'},
            {year:'2020',team:'統一7-ELEVEn獅',line:'102 G｜109 H｜14 HR｜63 RBI｜10 SB｜.356/.416/.549｜OPS .965',label:'37 歲生涯打擊率新高',story:'打出中職生涯最高的 .356 與 .965 OPS，7 月完成千安，8 月完成百盜，正式加入千安百轟百盜俱樂部；同年統一再奪台灣大賽冠軍。'},
            {year:'2021',team:'統一7-ELEVEn獅',line:'83 G｜35 H｜4 HR｜22 RBI｜6 SB｜.201/.304/.293｜OPS .597',label:'第一次真正的低谷',story:'打擊跌到加入中職後最低點之一。年齡與身體負荷開始變成現實，也讓他第一次認真把退休放進生涯規劃。'},
            {year:'2022',team:'統一7-ELEVEn獅',line:'52 G｜33 H｜1 HR｜16 RBI｜1 SB｜.234/.304/.284｜OPS .588',label:'40 歲前的掙扎',story:'工作量再縮減，長打也明顯下降。他原本設定打到 40 歲，但不願意用低潮作為最後畫面，決定再拚一次。'},
            {year:'2023',team:'統一7-ELEVEn獅',line:'86 G｜88 H｜5 HR｜48 RBI｜4 SB｜.336/.392/.458｜OPS .850',label:'老將大反彈',story:'40 歲球季打回 .336，證明延長生涯不是情懷，而是戰力。這一季也讓「再多打幾年」從勉強延命變成合理選擇。'},
            {year:'2024',team:'統一7-ELEVEn獅',line:'75 G｜70 H｜5 HR｜39 RBI｜1 SB｜.311/.379/.440｜OPS .819',label:'41 歲仍打三成',story:'出賽角色持續調整，但打擊效率仍高。更多時間擔任一壘、指定打擊或代打，卻依然能提供中線打擊與關鍵打席品質。'},
            {year:'2025',team:'統一7-ELEVEn獅',line:'54 G｜49 H｜5 HR｜28 RBI｜4 SB｜.288/.358/.418｜OPS .776',label:'宣布引退前的最後完整球季',story:'42 歲依舊有接近三成打擊率與 5 轟。球季後決定 2026 將是最後一年，並把告別設計成一整季，而不是突然停下。'},
            {year:'2026',team:'統一7-ELEVEn獅',line:'截至 10/06：約 48 G｜32 H｜1 HR｜16 RBI｜2 SB｜AVG 約 .276',label:'最後一季還在改寫紀錄',story:'季中受腳關節發炎影響，但仍回到一軍完成引退巡迴。9 月 20 日引退儀式後，22 日首度登板投球，24 日再轟出生涯第 137 轟、連續 16 季開轟；最後一季沒有只剩儀式，仍然有新的棒球故事。'}
          ],
          honorsTitle:'一個世代的台灣內野手',
          honorsIntro:'他的履歷同時橫跨三級棒球、七年旅美、國家隊與 16 年中職。沒有 MLB 出賽紀錄，卻有一整個世代球迷能立刻說出的國際賽畫面與獅隊紀錄。',
          honors:[
            {value:'515',title:'美國小聯盟安打',detail:'7 年旅美、466 場小聯盟出賽，最高站上 3A，也曾進入水手 40 人名單。'},
            {value:'2005',title:'世界盃明星二壘手',detail:'旅美第二年返台代表國家隊參賽，獲選賽會明星二壘手。'},
            {value:'2006',title:'杜哈亞運金牌',detail:'首戰對韓國單場雙響砲，中華隊最終奪下亞運棒球正式賽史上第一面金牌。'},
            {value:'8th',title:'千安百轟百盜',detail:'2020 年成為中職史上第 8 位完成千安、百轟、百盜的球員。'},
            {value:'137',title:'統一隊史全壘打王',detail:'2026 年 9 月 24 日將生涯全壘打推進到 137 支，持續堆高獅隊隊史紀錄。'},
            {value:'16',title:'連續 16 球季開轟',detail:'2011 到 2026 每個中職球季都有全壘打，43 歲仍能把球送出牆外。'},
            {value:'Mayaw',title:'原住民族名登錄先行者',detail:'返台加入中職後以阿美族名 Mayaw Ciru 登錄，讓原住民族名在職棒舞台被更多人看見。'},
            {value:'23Y',title:'職業球員生涯',detail:'2004 開始旅美，2026 球季結束後卸下球員身分，職業棒球旅程橫跨 23 年。'}
          ],
          source:'資料整理：CPBL、MLB/MiLB、中央社、聯合報、TSNA；數據截至 2026/10/06。'
        },
        {
          slug:'lin-dai-an-fubon-impact-2026',
          tone:'transfer',
          tag:'TRANSFER REVIEW',
          date:'2026/10/06',
          category:'球季觀察',
          collectionSection:'people-records',
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
          yearbookTitle:'林岱安逐年球季檔案',
          yearbookIntro:'捕手的價值很難只用打擊率解釋。從替補、主戰、金手套，到自由球員轉隊，林岱安的生涯曲線其實是一部「捕手如何累積信任」的長篇紀錄。',
          yearbook:[
            {year:'2015',team:'統一7-ELEVEn獅',line:'20 G｜.283/.295/.317｜17 H｜6 RBI｜捕手 16 場',label:'新人起步',story:'第四輪加入統一後在 9 月升上一軍。打擊表現不差，但更重要的是開始累積與職業投手合作、臨場配球與阻殺的實戰經驗。'},
            {year:'2016',team:'統一7-ELEVEn獅',line:'51 G｜.301/.325/.425｜34 H｜1 HR｜22 RBI',label:'打擊成長',story:'一軍出賽超過 50 場，打擊率站上三成，長打與打點同步增加。這一年開始從輪替捕手走向更穩定的一軍角色。'},
            {year:'2017',team:'統一7-ELEVEn獅',line:'40 G｜.222/.267/.283｜22 H｜阻殺率 .500',label:'守備價值浮現',story:'攻擊端回落，但捕手守備開始留下更強烈的存在感，阻殺率達五成。對捕手來說，這種「打擊低潮仍能靠守備留在一軍」是角色成熟的重要階段。'},
            {year:'2018',team:'統一7-ELEVEn獅',line:'26 G｜.193/.203/.281｜守備率 1.000｜阻殺率 .600',label:'少量出賽、守備精準',story:'出賽不多，打擊也處於低檔，但捕手守備未出現失誤，阻殺率達六成。這是一個數據很小、但守備品質很醒目的球季。'},
            {year:'2019',team:'統一7-ELEVEn獅',line:'87 G｜.258/.295/.326｜61 H｜4 HR｜阻殺率 .529',label:'主戰捕手成形',story:'出賽直接跳到 87 場，成為真正的主戰捕手；36 次阻殺、阻殺率超過五成，拿下生涯首座捕手金手套。從這一年開始，他不再只是「可以用的捕手」，而是獅隊投手群的主要搭檔。'},
            {year:'2020',team:'統一7-ELEVEn獅',line:'86 G｜.246/.290/.392｜8 HR｜40 RBI',label:'攻擊巔峰與冠軍',story:'8 轟、40 打點都是生涯代表級輸出。捕手本業之外，他也能在打線提供長打，並陪球隊走完整季與季後賽，成為統一奪冠班底的重要一員。'},
            {year:'2021',team:'統一7-ELEVEn獅',line:'91 G｜.276/.345/.343｜74 H｜39 RBI｜OPS+ 100',label:'金手套＋最佳十人',story:'攻守最完整的一季。出賽 91 場，打擊效率回到聯盟平均以上，守備率 .996；季末同時拿下捕手金手套與最佳十人，正式站上聯盟頂尖捕手行列。'},
            {year:'2022',team:'統一7-ELEVEn獅',line:'83 G｜.224/.277/.274｜49 H｜17 RBI',label:'工作量維持',story:'打擊下滑，但依舊承擔 81 場捕手守備。捕手生涯的中段，價值逐漸更集中在投手引導、賽前準備與守備穩定性。'},
            {year:'2023',team:'統一7-ELEVEn獅',line:'54 G｜.224/.272/.276｜35 H｜2 HR｜阻殺率 .410',label:'輪替深化',story:'出賽下降，但阻殺效率回升。球隊捕手分工改變後，他更多以經驗與特定投手搭配方式維持角色。'},
            {year:'2024',team:'統一7-ELEVEn獅',line:'42 G｜.271/.347/.308｜29 H｜阻殺率 .462',label:'效率反彈',story:'打席不多，但打擊率與上壘率明顯回升，阻殺率也接近五成。雖然不是高出賽量球季，卻是一個攻守效率都相對漂亮的年份。'},
            {year:'2025',team:'統一7-ELEVEn獅',line:'70 G｜.208/.257/.319｜5 HR｜17 RBI｜守備率 .998',label:'獅袍最後一年',story:'打擊率下滑，但 5 支全壘打仍是生涯次高級別火力；捕手守備率 .998。季後行使自由球員權利，結束超過十年的統一生涯。'},
            {year:'2026',team:'富邦悍將',line:'64 PA｜.088/.129/.175｜1 HR｜捕手 31 場',label:'轉隊第一年',story:'新球隊第一年並不順。春季打擊低迷、一度下二軍，捕手順位也面臨競爭；但 7 月搭配陳仕朋完成 94 球完封，9 月 16 日又以二壘安打與轉隊首轟拿下 MVP、幫球隊止敗。第一年的貢獻，更多藏在投捕合作、比賽閱讀與關鍵場次，而不是整季打擊率。'}
          ],
          source:'資料整理：CPBL、中央社、自由體育；打擊數據截至 2026/10/06。'
        }
      ];
    }

    function authorCollectionNewsCardsHtml(section) {
      return authorCollectionNewsItems()
        .filter(item => !section || item.collectionSection === section)
        .map(item => '<button class="author-news-card tone-'+escapeHtml(item.tone)+'" type="button" data-author-news="'+escapeHtml(item.slug)+'">'
          + '<div class="author-news-card-top"><span>'+escapeHtml(item.tag)+'</span><small>'+escapeHtml(item.date)+'</small></div>'
          + '<div class="author-news-card-main"><div><em>'+escapeHtml(item.eyebrow)+'</em><strong>'+escapeHtml(item.person)+'</strong><h3>'+escapeHtml(item.headline)+'</h3><p>'+escapeHtml(item.deck)+'</p></div>'
          + '<div class="author-news-card-metric"><b>'+escapeHtml(item.cardMetric)+'</b><span>'+escapeHtml(item.cardMetricLabel)+'</span></div></div>'
          + '<div class="author-news-card-foot"><span>'+escapeHtml(item.category)+'</span><b>閱讀專題 →</b></div>'
          + '</button>').join('');
    }

    function authorNewsInternationalHtml(item) {
      if(!Array.isArray(item.international) || !item.international.length) return '';
      return '<section class="author-news-international">'
        + '<div class="author-news-international-head"><span>TEAM TAIWAN</span><h3>'+escapeHtml(item.internationalTitle || '國際賽')+'</h3><p>'+escapeHtml(item.internationalIntro || '')+'</p><strong>'+escapeHtml(item.internationalBadge || 'CT')+'</strong></div>'
        + '<div class="author-news-international-grid">'
        + item.international.map(game => '<article class="author-news-intl-card">'
          + '<div class="author-news-intl-year">'+escapeHtml(game.year)+'</div>'
          + '<div class="author-news-intl-meta"><span>'+escapeHtml(game.event)+'</span><b>'+escapeHtml(game.opponent)+'</b></div>'
          + '<h4>'+escapeHtml(game.homer)+'</h4>'
          + '<div class="author-news-intl-score">'+escapeHtml(game.inning)+'｜'+escapeHtml(game.score)+'</div>'
          + '<p>'+escapeHtml(game.detail)+'</p>'
          + '</article>').join('')
        + '</div>'
        + '</section>';
    }

    function authorNewsHonorsHtml(item) {
      if(!Array.isArray(item.honors) || !item.honors.length) return '';
      return '<section class="author-news-honors">'
        + '<div class="author-news-honors-head"><span>CAREER HONORS</span><h3>'+escapeHtml(item.honorsTitle || '生涯榮譽牆')+'</h3><p>'+escapeHtml(item.honorsIntro || '把一整段職業生涯濃縮成最具代表性的里程碑。')+'</p></div>'
        + '<div class="author-news-honors-grid">'
        + item.honors.map(honor => '<article class="author-news-honor"><strong>'+escapeHtml(honor.value)+'</strong><div><h4>'+escapeHtml(honor.title)+'</h4><p>'+escapeHtml(honor.detail)+'</p></div></article>').join('')
        + '</div>'
        + '</section>';
    }

    function authorNewsUsCareerHtml(item) {
      if(!Array.isArray(item.usCareer) || !item.usCareer.length) return '';
      const summary=(item.usCareerSummary || []).map(stat =>
        '<div class="author-news-us-stat"><strong>'+escapeHtml(stat.value)+'</strong><span>'+escapeHtml(stat.label)+'</span></div>'
      ).join('');
      const totalsRows=Array.isArray(item.usCareerTotalsRows)
        ? item.usCareerTotalsRows
        : (item.usCareerTotals ? [
            {label:'MiLB',value:item.usCareerTotals.milb || ''},
            {label:'MLB',value:item.usCareerTotals.mlb || ''},
            {label:'PITCHING',value:item.usCareerTotals.pitching || ''}
          ] : []);
      const totals=totalsRows.length
        ? '<div class="author-news-us-totals">' + totalsRows.filter(row => row && row.value).map(row =>
            '<div><span>'+escapeHtml(row.label || '')+'</span><strong>'+escapeHtml(row.value || '')+'</strong></div>'
          ).join('') + '</div>'
        : '';
      return '<section class="author-news-uscareer">'
        + '<div class="author-news-us-head"><div><span>'+escapeHtml(item.usPeriod || 'USA BASEBALL')+'</span><h3>'+escapeHtml(item.usCareerTitle || '旅美職棒逐年檔案')+'</h3><p>'+escapeHtml(item.usCareerIntro || '')+'</p></div><b>USA</b></div>'
        + '<div class="author-news-us-summary">'+summary+'</div>'
        + totals
        + '<div class="author-news-us-list">'
        + item.usCareer.map(season => '<article class="author-news-us-year">'
          + '<div class="author-news-us-stamp"><strong>'+escapeHtml(season.year)+'</strong><span>'+escapeHtml(season.level)+'</span></div>'
          + '<div class="author-news-us-body"><div class="author-news-us-team">'+escapeHtml(season.team)+'</div><h4>'+escapeHtml(season.label)+'</h4><p>'+escapeHtml(season.story)+'</p><div class="author-news-us-line">'+escapeHtml(season.line)+'</div></div>'
          + '</article>').join('')
        + '</div>'
        + '</section>';
    }

    function authorNewsYearbookHtml(item) {
      if(!Array.isArray(item.yearbook) || !item.yearbook.length) return '';
      return '<section class="author-news-yearbook">'
        + '<div class="author-news-yearbook-head"><div><span>SEASON BY SEASON</span><h3>'+escapeHtml(item.yearbookTitle || '逐年球季檔案')+'</h3><p>'+escapeHtml(item.yearbookIntro || '')+'</p></div><b>'+escapeHtml(item.person)+'</b></div>'
        + '<div class="author-news-yearbook-list">'
        + item.yearbook.map((season,index) => '<article class="author-news-year">'
          + '<div class="author-news-year-stamp"><strong>'+escapeHtml(season.year)+'</strong><span>'+escapeHtml(season.team)+'</span></div>'
          + '<div class="author-news-year-body"><div class="author-news-year-label">'+escapeHtml(season.label || '')+'</div><h4>'+escapeHtml(season.story)+'</h4><div class="author-news-year-line">'+escapeHtml(season.line || '')+'</div></div>'
          + '<div class="author-news-year-no">'+String(index+1).padStart(2,'0')+'</div>'
          + '</article>').join('')
        + '</div>'
        + '</section>';
    }

    function authorNewsTimelineHtml(item) {
      if(!Array.isArray(item.timeline) || !item.timeline.length) return '';
      return '<section class="author-news-life">'
        + '<div class="author-record-section-head"><span>LIFE TIMELINE</span><h3>'+escapeHtml(item.timelineTitle || '從少棒到最後一舞')+'</h3><p>'+escapeHtml(item.timelineIntro || '')+'</p></div>'
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
        + authorNewsInternationalHtml(item)
        + authorNewsUsCareerHtml(item)
        + authorNewsYearbookHtml(item)
        + authorNewsHonorsHtml(item)
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

    function authorCollectionLandingHtml() {
      const newsCount=authorCollectionNewsItems().filter(item => item.collectionSection === 'league-news').length;
      const peopleCount=1 + authorCollectionNewsItems().filter(item => item.collectionSection === 'people-records').length;
      const gameCount=Array.isArray(homeSpecialGames) ? homeSpecialGames.length : 0;
      const tiles=[
        {
          key:'league-news',
          kicker:'LEAGUE NEWS',
          title:'聯盟新聞',
          desc:'賽制、季後賽、官方公告與值得留下的聯盟重大事件。',
          count:newsCount,
          visual:'NEWS',
          detail:newsCount ? '最新聯盟動態' : '等待新增聯盟新聞'
        },
        {
          key:'people-records',
          kicker:'PLAYER ARCHIVE',
          title:'人物紀錄',
          desc:'紀錄球員生涯、歷史里程碑，以及值得被完整保存的棒球故事。',
          count:peopleCount,
          visual:'9 / 137',
          detail:'劉俊豪・林哲瑄・陳鏞基・林岱安'
        },
        {
          key:'saved-games',
          kicker:'GAME ARCHIVE',
          title:'收藏比賽',
          desc:'把特殊比賽與經典戰役留下來，隨時重新打開完整重播。',
          count:gameCount,
          visual:'REPLAY',
          detail:gameCount ? '已收藏 '+gameCount+' 場' : '等待收藏比賽'
        }
      ];
      return '<div class="author-hub">'
        + tiles.map((tile,index) => '<button class="author-hub-card author-hub-card-'+(index+1)+'" type="button" data-author-section="'+escapeHtml(tile.key)+'">'
          + '<div class="author-hub-visual"><span>'+escapeHtml(tile.kicker)+'</span><strong>'+escapeHtml(tile.visual)+'</strong><small>'+escapeHtml(tile.detail)+'</small></div>'
          + '<div class="author-hub-copy"><div><h3>'+escapeHtml(tile.title)+'</h3><p>'+escapeHtml(tile.desc)+'</p></div><div class="author-hub-count"><b>'+escapeHtml(String(tile.count))+'</b><span>項收藏</span></div></div>'
          + '<div class="author-hub-foot"><span>開啟分類</span><b>→</b></div>'
          + '</button>').join('')
        + '</div>';
    }

    function authorCollectionSectionHeaderHtml(section) {
      const meta={
        'league-news':{kicker:'LEAGUE NEWS',title:'聯盟新聞',desc:'引退、轉隊與球季裡值得被留下的故事。'},
        'people-records':{kicker:'PLAYER ARCHIVE',title:'人物紀錄',desc:'歷史紀錄與完整人物生涯特刊。'},
        'saved-games':{kicker:'GAME ARCHIVE',title:'收藏比賽',desc:'經典戰役與特殊比賽重播。'}
      }[section] || {kicker:'AUTHOR ARCHIVE',title:'作者收藏',desc:''};
      return '<div class="author-section-head">'
        + '<button type="button" data-author-section-back>← 作者收藏</button>'
        + '<div><span>'+escapeHtml(meta.kicker)+'</span><h3>'+escapeHtml(meta.title)+'</h3><p>'+escapeHtml(meta.desc)+'</p></div>'
        + '</div>';
    }

    function authorCollectionReplayCardsHtml() {
      if(!Array.isArray(homeSpecialGames) || !homeSpecialGames.length){
        return '<div class="author-section-empty"><strong>目前沒有收藏比賽</strong><span>之後加入的特殊比賽會出現在這裡。</span></div>';
      }
      return homeSpecialGames.map(game => '<button class="special-game-card" type="button" data-special-replay-slug="' + escapeHtml(game.slug || '') + '"><div class="special-game-card-top"><strong>' + escapeHtml(game.title || '特殊比賽') + '</strong><span>' + escapeHtml(game.status || '') + '</span></div><div class="special-game-matchup">' + escapeHtml(game.away_team || '') + '<b>VS</b>' + escapeHtml(game.home_team || '') + '</div><div class="special-game-meta">' + escapeHtml([game.game_date, game.game_time, game.venue].filter(Boolean).join('｜')) + '</div><div class="special-game-card-foot"><span>' + escapeHtml(game.league || 'SPECIAL') + '</span><span>▶ 橫向重播</span></div></button>').join('');
    }

    function authorCollectionSectionBodyHtml(section) {
      if(section === 'league-news') return authorCollectionNewsCardsHtml('league-news') || '<div class="author-section-empty"><strong>目前沒有聯盟新聞</strong><span>之後的賽制、季後賽、官方公告與重大聯盟事件會收在這裡。</span></div>';
      if(section === 'people-records') return authorCollectionFeatureCardHtml() + authorCollectionNewsCardsHtml('people-records');
      if(section === 'saved-games') return authorCollectionReplayCardsHtml();
      return '';
    }

    function renderSpecialGamesExplorer() {
      if (!els.homeSpecialGamesExplorer || homeRootSection !== 'special') return;
      ensureSpecialReplayStyles();

      if(!authorCollectionSection){
        els.homeSpecialGamesExplorer.innerHTML=authorCollectionLandingHtml();
      }else{
        els.homeSpecialGamesExplorer.innerHTML =
          authorCollectionSectionHeaderHtml(authorCollectionSection)
          + '<div class="author-collection-rail" data-author-collection-rail>'
          + authorCollectionSectionBodyHtml(authorCollectionSection)
          + '</div>';
      }

      els.homeSpecialGamesExplorer.querySelectorAll('[data-author-section]').forEach(button => button.addEventListener('click',() => {
        authorCollectionSection=String(button.dataset.authorSection || '');
        els.homeSpecialGamesExplorer.scrollTop=0;
        document.querySelector('#homePage.special-home-mode .home-main-panel')?.scrollTo?.({top:0,behavior:'auto'});
        renderSpecialGamesExplorer();
      }));

      els.homeSpecialGamesExplorer.querySelector('[data-author-section-back]')?.addEventListener('click',() => {
        authorCollectionSection='';
        els.homeSpecialGamesExplorer.scrollTop=0;
        document.querySelector('#homePage.special-home-mode .home-main-panel')?.scrollTo?.({top:0,behavior:'auto'});
        renderSpecialGamesExplorer();
      });

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
