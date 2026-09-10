    function renderPhotos(player) {
      const selectedPhoto = photos.find(photo => photo.id === player.selectedPhotoId && photo.playerId === player.id);
      const selectedTransform = selectedPhoto ? getPhotoTransform(player, selectedPhoto.id) : null;
      const zoomPercent = selectedTransform ? Math.round(selectedTransform.scale * 100) : 100;

      els.content.innerHTML = `
        <h2>照片</h2>
        <label class="field">上傳照片
          <input id="photoUpload" type="file" accept="image/*" />
        </label>
        ${selectedPhoto ? `
          <div class="panel" style="box-shadow:none;padding:14px;margin-top:14px;background:#f8fafc">
            <label class="field">照片縮放
              <div style="display:flex;align-items:center;gap:12px">
                <input id="photoZoom" type="range" min="100" max="300" step="5" value="${zoomPercent}" style="flex:1" />
                <strong id="photoZoomValue" style="min-width:58px;text-align:right">${zoomPercent}%</strong>
              </div>
            </label>
            <div class="section-actions" style="margin-top:10px">
              <button id="resetPhotoTransformBtn" class="press-btn">重設位置與縮放</button>
            </div>
          </div>` : ''}
        <div id="photoGrid" class="photo-grid"></div>`;

      document.getElementById('photoUpload').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return setStatus('請選擇圖片檔。', true);
        const photo = { id: uid(), playerId: player.id, name: file.name, blob: file, createdAt: Date.now() };
        await idbPut(STORES.photos, photo);
        photos.push(photo);
        if (!player.selectedPhotoId) {
          player.selectedPhotoId = photo.id;
          getPhotoTransform(player, photo.id);
          await savePlayer(player);
        }
        setStatus('照片已保存到目前球員。');
        renderPhotos(player);
        await renderCanvas();
      });

      if (selectedPhoto) {
        const zoomInput = document.getElementById('photoZoom');
        const zoomValue = document.getElementById('photoZoomValue');
        zoomInput.addEventListener('input', async () => {
          try {
            const image = await getPhotoImage(selectedPhoto);
            const current = getPhotoTransform(player, selectedPhoto.id);
            const next = clampPhotoTransform(image, {
              ...current,
              scale: Number(zoomInput.value) / 100
            });
            ensurePhotoTransforms(player)[selectedPhoto.id] = next;
            zoomValue.textContent = `${Math.round(next.scale * 100)}%`;
            renderCanvas();
          } catch {
            setStatus('照片載入失敗。', true);
          }
        });
        zoomInput.addEventListener('change', async () => {
          await savePlayer(player);
          setStatus('照片縮放比例已保存。');
        });

        document.getElementById('resetPhotoTransformBtn').addEventListener('click', async () => {
          ensurePhotoTransforms(player)[selectedPhoto.id] = { x: 0, y: 0, scale: 1 };
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
          setStatus('照片位置與縮放已重設。');
        });
      }

      renderPhotoGrid(player);
    }

    function renderPhotoGrid(player) {
      const grid = document.getElementById('photoGrid');
      if (!grid) return;
      const ownedPhotos = playerPhotos(player).sort((a,b) => b.createdAt - a.createdAt);
      if (!ownedPhotos.length) {
        grid.innerHTML = '';
        return;
      }
      grid.innerHTML = '';
      for (const photo of ownedPhotos) {
        const url = URL.createObjectURL(photo.blob);
        const card = document.createElement('div');
        card.className = `photo-card ${player.selectedPhotoId === photo.id ? 'selected' : ''}`;
        card.innerHTML = `
          <img alt="${escapeAttr(photo.name)}" />
          <div class="subtle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(photo.name)}</div>
          <div class="photo-actions">
            <button class="press-btn select-photo">選用</button>
            <button class="press-btn danger delete-photo">刪除</button>
          </div>`;
        card.querySelector('img').src = url;
        card.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        card.querySelector('.select-photo').addEventListener('click', async () => {
          player.selectedPhotoId = photo.id;
          getPhotoTransform(player, photo.id);
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
        });
        card.querySelector('.delete-photo').addEventListener('click', async () => {
          await idbDelete(STORES.photos, photo.id);
          photos = photos.filter(p => p.id !== photo.id);
          photoImageCache.delete(photo.id);
          if (player.selectedPhotoId === photo.id) player.selectedPhotoId = null;
          if (player.photoTransforms) delete player.photoTransforms[photo.id];
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
        });
        grid.appendChild(card);
      }
    }

    function renderHomeTemplates() {
      if (!els.homeTemplateGrid) return;
      els.homeTemplateGrid.innerHTML = '';
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="300" height="300" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '選用') : '預留'}</span>
          </div>`;
        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);
        if (template.enabled) {
          card.addEventListener('click', () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderHomeTemplates();
            if (selectedPlayer()) renderCanvas();
          });
        }
        els.homeTemplateGrid.appendChild(card);
      });
    }

    function renderQuickTemplates() {
      if (!els.quickTemplateGrid) return;
      els.quickTemplateGrid.innerHTML = '';
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="320" height="320" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '選用') : '預留'}</span>
          </div>`;
        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);
        if (template.enabled) {
          card.addEventListener('click', async () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderHomeTemplates();
            renderQuickTemplates();
            try {
              await refreshPreparedOutputFromCanvas();
              els.quickTemplateDialog?.close();
              showAppToast('背景已更換');
            } catch (error) {
              setStatus(error?.message || '背景切換失敗。', true);
            }
          });
        }
        els.quickTemplateGrid.appendChild(card);
      });
    }

    function renderTemplates() {
      els.content.innerHTML = `
        <h2>背景</h2>
        <div class="subtle">點選縮圖切換背景。每個背景的版面、照片裁切與字體大小皆獨立設定。</div>
        <div id="templateGrid" class="template-grid"></div>`;

      const grid = document.getElementById('templateGrid');
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="360" height="360" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '可選用') : '預留'}</span>
          </div>`;

        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);

        if (template.enabled) {
          card.addEventListener('click', () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderTemplates();
            renderCanvas();
          });
        }
        grid.appendChild(card);
      });
    }

    function drawTemplatePreview(canvas, template, placeholder = false) {
      const ctx = canvas.getContext('2d');
      const scale = canvas.width / 1080;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (template.style) {
        ctx.save();
        ctx.scale(scale, scale);
        drawStyledTemplateBackground(ctx, template, '#d7ad52');
        if (template.style === 'baseball-q') drawBg2Header(ctx, template, '對手', '2026.09.06', '#d7ad52');
        else drawStyledHeader(ctx, template, '對手', '2026.09.06', '#d7ad52');

        template.metricCards.forEach(card => {
          if (template.style === 'baseball-q') drawBg2MetricFrame(ctx, card);
          else drawStyledMetricFrame(ctx, card);
        });

        if (template.detail?.drawBox !== false) {
          roundRect(ctx, template.detail.x, template.detail.y, template.detail.w, template.detail.h, template.detail.r || 0, template.detail.bg);
        }
        if (template.detail?.positioned) {
          drawStyledDetailHeading(ctx, '逐打席', template.detail);
        }

        drawPhotoFrameBase(ctx, template.photo);
        if (template.name.plateBg) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(
            template.name.plateX,
            template.name.plateY,
            template.name.plateW,
            template.name.plateH,
            template.name.plateR || 0
          );
          ctx.fillStyle = template.name.plateBg;
          ctx.fill();
          if (template.name.plateBorder) {
            ctx.strokeStyle = template.name.plateBorder;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.fillStyle = template.name.color || '#ffffff';
        ctx.font = `900 ${template.fonts.playerName || 42}px "Microsoft JhengHei", Arial, sans-serif`;
        ctx.fillText('#81 球員名字', template.name.textX, template.name.textY);
        ctx.fillStyle = template.name.lineColor || '#d7ad52';
        ctx.fillRect(template.name.lineX, template.name.lineY, template.name.lineW, template.name.lineH || 3);
        ctx.restore();
      } else {
        const S = value => value * scale;
        const frameSize = template.frameSize || 18;

        ctx.fillStyle = '#d7ad52';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = template.innerBg;
        ctx.fillRect(S(frameSize), S(frameSize), canvas.width - S(frameSize * 2), canvas.height - S(frameSize * 2));

        const drawBox = box => {
          if (!box || box.drawBox === false) return;
          ctx.fillStyle = box.bg;
          ctx.beginPath();
          ctx.roundRect(S(box.x), S(box.y), S(box.w), S(box.h), S(box.r || 0));
          ctx.fill();
        };

        drawBox(template.header);
        template.metricCards.forEach(drawBox);
        drawBox(template.detail);
        drawBox(template.photo);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(S(template.name.textX), S(template.name.textY - 22), S(240), S(12));
        ctx.fillStyle = '#d7ad52';
        ctx.fillRect(S(template.name.lineX), S(template.name.lineY), S(template.name.lineW), Math.max(2, S(5)));
      }

      if (placeholder) {
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(canvas.width * 0.055)}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText('預留', canvas.width / 2, canvas.height / 2);
      }
    }

