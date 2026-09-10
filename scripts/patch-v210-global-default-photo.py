from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# 1) Version + cache-busted default artwork URLs.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.09';" not in s:
    raise SystemExit('v2.09 APP_VERSION not found')
s = s.replace("const APP_VERSION = 'v2.09';", "const APP_VERSION = 'v2.10';", 1)
s = s.replace("./assets/default-hitter.jpg?v=v2.09", "./assets/default-hitter.jpg?v=v2.10")
s = s.replace("./assets/default-pitcher.jpg?v=v2.09", "./assets/default-pitcher.jpg?v=v2.10")
p.write_text(s, encoding='utf-8')

# 2) One global resolver for every scope: CPBL / NPB / KBO / MLB-MiLB / international.
p = ROOT / 'js' / '18-canvas-utils.js'
s = p.read_text(encoding='utf-8')
anchor = "    function defaultRolePhotoUrl(role) {\n      return role === 'pitcher' ? DEFAULT_PITCHER_PHOTO_URL : DEFAULT_HITTER_PHOTO_URL;\n    }\n"
if s.count(anchor) != 1:
    raise SystemExit(f'defaultRolePhotoUrl anchor count={s.count(anchor)}')
insert = r'''    function effectiveDefaultPhotoRole(player, roleHint = '') {
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

'''
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s, encoding='utf-8')

# 3) Daily/per-game report uses the global resolver, including old players.
p = ROOT / 'js' / '16-daily-canvas.js'
s = p.read_text(encoding='utf-8')
old = r'''      // 區塊 4：照片。未上傳球員照時依目前角色使用預設打者／投手圖。
      const frame = layout.photo;
      drawPhotoFrameBase(ctx, frame);
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      let photoDrawn = false;
      if (photo) {
        try {
          const image = await getPhotoImage(photo);
          if (token !== renderToken) return;
          const transform = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
          player.photoTransforms[photo.id] = transform;
          drawPhotoImageInFrame(ctx, image, frame, transform);
          photoDrawn = true;
        } catch {}
      }
      if (!photoDrawn) {
        try {
          const image = await getDefaultRolePhotoImage(effectiveType);
          if (token !== renderToken) return;
          drawStaticPhotoImageInFrame(ctx, image, frame);
          photoDrawn = true;
        } catch {}
      }
      if (!photoDrawn) drawPhotoPlaceholderFrame(ctx, frame);
'''
new = r'''      // 區塊 4：照片。所有聯盟與國際賽都走同一套「自訂照優先、無照依角色補預設圖」。
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
'''
if s.count(old) != 1:
    raise SystemExit(f'daily photo block count={s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 4) Annual / league-season / international-total report uses the same resolver.
p = ROOT / 'js' / '21-annual-report.js'
s = p.read_text(encoding='utf-8')
old = r'''      const photo=photos.find(p=>p.id===player.selectedPhotoId && p.playerId===player.id);
      let photoImage=null;
      if(photo){
        try{ photoImage=await getPhotoImage(photo); }catch{}
      }
      if(!photoImage){
        try{ photoImage=await getDefaultRolePhotoImage(role); }catch{}
      }
      if(photoImage){
        drawStaticPhotoImageInFrame(ctx,photoImage,frame);
        ctx.save();
        tracePhotoFramePath(ctx,frame);ctx.clip();
        const shade=ctx.createLinearGradient(0,frame.y,0,frame.y+frame.h);
        shade.addColorStop(0,'rgba(3,13,21,.02)');
        shade.addColorStop(1,'rgba(3,13,21,.28)');
        ctx.fillStyle=shade;ctx.fillRect(frame.x,frame.y,frame.w,frame.h);
        ctx.restore();
      }'''
new = r'''      const resolvedPhoto=await resolvePlayerDisplayPhoto(player,role);
      if(resolvedPhoto.image){
        drawStaticPhotoImageInFrame(ctx,resolvedPhoto.image,frame);
        ctx.save();
        tracePhotoFramePath(ctx,frame);ctx.clip();
        const shade=ctx.createLinearGradient(0,frame.y,0,frame.y+frame.h);
        shade.addColorStop(0,'rgba(3,13,21,.02)');
        shade.addColorStop(1,'rgba(3,13,21,.28)');
        ctx.fillStyle=shade;ctx.fillRect(frame.x,frame.y,frame.w,frame.h);
        ctx.restore();
      }'''
if s.count(old) != 1:
    raise SystemExit(f'annual photo block count={s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 5) Photo tab visibly shows what is actually being used, so fallback is not hidden only inside downloads.
p = ROOT / 'js' / '14-photo-template-ui.js'
s = p.read_text(encoding='utf-8')
old_start = r'''    function renderPhotos(player) {
      const selectedPhoto = photos.find(photo => photo.id === player.selectedPhotoId && photo.playerId === player.id);
      const selectedTransform = selectedPhoto ? getPhotoTransform(player, selectedPhoto.id) : null;
      const zoomPercent = selectedTransform ? Math.round(selectedTransform.scale * 100) : 100;

      els.content.innerHTML = `
        <h2>照片</h2>
        <label class="field">上傳照片
          <input id="photoUpload" type="file" accept="image/*" />
        </label>
        ${selectedPhoto ? `
'''
new_start = r'''    function renderPhotos(player) {
      const selectedPhoto = selectedStoredPhoto(player);
      const selectedTransform = selectedPhoto ? getPhotoTransform(player, selectedPhoto.id) : null;
      const zoomPercent = selectedTransform ? Math.round(selectedTransform.scale * 100) : 100;
      const defaultRole = effectiveDefaultPhotoRole(player);
      const defaultRoleLabel = defaultRole === 'pitcher' ? '預設投手圖' : '預設打者圖';

      els.content.innerHTML = `
        <h2>照片</h2>
        <label class="field">上傳照片
          <input id="photoUpload" type="file" accept="image/*" />
        </label>
        <div class="panel" style="box-shadow:none;padding:14px;margin-top:14px;background:#f8fafc">
          <div style="font-weight:800;margin-bottom:10px">目前戰報使用圖片</div>
          <img id="activePlayerPhotoPreview" alt="目前球員照片" style="display:block;width:min(100%,360px);aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:#0a1d2a" />
          <div id="activePlayerPhotoLabel" class="subtle" style="margin-top:8px">${selectedPhoto ? '自訂照片' : `${defaultRoleLabel}｜尚未上傳照片，自動套用`}</div>
        </div>
        ${selectedPhoto ? `
'''
if s.count(old_start) != 1:
    raise SystemExit(f'renderPhotos start count={s.count(old_start)}')
s = s.replace(old_start, new_start, 1)

upload_listener_anchor = "      document.getElementById('photoUpload').addEventListener('change', async event => {\n"
if s.count(upload_listener_anchor) != 1:
    raise SystemExit(f'photo upload listener anchor count={s.count(upload_listener_anchor)}')
preview_code = r'''      const activePreview = document.getElementById('activePlayerPhotoPreview');
      if (activePreview) {
        if (selectedPhoto?.blob) {
          const url = URL.createObjectURL(selectedPhoto.blob);
          activePreview.src = url;
          activePreview.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
          activePreview.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            activePreview.src = defaultRolePhotoUrl(defaultRole);
            const label = document.getElementById('activePlayerPhotoLabel');
            if (label) label.textContent = `${defaultRoleLabel}｜自訂照片讀取失敗，已自動套用`;
          }, { once: true });
        } else {
          activePreview.src = defaultRolePhotoUrl(defaultRole);
        }
      }

'''
s = s.replace(upload_listener_anchor, preview_code + upload_listener_anchor, 1)

old_empty = r'''      if (!ownedPhotos.length) {
        grid.innerHTML = '';
        return;
      }
'''
new_empty = r'''      if (!ownedPhotos.length) {
        const role = effectiveDefaultPhotoRole(player);
        const roleLabel = role === 'pitcher' ? '預設投手圖' : '預設打者圖';
        grid.innerHTML = `
          <div class="photo-card selected default-photo-card">
            <img src="${escapeAttr(defaultRolePhotoUrl(role))}" alt="${roleLabel}" />
            <div class="subtle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${roleLabel}</div>
            <div class="subtle">沒有上傳照片時會自動使用這張。</div>
          </div>`;
        return;
      }
'''
if s.count(old_empty) != 1:
    raise SystemExit(f'empty photo grid block count={s.count(old_empty)}')
s = s.replace(old_empty, new_empty, 1)
p.write_text(s, encoding='utf-8')

# 6) Versioned HTML shell.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.09' not in s:
    raise SystemExit('index v2.09 wiring not found')
s = s.replace('v2.09', 'v2.10')
p.write_text(s, encoding='utf-8')

# 7) PWA cache refresh and explicit preload of both fallback images.
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if "baseball-player-card-pwa-v126" not in s:
    raise SystemExit('service worker cache v126 not found')
s = s.replace('baseball-player-card-pwa-v126', 'baseball-player-card-pwa-v127', 1)
s = s.replace('v2.09', 'v2.10')
for required in ["./assets/default-hitter.jpg?v=v2.10", "./assets/default-pitcher.jpg?v=v2.10"]:
    if required not in s:
        raise SystemExit(f'missing service worker asset: {required}')
p.write_text(s, encoding='utf-8')

# 8) Build the deterministic runtime bundle from the 24 modules.
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 9) Archive policy: current + previous only.
(ROOT / 'index v2.10.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.08.html'
if old_archive.exists():
    old_archive.unlink()
if not (ROOT / 'index v2.09.html').exists():
    raise SystemExit('previous archive index v2.09.html missing')

print('v2.10 global default player photo patch applied')
