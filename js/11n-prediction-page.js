    const predictionUiState = {
      league: ['cpbl','npb','kbo','mlb'].includes(localStorage.getItem('predictionLeague'))
        ? localStorage.getItem('predictionLeague')
        : 'cpbl',
      mode: ['game','postseason'].includes(localStorage.getItem('predictionMode'))
        ? localStorage.getItem('predictionMode')
        : 'game'
    };

    function predictionLeagueButton(label, value) {
      const active = predictionUiState.league === value;
      return `<button type="button" class="prediction-league-btn ${active ? 'active' : ''}" data-prediction-league="${value}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
    }

    function predictionModeButton(label, value) {
      const active = predictionUiState.mode === value;
      return `<button type="button" class="prediction-mode-btn ${active ? 'active' : ''}" data-prediction-mode="${value}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
    }

    function predictionWorkspaceCopy() {
      if (predictionUiState.mode === 'postseason') {
        return {
          kicker:'POSTSEASON PREDICTION',
          title:'季後賽預測',
          emptyTitle:'季後賽資格預測區',
          emptyText:'這裡會顯示各隊進入季後賽的機率、目前資格狀態，以及影響晉級機率的剩餘賽程與戰績因素。'
        };
      }
      return {
        kicker:'GAME PREDICTION',
        title:'比賽預測',
        emptyTitle:'比賽預測區',
        emptyText:'這裡會加入每日對戰勝率、先發投手、主客場、對戰紀錄與近期狀態等預測因子。'
      };
    }

    function renderPredictionPage() {
      if (!els.predictionPageContent) return;
      const workspace = predictionWorkspaceCopy();
      els.predictionPageContent.innerHTML = `
        <div class="prediction-controls" aria-label="預測聯盟">
          ${predictionLeagueButton('中華職棒','cpbl')}
          ${predictionLeagueButton('日本職棒','npb')}
          ${predictionLeagueButton('韓國職棒','kbo')}
          ${predictionLeagueButton('美國職棒','mlb')}
        </div>

        <div class="prediction-mode-controls" aria-label="預測類型">
          ${predictionModeButton('比賽預測','game')}
          ${predictionModeButton('季後賽預測','postseason')}
        </div>

        <section class="prediction-workspace" aria-label="${workspace.title}">
          <div class="prediction-workspace-head">
            <div>
              <span>${workspace.kicker}</span>
              <strong>${workspace.title}</strong>
            </div>
            <span class="prediction-stage-badge">模型準備中</span>
          </div>

          <div class="prediction-empty-state">
            <div class="prediction-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 18.5 9 13l3.5 3.2L20 7.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M15.5 7.5H20v4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <strong>${workspace.emptyTitle}</strong>
            <span>${workspace.emptyText}</span>
          </div>
        </section>
      `;

      els.predictionPageContent.querySelectorAll('[data-prediction-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          const league = String(btn.dataset.predictionLeague || '');
          if (!['cpbl','npb','kbo','mlb'].includes(league)) return;
          predictionUiState.league = league;
          localStorage.setItem('predictionLeague', league);
          renderPredictionPage();
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = String(btn.dataset.predictionMode || '');
          if (!['game','postseason'].includes(mode)) return;
          predictionUiState.mode = mode;
          localStorage.setItem('predictionMode', mode);
          renderPredictionPage();
        });
      });
    }
