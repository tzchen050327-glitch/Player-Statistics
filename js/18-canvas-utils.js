    function tracePhotoFramePath(ctx, frame) {
      const { x, y, w, h, r = 0, cutTopLeft = 0, cutBottomRight = 0 } = frame;
      ctx.beginPath();
      if (cutTopLeft || cutBottomRight) {
        ctx.moveTo(x + cutTopLeft, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - cutBottomRight);
        ctx.lineTo(x + w - cutBottomRight, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + cutTopLeft);
        ctx.closePath();
      } else {
        ctx.roundRect(x, y, w, h, r);
      }
    }

    function drawPhotoFrameBase(ctx, frame) {
      ctx.save();
      tracePhotoFramePath(ctx, frame);
      ctx.fillStyle = frame.bg || '#314766';
      ctx.fill();
      if (frame.border) {
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPhotoImageInFrame(ctx, img, frame, transform = { x: 0, y: 0, scale: 1 }) {
      const { x, y, w, h } = frame;
      const safeTransform = clampPhotoTransform(img, transform);
      const scale = Math.max(w / img.width, h / img.height) * safeTransform.scale;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2 + safeTransform.x;
      const drawY = y + (h - drawH) / 2 + safeTransform.y;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      tracePhotoFramePath(ctx, frame);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
      if (frame.border) {
        ctx.save();
        tracePhotoFramePath(ctx, frame);
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
        ctx.restore();
      }
    }


    function effectiveDefaultPhotoRole(player, roleHint = '') {
      const normalizedHint = String(roleHint || '').trim().toLowerCase();
      if (normalizedHint === 'pitcher' || normalizedHint === 'hitter') return normalizedHint;
      if (!player) return 'hitter';

      // The fallback is intentionally scope-agnostic: CPBL, NPB, KBO,
      // MLB/MiLB and international players all use this exact resolver.
      const primary = player.type === 'pitcher' ? 'pitcher' : 'hitter';
      const secondary = primary === 'pitcher' ? 'hitter' : 'pitcher';

      if (selectedTab === 'secondary' && supportsUsDualRoleTabs(player)) return secondary;
      if ((selectedTab === 'base' || selectedTab === 'minor')
          && selectedRoleView === 'secondary'
          && selectedLevelHasSecondaryRole(player)) return secondary;
      return primary;
    }

    function selectedStoredPhoto(player) {
      if (!player) return null;
      return photos.find(photo => photo.id === player.selectedPhotoId && photo.playerId === player.id) || null;
    }

    async function resolvePlayerDisplayPhoto(player, roleHint = '') {
      const role = effectiveDefaultPhotoRole(player, roleHint);
      const photo = selectedStoredPhoto(player);
      if (photo) {
        try {
          return { image: await getPhotoImage(photo), photo, role, source: 'upload' };
        } catch {}
      }
      try {
        return { image: await getDefaultRolePhotoImage(role), photo: null, role, source: 'default' };
      } catch {}
      return { image: null, photo: null, role, source: 'placeholder' };
    }

    function defaultRolePhotoUrl(role) {
      return role === 'pitcher' ? DEFAULT_PITCHER_PHOTO_URL : DEFAULT_HITTER_PHOTO_URL;
    }

    // Canvas uses an embedded copy of our two built-in role images.
    // The photo settings UI can still use the normal asset URL, but the report
    // canvas must not depend on GitHub Pages / Service Worker timing.
    const DEFAULT_CANVAS_ROLE_PHOTO_DATA_URLS = {
      hitter: 'data:image/jpeg;base64,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',
      pitcher: 'data:image/jpeg;base64,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'
    };

    function getDefaultRolePhotoImage(role) {
      const normalizedRole = role === 'pitcher' ? 'pitcher' : 'hitter';
      return loadEmbeddedImage(DEFAULT_CANVAS_ROLE_PHOTO_DATA_URLS[normalizedRole]);
    }

    function drawStaticPhotoImageInFrame(ctx, img, frame) {
      if (!img || !Number(img.width) || !Number(img.height)) throw new Error('預設照片尚未完成解碼');
      const { x, y, w, h } = frame;
      const scale = Math.max(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      tracePhotoFramePath(ctx, frame);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
      if (frame.border) {
        ctx.save();
        tracePhotoFramePath(ctx, frame);
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawPhotoPlaceholderFrame(ctx, frame) {
      ctx.save();
      tracePhotoFramePath(ctx, frame);
      ctx.fillStyle = frame.bg || '#314766';
      ctx.fill();
      ctx.clip();
      if (frame.cutTopLeft || frame.cutBottomRight) {
        ctx.fillStyle = 'rgba(16,40,74,.05)';
        for (let x = frame.x - frame.h; x < frame.x + frame.w + frame.h; x += 44) {
          ctx.fillRect(x, frame.y, 18, frame.h);
        }
      }
      ctx.restore();
      if (frame.border) {
        ctx.save();
        tracePhotoFramePath(ctx, frame);
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function roundRect(ctx, x, y, w, h, r, fill) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }


    function loadEmbeddedImage(src) {
      if (!decorImageCache.has(src)) {
        decorImageCache.set(src, new Promise((resolve, reject) => {
          const img = new Image();
          let settled = false;
          const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
          };
          const timer = setTimeout(() => {
            decorImageCache.delete(src);
            finish(reject, new Error('圖片載入逾時'));
          }, 5000);
          img.onload = () => finish(resolve, img);
          img.onerror = () => {
            decorImageCache.delete(src);
            finish(reject, new Error('圖片載入失敗'));
          };
          img.src = src;
        }));
      }
      return decorImageCache.get(src);
    }

    function drawContain(ctx, img, x, y, w, h) {
      const scale = Math.min(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    function drawPhotoPlaceholder(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = '#314766';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    function blobToImage(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        let settled = false;
        const finish = (fn, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          fn(value);
        };
        const timer = setTimeout(() => finish(reject, new Error('圖片載入逾時')), 5000);
        img.onload = () => finish(resolve, img);
        img.onerror = () => finish(reject, new Error('圖片載入失敗'));
        img.src = url;
      });
    }

    function getPhotoImage(photo) {
      if (!photoImageCache.has(photo.id)) {
        const promise = blobToImage(photo.blob).catch(error => {
          photoImageCache.delete(photo.id);
          throw error;
        });
        photoImageCache.set(photo.id, promise);
      }
      return photoImageCache.get(photo.id);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, Number(value) || 0));
    }

    function clampPhotoTransform(img, transform = { x: 0, y: 0, scale: 1 }) {
      const { w, h } = getPhotoFrame();
      const zoom = clamp(transform.scale ?? 1, 1, 3);
      const coverScale = Math.max(w / img.width, h / img.height);
      const scale = coverScale * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const baseX = (w - drawW) / 2;
      const baseY = (h - drawH) / 2;
      return {
        x: clamp(transform.x, baseX, -baseX),
        y: clamp(transform.y, baseY, -baseY),
        scale: zoom
      };
    }

    function drawImageCover(ctx, img, x, y, w, h, r, transform = { x: 0, y: 0, scale: 1 }) {
      const safeTransform = clampPhotoTransform(img, transform);
      const scale = Math.max(w / img.width, h / img.height) * safeTransform.scale;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2 + safeTransform.x;
      const drawY = y + (h - drawH) / 2 + safeTransform.y;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    function canvasPoint(event) {
      const rect = els.canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * els.canvas.width / rect.width,
        y: (event.clientY - rect.top) * els.canvas.height / rect.height
      };
    }

    function pointInPhotoFrame(point) {
      const frame = getPhotoFrame();
      const { x, y, w, h, cutTopLeft = 0, cutBottomRight = 0 } = frame;
      if (point.x < x || point.x > x + w || point.y < y || point.y > y + h) return false;
      const lx = point.x - x;
      const ly = point.y - y;
      if (cutTopLeft && lx + ly < cutTopLeft) return false;
      if (cutBottomRight && lx + ly > w + h - cutBottomRight) return false;
      return true;
    }

    function drawTags(ctx, tags, boxX, boxBottom, maxWidth, bgColor = '#20324f') {
      if (!tags.length) return;

      const layout = getCurrentTemplate();
      ctx.font = `900 ${layout.fonts.tagText}px "Microsoft JhengHei", sans-serif`;
      const gap = 10;
      const rowGap = 10;
      const tagHeight = 52;
      const rows = [];
      let currentRow = [];
      let currentWidth = 0;

      for (const tag of tags) {
        const width = ctx.measureText(tag).width + 40;
        const nextWidth = currentRow.length ? currentWidth + gap + width : width;
        if (currentRow.length && nextWidth > maxWidth) {
          rows.push(currentRow);
          currentRow = [];
          currentWidth = 0;
        }
        currentRow.push({ tag, width });
        currentWidth += (currentRow.length > 1 ? gap : 0) + width;
      }
      if (currentRow.length) rows.push(currentRow);

      const totalHeight = rows.length * tagHeight + (rows.length - 1) * rowGap;
      let y = boxBottom - totalHeight;

      for (const row of rows) {
        const rowWidth = row.reduce((sum, item) => sum + item.width, 0) + gap * (row.length - 1);
        let x = boxX + maxWidth - rowWidth;
        for (const item of row) {
          roundRect(ctx, x, y, item.width, tagHeight, 20, bgColor);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.font = `900 ${layout.fonts.tagText}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText(item.tag, x + 20, y + 36);
          x += item.width + gap;
        }
        y += tagHeight + rowGap;
      }
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    }

    function escapeAttr(value) { return escapeHtml(value); }

    els.backHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    els.majorLevelBtn?.addEventListener('click', () => switchPlayerLevel('A'));
    els.minorLevelBtn?.addEventListener('click', () => switchPlayerLevel('D'));
    els.seasonSelect?.addEventListener('change', () => {
      syncAppPickerLabels();
      switchPlayerSeason(els.seasonSelect.value);
    });

