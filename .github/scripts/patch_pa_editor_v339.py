import json, re
from pathlib import Path

p = Path('js/13-daily-editor.js')
s = p.read_text(encoding='utf-8')

old = '''          <h3 style="margin-top:0">第 ${currentRecord.hitterPAs.length + 1} 打席</h3>'''
new = '''          <h3 id="paFormHeading" style="margin-top:0">第 ${currentRecord.hitterPAs.length + 1} 打席</h3>'''
if old not in s: raise SystemExit('PA heading not found')
s = s.replace(old, new, 1)

old = '''          <div class="section-actions">
            <button id="confirmPaBtn" class="press-btn primary">確定此打席</button>
          </div>'''
new = '''          <div class="section-actions">
            <button id="confirmPaBtn" class="press-btn primary">確定此打席</button>
            <button id="cancelPaEditBtn" class="press-btn hidden" type="button">取消編輯</button>
          </div>'''
if old not in s: raise SystemExit('PA action buttons not found')
s = s.replace(old, new, 1)

old = '''        const out = [
          ['K','三振'],['GO','滾地出局'],['FO','飛球出局'],['FO::內飛','內飛'],['FO::界飛','界飛'],
          ['DP','雙殺'],['TP','三殺'],'''
new = '''        const out = [
          ['K','三振'],
          ['GO::投滾','投滾'],['GO::捕滾','捕滾'],['GO::一滾','一滾'],['GO::二滾','二滾'],['GO::三滾','三滾'],['GO::游滾','游滾'],['GO::左滾','左滾'],['GO::中滾','中滾'],['GO::右滾','右滾'],
          ['FO::投飛','投飛'],['FO::捕飛','捕飛'],['FO::一飛','一飛'],['FO::二飛','二飛'],['FO::三飛','三飛'],['FO::游飛','游飛'],['FO::左飛','左飛'],['FO::中飛','中飛'],['FO::右飛','右飛'],
          ['FO::內飛','內飛'],['FO::界飛','界飛'],
          ['FO::投邪飛','投邪飛'],['FO::捕邪飛','捕邪飛'],['FO::一邪飛','一邪飛'],['FO::二邪飛','二邪飛'],['FO::三邪飛','三邪飛'],['FO::游邪飛','游邪飛'],['FO::左邪飛','左邪飛'],['FO::右邪飛','右邪飛'],
          ['DP','雙殺'],['TP','三殺'],'''
if old not in s: raise SystemExit('out result list not found')
s = s.replace(old, new, 1)

old = '''      const rbi = document.getElementById('paRbi');

      function selectedPaParts() {'''
new = '''      const rbi = document.getElementById('paRbi');
      let editingPaIndex = -1;

      function selectedPaParts() {'''
if old not in s: raise SystemExit('PA form vars not found')
s = s.replace(old, new, 1)

old = '''        currentRecord.hitterPAs.push({
          id: uid(), code,
          position: ((code === 'GO' || code === 'FO') && !officialAction) ? pos.value : '',
          rbi: rbiValue,
          cpblOfficialAction: officialAction
        });
        await saveRecord();
        renderAll();'''
new = '''        const existing = editingPaIndex >= 0 ? currentRecord.hitterPAs[editingPaIndex] : null;
        const nextPa = {
          id: existing?.id || uid(), code,
          position: ((code === 'GO' || code === 'FO') && !officialAction) ? pos.value : '',
          rbi: rbiValue,
          cpblOfficialAction: officialAction
        };
        if (editingPaIndex >= 0 && existing) currentRecord.hitterPAs.splice(editingPaIndex, 1, nextPa);
        else currentRecord.hitterPAs.push(nextPa);
        await saveRecord();
        renderAll();'''
if old not in s: raise SystemExit('PA confirm save block not found')
s = s.replace(old, new, 1)

old = '''      host.querySelectorAll('[data-edit-pa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = Number(btn.dataset.editPa);
          const pa = currentRecord.hitterPAs[index];
          currentRecord.hitterPAs.splice(index, 1);
          await saveRecord();
          renderAll();
          setTimeout(() => fillPaForm(pa), 0);
        });
      });'''
new = '''      host.querySelectorAll('[data-edit-pa]').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = Number(btn.dataset.editPa);
          const pa = currentRecord.hitterPAs[index];
          if (!pa) return;
          editingPaIndex = index;
          fillPaForm(pa);
          const heading = document.getElementById('paFormHeading');
          const confirm = document.getElementById('confirmPaBtn');
          const cancel = document.getElementById('cancelPaEditBtn');
          if (heading) heading.textContent = `編輯第 ${index + 1} 打席`;
          if (confirm) confirm.textContent = '儲存修改';
          cancel?.classList.remove('hidden');
          heading?.scrollIntoView({ behavior:'smooth', block:'center' });
        });
      });

      document.getElementById('cancelPaEditBtn')?.addEventListener('click', () => {
        editingPaIndex = -1;
        renderHitterToday();
      });'''
if old not in s: raise SystemExit('PA edit handler not found')
s = s.replace(old, new, 1)

old = '''      const officialValue = pa.cpblOfficialAction ? `${pa.code}::${pa.cpblOfficialAction}` : pa.code;
      result.value = Array.from(result.options).some(option => option.value === officialValue) ? officialValue : pa.code;
      result.dispatchEvent(new Event('change'));
      const pos = document.getElementById('paPosition');
      if (pos && pa.position) pos.value = pa.position;'''
new = '''      let officialValue = pa.cpblOfficialAction ? `${pa.code}::${pa.cpblOfficialAction}` : pa.code;
      if (!pa.cpblOfficialAction && pa.position && (pa.code === 'GO' || pa.code === 'FO')) {
        officialValue = `${pa.code}::${pa.position}${pa.code === 'GO' ? '滾' : '飛'}`;
      }
      const hasOfficialValue = Array.from(result.options).some(option => option.value === officialValue);
      if (!hasOfficialValue && pa.cpblOfficialAction) {
        result.add(new Option(pa.cpblOfficialAction, officialValue));
      }
      if (Array.from(result.options).some(option => option.value === officialValue)) {
        result.value = officialValue;
      } else {
        const sameCode = Array.from(result.options).find(option => option.value === pa.code || option.value.startsWith(`${pa.code}::`));
        if (sameCode) result.value = sameCode.value;
      }
      result.dispatchEvent(new Event('change'));
      const pos = document.getElementById('paPosition');
      if (pos && pa.position) pos.value = pa.position;'''
if old not in s: raise SystemExit('fillPaForm selection block not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

data = json.loads(Path('version.json').read_text(encoding='utf-8'))
oldv = str(data['version'])
m = re.fullmatch(r'v(\d+)\.(\d+)', oldv)
if not m: raise SystemExit(f'unsupported version {oldv}')
newv = f'v{int(m.group(1))}.{int(m.group(2))+1}'
if newv != 'v3.39': raise SystemExit(f'expected v3.39 from {oldv}, got {newv}')
cache_tag = newv.replace('.', '')
Path('version.json').write_text(json.dumps({'version':newv}, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')

order = [x.strip() for x in Path('js/module-order.txt').read_text(encoding='utf-8').splitlines() if x.strip()]
found = 0
for name in order:
    q = Path('js') / name
    text = q.read_text(encoding='utf-8')
    text, n = re.subn(r"const APP_VERSION = 'v\d+\.\d+';", f"const APP_VERSION = '{newv}';", text)
    found += n
    text = re.sub(r'\?v=v\d+\.\d+', f'?v={newv}', text)
    q.write_text(text, encoding='utf-8')
if found != 1: raise SystemExit(f'expected one APP_VERSION, found {found}')

q = Path('index.html')
text = q.read_text(encoding='utf-8')
text, n = re.subn(r'(<meta\s+name="app-version"\s+content=")v\d+\.\d+("\s*/?>)', rf'\g<1>{newv}\2', text, count=1)
text = re.sub(r'\?v=v\d+\.\d+', f'?v={newv}', text)
text = re.sub(r'(id="appVersionBadge"[^>]*>)v\d+\.\d+(</button>)', rf'\g<1>{newv}\2', text, count=1)
if not n: raise SystemExit('app-version meta not found')
q.write_text(text, encoding='utf-8')

q = Path('service-worker.js')
text = q.read_text(encoding='utf-8')
text = re.sub(r'\?v=v\d+\.\d+', f'?v={newv}', text)
text = re.sub(r"const CACHE_NAME = '[^']+';", f"const CACHE_NAME = 'baseball-player-card-pwa-{cache_tag}-auto';", text, count=1)
q.write_text(text, encoding='utf-8')
print(f'{oldv} -> {newv}')
