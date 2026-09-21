    const predictionUiState = {
      league: ['cpbl','npb','kbo','mlb'].includes(localStorage.getItem('predictionLeague'))
        ? localStorage.getItem('predictionLeague')
        : 'cpbl'
    };

    function predictionLeagueButton(label, value) {
      const active = predictionUiState.league === value;
      return `<button type="button" class="prediction-league-btn ${active ? 'active' : ''}" data-prediction-league="${value}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
    }

    function renderPredictionPage() {
      if (!els.predictionPageContent) return;
      els.predictionPageContent.innerHTML = `
        <div class="prediction-controls" aria-label="預測聯盟">
          ${predictionLeagueButton('中華職棒','cpbl')}
          ${predictionLeagueButton('日本職棒','npb')}
          ${predictionLeagueButton('韓國職棒','kbo')}
          ${predictionLeagueButton('美國職棒','mlb')}
        </div>

        <section class="prediction-workspace" aria-label="今日賽事預測">
          <div class="prediction-workspace-head">
            <div>
              <span>GAME PREDICTION</span>
              <strong>今日賽事預測</strong>
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
            <strong>預測專區已建立</strong>
            <span>接下來可在這裡加入每日對戰勝率、先發投手、主客場、對戰紀錄與近期狀態等預測因子。</span>
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
    }
