from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# 1) Version + default art URLs
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
old = "    const APP_VERSION = 'v2.08';"
new = "    const APP_VERSION = 'v2.09';"
assert s.count(old) == 1, f'APP_VERSION occurrence: {s.count(old)}'
s = s.replace(old, new)
anchor = "    const BASEBALL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';\n"
assert s.count(anchor) == 1, f'BASEBALL_API_URL anchor occurrence: {s.count(anchor)}'
s = s.replace(anchor, anchor + "    const DEFAULT_HITTER_PHOTO_URL = './assets/default-hitter.jpg?v=v2.09';\n    const DEFAULT_PITCHER_PHOTO_URL = './assets/default-pitcher.jpg?v=v2.09';\n")
p.write_text(s, encoding='utf-8')

# 2) Shared default-photo helpers
p = ROOT / 'js' / '18-canvas-utils.js'
s = p.read_text(encoding='utf-8')
marker = "\n    function drawPhotoPlaceholderFrame(ctx, frame) {"
assert s.count(marker) == 1, f'placeholder marker occurrence: {s.count(marker)}'
helpers = r'''

    function defaultRolePhotoUrl(role) {
      return role === 'pitcher' ? DEFAULT_PITCHER_PHOTO_URL : DEFAULT_HITTER_PHOTO_URL;
    }

    function getDefaultRolePhotoImage(role) {
      return loadEmbeddedImage(defaultRolePhotoUrl(role));
    }

    function drawStaticPhotoImageInFrame(ctx, img, frame) {
      const { x, y, w, h } = frame;
      const scale = Math.max(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
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
'''
s = s.replace(marker, helpers + marker)
p.write_text(s, encoding='utf-8')

# 3) Daily / per-game report fallback image
p = ROOT / 'js' / '16-daily-canvas.js'
s = p.read_text(encoding='utf-8')
old = r'''      // 區塊 4：照片
      const frame = layout.photo;
      drawPhotoFrameBase(ctx, frame);
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      if (photo) {
        try {
          const image = await getPhotoImage(photo);
          if (token !== renderToken) return;
          const transform = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
          player.photoTransforms[photo.id] = transform;
          drawPhotoImageInFrame(ctx, image, frame, transform);
        } catch {
          drawPhotoPlaceholderFrame(ctx, frame);
        }
      } else {
        drawPhotoPlaceholderFrame(ctx, frame);
      }
'''
new = r'''      // 區塊 4：照片。未上傳球員照時依目前角色使用預設打者／投手圖。
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
assert s.count(old) == 1, f'daily photo block occurrence: {s.count(old)}'
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# 4) Annual / tournament-total report fallback image
p = ROOT / 'js' / '21-annual-report.js'
s = p.read_text(encoding='utf-8')
start_token = "      const photo=photos.find(p=>p.id===player.selectedPhotoId && p.playerId===player.id);"
start = s.find(start_token)
assert start >= 0, 'annual photo start not found'
end_token = "\n\n      const plate={x:674,y:842,w:368,h:120};"
end = s.find(end_token, start)
assert end >= 0, 'annual photo end not found'
old = s[start:end]
new = r'''      const photo=photos.find(p=>p.id===player.selectedPhotoId && p.playerId===player.id);
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
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')

# 5) Versioned HTML wiring
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
assert 'v2.08' in s, 'index v2.08 wiring not found'
s = s.replace('v2.08', 'v2.09')
s = s.replace('>v2.05</button>', '>v2.09</button>')
p.write_text(s, encoding='utf-8')

# 6) PWA cache + preload fallback artwork
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
assert "baseball-player-card-pwa-v125" in s, 'service worker cache v125 not found'
s = s.replace('baseball-player-card-pwa-v125', 'baseball-player-card-pwa-v126')
s = s.replace('v2.08', 'v2.09')
old = "  './icon-192.png',\n  './icon-512.png'\n"
new = "  './icon-192.png',\n  './icon-512.png',\n  './assets/default-hitter.jpg?v=v2.09',\n  './assets/default-pitcher.jpg?v=v2.09'\n"
assert s.count(old) == 1, f'service worker icon block occurrence: {s.count(old)}'
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# 7) Build deterministic runtime bundle
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 8) Archive current version and keep only current + previous archived HTML
archive = ROOT / 'index v2.09.html'
archive.write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.07.html'
if old_archive.exists():
    old_archive.unlink()

print('v2.09 default hitter/pitcher artwork patch applied')
