    async function renderCanvas() {
      const token = ++renderToken;
      const ctx = els.canvas.getContext('2d');
      const player = selectedPlayer();
      const effectiveType = player && selectedTab === 'today' ? activeTodayRole(player) : player?.type;
      const W = els.canvas.width;
      const H = els.canvas.height;

      ctx.clearRect(0, 0, W, H);
      const frameColor = currentRecord?.opponent
        ? opponentColor(currentRecord.opponent)
        : '#d7ad52';
      const layout = getCurrentTemplate();
      const isBg2 = layout.style === 'baseball-q';
      const positioned = isBg2 || Boolean(layout.detail?.positioned);

      if (layout.style) {
        drawStyledTemplateBackground(ctx, layout, frameColor);
      } else {
        const frameSize = layout.frameSize;
        ctx.fillStyle = frameColor;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = layout.innerBg;
        ctx.fillRect(frameSize, frameSize, W - frameSize * 2, H - frameSize * 2);
      }

      if (!player || !currentRecord) return;

      const projected = projectedPlayerStatsForRole(player, effectiveType);
      const opponent = currentRecord.opponent || '今日對手';
      const dateText = currentRecord.date.replaceAll('-', '.');

      // 區塊 1：對手與日期
      if (isBg2) {
        drawBg2Header(ctx, layout, opponent, dateText, frameColor);
      } else if (positioned) {
        drawStyledHeader(ctx, layout, opponent, dateText, frameColor);
      } else {
        roundRect(ctx, layout.header.x, layout.header.y, layout.header.w, layout.header.h, layout.header.r, layout.header.bg);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText('VS ', 86, 112);
        const vsWidth = ctx.measureText('VS ').width;
        ctx.fillStyle = currentRecord.opponent ? opponentColor(currentRecord.opponent) : '#ffffff';
        ctx.fillText(opponent, 86 + vsWidth, 112);
        const opponentWidth = ctx.measureText(opponent).width;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#d7ad52';
        ctx.font = `700 ${layout.fonts.headerDate}px sans-serif`;
        ctx.fillText(dateText, 994, 112);
        const dateWidth = ctx.measureText(dateText).width;

        if (layout.decorHeads?.enabled) {
          try {
            const [decorHead1, decorHead2] = await Promise.all([
              loadEmbeddedImage(DECOR_HEAD_1),
              loadEmbeddedImage(DECOR_HEAD_2)
            ]);
            if (token !== renderToken) return;
            const gapStart = 86 + vsWidth + opponentWidth + 18;
            const gapEnd = 994 - dateWidth - 18;
            const availableW = Math.max(150, gapEnd - gapStart);
            const areaW = Math.min(330, availableW);
            const areaX = gapStart + Math.max(0, (availableW - areaW) / 2);
            const head1Box = { x: areaX + areaW * 0.48, y: 38, w: areaW * 0.50, h: 82 };
            const head2Box = { x: areaX + areaW * 0.00, y: 60, w: areaW * 0.42, h: 62 };
            drawContain(ctx, decorHead2, head2Box.x, head2Box.y, head2Box.w, head2Box.h);
            drawContain(ctx, decorHead1, head1Box.x, head1Box.y, head1Box.w, head1Box.h);
          } catch {}
        }
      }

      // 區塊 2：三圍
      const metrics = effectiveType === 'hitter'
        ? (() => { const d = hitterDerived(projected); return [['打擊率', fmtBatRate(d.avg)], ['上壘率', fmtBatRate(d.obp)], ['長打率', fmtBatRate(d.slg)]]; })()
        : (() => {
            const d = pitcherDerived(projected);
            return [['WHIP', fmtTwo(d.whip)], ['防禦率', fmtTwo(d.era)], pitcherLastMetric(player, projected)];
          })();

      metrics.forEach((metric, index) => {
        const card = layout.metricCards[index];
        if (isBg2) drawBg2MetricFrame(ctx, card);
        else if (positioned) drawStyledMetricFrame(ctx, card);
        else roundRect(ctx, card.x, card.y, card.w, card.h, card.r, card.bg);

        ctx.textAlign = 'center';
        ctx.fillStyle = card.label;
        ctx.font = `700 ${layout.fonts.metricLabel}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText(metric[0], card.x + card.w / 2, card.y + (card.labelOffset ?? (isBg2 ? 39 : 51)));

        ctx.fillStyle = card.value;
        ctx.font = `900 ${layout.fonts.metricValue}px Arial, sans-serif`;
        ctx.fillText(metric[1], card.x + card.w / 2, card.y + (card.valueOffset ?? (isBg2 ? 91 : 121)));
      });

      // 區塊 4：照片。所有聯盟與國際賽都走同一套「自訂照優先、無照依角色補預設圖」。
      const frame = layout.photo;
      drawPhotoFrameBase(ctx, frame);
      const resolvedPhoto = await resolvePlayerDisplayPhoto(player, effectiveType);
      if (token !== renderToken) return;
      if (resolvedPhoto.image) {
        if (resolvedPhoto.source === 'upload' && resolvedPhoto.photo) {
          const transform = clampPhotoTransform(
            resolvedPhoto.image,
            getPhotoTransform(player, resolvedPhoto.photo.id)
          );
          player.photoTransforms[resolvedPhoto.photo.id] = transform;
          drawPhotoImageInFrame(ctx, resolvedPhoto.image, frame, transform);
        } else {
          drawStaticPhotoImageInFrame(ctx, resolvedPhoto.image, frame);
        }
      } else {
        drawPhotoPlaceholderFrame(ctx, frame);
      }

      // 區塊 3：逐打席或投球戰績
      if (layout.detail.drawBox !== false) {
        roundRect(ctx, layout.detail.x, layout.detail.y, layout.detail.w, layout.detail.h, layout.detail.r, layout.detail.bg);
        if (positioned && layout.detail.border) {
          ctx.save();
          ctx.strokeStyle = layout.detail.border;
          ctx.lineWidth = layout.detail.borderWidth || 2;
          ctx.beginPath();
          ctx.roundRect(layout.detail.x, layout.detail.y, layout.detail.w, layout.detail.h, layout.detail.r || 0);
          ctx.stroke();
          ctx.restore();
        }
      }

      const detail = layout.detail;
      if (positioned) {
        const detailHeading = effectiveType === 'hitter' ? hitterAppearanceHeading(ensureHitterAppearance()) : '投球成績';
        if (isBg2) drawBg2DetailHeading(ctx, detailHeading, detail);
        else drawStyledDetailHeading(ctx, detailHeading, detail);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';

      if (effectiveType === 'hitter') {
        const appearance = ensureHitterAppearance();
        if (appearance.mode === 'bat') {
          const officialBox = currentRecord?.internationalHitterGame;
          const pas = currentRecord.hitterPAs.slice(0, 8);
          if (currentRecord?.externalReadOnlyImport && officialBox && !pas.length) {
            const hits = Number(officialBox.hits) || 0;
            const summaryLines = [
              ['打數', Number(officialBox.ab)||0],
              ['安打', hits],
              ['打點', Number(officialBox.rbi)||0],
              ['得分', Number(officialBox.runs)||0],
              ['保送', Number(officialBox.bb)||0],
              ['三振', Number(officialBox.k)||0],
              ['全壘打', Number(officialBox.hr)||0]
            ];
            summaryLines.forEach((line, index) => {
              const y = positioned ? detail.pitcherStartY + index * detail.pitcherStep : 492 + index * 52;
              ctx.fillStyle = positioned ? (detail.mutedColor || '#52657d') : '#6d7688';
              ctx.font = `700 ${layout.fonts.pitcherLabel}px "Microsoft JhengHei", sans-serif`;
              ctx.fillText(line[0], positioned ? detail.pitcherLabelX : 90, y);
              ctx.textAlign = 'right';
              ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
              ctx.font = `900 ${layout.fonts.pitcherValue}px Arial, sans-serif`;
              ctx.fillText(String(line[1]), positioned ? detail.pitcherValueX : 470, y);
              ctx.textAlign = 'left';
            });
          } else {
          pas.forEach((pa, index) => {
            const y = positioned ? detail.paStartY + index * detail.paStep : 425 + index * 78;
            const numberX = positioned ? detail.paNumberX : 106;
            const textX = positioned ? detail.paTextX : 158;
            const radius = positioned ? (detail.paRadius || 22) : 28;

            ctx.save();
            ctx.fillStyle = index % 2 ? (detail.paCircleAlt || '#20324f') : (detail.paCircle || '#d7ad52');
            ctx.beginPath();
            ctx.arc(numberX, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = index % 2 ? (detail.paCircleAltText || '#ffffff') : (detail.paCircleText || '#172033');
            ctx.textAlign = 'center';
            ctx.font = `900 ${layout.fonts.paNumber}px Arial, sans-serif`;
            ctx.fillText(String(index + 1), numberX, y + (positioned ? 8 : 10));
            ctx.restore();

            ctx.textAlign = 'left';
            ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
            ctx.font = `900 ${layout.fonts.paResult}px "Microsoft JhengHei", sans-serif`;
            ctx.fillText(paLabel(pa), textX, y + (positioned ? 11 : 14));
            if (pa.rbi) {
              const width = ctx.measureText(paLabel(pa)).width;
              ctx.fillStyle = positioned ? (detail.rbiColor || '#b5811b') : '#b5811b';
              ctx.font = `900 ${layout.fonts.paRbi}px Arial, sans-serif`;
              ctx.fillText(String(pa.rbi), textX + 8 + width, y - (positioned ? 11 : 13));
            }
            if (index < pas.length - 1) {
              ctx.strokeStyle = positioned ? (detail.dividerColor || 'rgba(16,40,74,.20)') : '#d7dce5';
              ctx.lineWidth = positioned ? 1.5 : 2;
              ctx.beginPath();
              ctx.moveTo(positioned ? detail.dividerX1 : 76, y + (positioned ? 29 : 39));
              ctx.lineTo(positioned ? detail.dividerX2 : 486, y + (positioned ? 29 : 39));
              ctx.stroke();
            }
          });

          const paCodes = currentRecord.hitterPAs.map(pa => pa.code);
          const cycle = paCodes.includes('1B') && paCodes.includes('2B') && paCodes.includes('3B') && paCodes.includes('HR');
          const hitterTags = [];
          if (cycle) hitterTags.push('完全打擊');
          if (kboHitterRbiNeedsAggregateFallback(player, currentRecord)) {
            hitterTags.push(`打點 ${officialHitterRbiSummary(currentRecord).official}`);
          }
          if (hitterTags.length) {
            if (positioned) drawTags(ctx, hitterTags, detail.tagsX, detail.tagsBottom, detail.tagsW, detail.accentColor || '#d4af37');
            else drawTags(ctx, hitterTags, 72, 1008, 418, '#d4af37');
          }
          }
        } else {
          drawHitterAppearanceDetail(ctx, layout, positioned, detail, appearance);
        }
      } else {
        const g = currentRecord.pitcherGame;
        const pitches = Math.min(150, Number(g.pitchTens) * 10 + Number(g.pitchOnes));

        if (!positioned) {
          ctx.fillStyle = '#172033';
          ctx.font = `900 ${layout.fonts.pitcherTitle}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText('投球戰績', 88, 430);
        }

        const showRuns = Boolean(g.showRuns);
        const lines = currentRecord?.externalWalksCombined
          ? [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['四死球', g.bb],
              ['被安打', g.h],
              ...(showRuns ? [['失分', g.r]] : []),
              ['自責分', g.er],
              ['用球數', pitches]
            ]
          : [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['保送', g.bb],
              ['被安打', g.h],
              ['死球', g.hbp],
              ...(showRuns ? [['失分', g.r]] : []),
              ['自責分', g.er],
              ['用球數', pitches]
            ];
        lines.forEach((line, index) => {
          const y = positioned ? detail.pitcherStartY + index * detail.pitcherStep : 492 + index * 52;
          ctx.fillStyle = positioned ? (detail.mutedColor || '#52657d') : '#6d7688';
          ctx.font = `700 ${layout.fonts.pitcherLabel}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText(line[0], positioned ? detail.pitcherLabelX : 90, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
          ctx.font = `900 ${layout.fonts.pitcherValue}px Arial, sans-serif`;
          ctx.fillText(String(line[1]), positioned ? detail.pitcherValueX : 470, y);
          ctx.textAlign = 'left';
        });

        standardizePitcherSpecialRecords(g);
        const result = pitcherResult(g);
        const outs = ipToOuts(g.innings) || 0;
        let specialRecord = '';

        if (g.cg && outs >= 27 && Number(g.h) === 0 && Number(g.bb) === 0 && Number(g.hbp) === 0 && Number(g.otherReach || 0) === 0) {
          specialRecord = '完全比賽';
        } else if (g.cg && outs >= 27 && Number(g.h) === 0) {
          specialRecord = '無安打比賽';
        } else if (g.cg && g.sho && result === 'W' && outs >= 27 && pitches < 100) {
          specialRecord = 'Maddux 完封勝';
        }

        const tagX = positioned ? detail.tagsX : 72;
        const tagBottom = positioned ? detail.tagsBottom : 1008;
        const tagW = positioned ? detail.tagsW : 418;

        if (specialRecord) {
          drawTags(ctx, [specialRecord], tagX, tagBottom, tagW, '#d4af37');
        } else {
          const tags = [];
          if (g.cg) tags.push('完投');
          if (g.sho) tags.push('完封');
          if (g.noWalkHbp) tags.push('無四死球');
          if (result === 'HLD') tags.push('中繼成功');
          if (result === 'SV') tags.push('救援成功');
          if (g.bsv) tags.push('救援失敗');
          if (g.rainCalled) tags.push('因雨提前裁定');
          if (result === 'W') tags.push('勝');
          if (result === 'L') tags.push('敗');
          drawTags(ctx, tags, tagX, tagBottom, tagW);
        }
      }

      // 區塊 5：背號與名字
      if (layout.name.plateBg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
          layout.name.plateX,
          layout.name.plateY,
          layout.name.plateW,
          layout.name.plateH,
          layout.name.plateR || 0
        );
        ctx.fillStyle = layout.name.plateBg;
        ctx.fill();
        if (layout.name.plateBorder) {
          ctx.strokeStyle = layout.name.plateBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      const playerTitle = `#${player.number} ${reportPlayerName(player)}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = layout.name.color || '#ffffff';
      let playerNameFontSize = Number(layout.fonts.playerName) || 42;
      ctx.font = `900 ${playerNameFontSize}px "Microsoft JhengHei", Arial, sans-serif`;
      const nameMaxWidth = layout.name.maxWidth || 438;
      const nameMinSize = layout.name.minFont || (positioned ? 28 : 32);
      while (ctx.measureText(playerTitle).width > nameMaxWidth && playerNameFontSize > nameMinSize) {
        playerNameFontSize = Math.max(nameMinSize, playerNameFontSize - 2);
        ctx.font = `900 ${playerNameFontSize}px "Microsoft JhengHei", Arial, sans-serif`;
      }
      ctx.fillText(playerTitle, layout.name.textX, layout.name.textY);

      ctx.fillStyle = layout.name.lineColor || frameColor;
      ctx.fillRect(layout.name.lineX, layout.name.lineY, layout.name.lineW, layout.name.lineH || (positioned ? 3 : 5));

      ctx.fillStyle = layout.name.typeColor || '#94a3b8';
      ctx.font = `700 ${layout.fonts.playerType}px Arial, sans-serif`;
      ctx.fillText(effectiveType === 'pitcher' ? 'PITCHER' : 'HITTER', layout.name.typeX, layout.name.typeY);

      if (layout.style === 'scoreboard-tech') {
        drawScoreboardPlayerFooter(ctx, { ...player, type:effectiveType }, currentRecord);
      }
    }

    function drawStyledTemplateBackground(ctx, layout, frameColor = '#d7ad52') {
      switch (layout.style) {
        case 'baseball-q': return drawBg2Background(ctx, frameColor);
        case 'stadium-night': return drawStadiumNightBackground(ctx, frameColor);
        case 'baseball-seam': return drawBaseballSeamBackground(ctx, frameColor);
        case 'bullpen': return drawBullpenBackground(ctx, frameColor);
        case 'scoreboard-tech': return drawScoreboardTechBackground(ctx, frameColor);
      }
      ctx.fillStyle = layout.innerBg || '#152238';
      ctx.fillRect(0, 0, 1080, 1080);
    }

    function drawStyledHeader(ctx, layout, opponent, dateText, frameColor) {
      const h = layout.header;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = h.textColor || '#ffffff';
      ctx.font = `900 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
      ctx.fillText('VS ', h.vsX, h.vsY);
      const vsW = ctx.measureText('VS ').width;
      ctx.fillStyle = frameColor || h.textColor || '#ffffff';
      ctx.fillText(opponent, h.vsX + vsW, h.vsY);
      ctx.textAlign = h.dateAlign === 'right' ? 'right' : 'left';
      ctx.fillStyle = h.dateColor || '#d7ad52';
      ctx.font = `800 ${layout.fonts.headerDate}px Arial, "Microsoft JhengHei", sans-serif`;
      ctx.fillText(dateText, h.dateX, h.dateY);
      ctx.restore();
    }

    function drawStyledMetricFrame(ctx, card) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, card.r || 0);
      ctx.fillStyle = card.bg || 'rgba(255,255,255,.88)';
      ctx.fill();
      if (card.border) {
        ctx.strokeStyle = card.border;
        ctx.lineWidth = card.borderWidth || 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawStyledDetailHeading(ctx, text, detail) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = detail.accentColor || '#d7ad52';
      ctx.fillRect(detail.headingX - 14, detail.headingY - 27, 5, 30);
      ctx.fillStyle = detail.textColor || '#172033';
      ctx.font = '900 31px "Microsoft JhengHei", sans-serif';
      ctx.fillText(text, detail.headingX, detail.headingY);
      ctx.strokeStyle = detail.dividerColor || 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(detail.underlineX, detail.underlineY);
      ctx.lineTo(detail.underlineX + detail.underlineW, detail.underlineY);
      ctx.stroke();
      ctx.restore();
    }

