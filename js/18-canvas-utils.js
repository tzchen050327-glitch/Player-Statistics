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
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('裝飾圖片載入失敗'));
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
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')); };
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

