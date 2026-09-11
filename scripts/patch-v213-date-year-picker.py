from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# 1) Element registry + version.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.12';" not in s:
    raise SystemExit('expected v2.12 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.12';", "const APP_VERSION = 'v2.13';", 1)
s = s.replace('?v=v2.12', '?v=v2.13')
old = """      datePickerDialog: document.getElementById('datePickerDialog'),
      datePickerGrid: document.getElementById('datePickerGrid'),
      datePickerMonthLabel: document.getElementById('datePickerMonthLabel'),
      datePickerPrev: document.getElementById('datePickerPrev'),
"""
new = """      datePickerDialog: document.getElementById('datePickerDialog'),
      datePickerBody: document.getElementById('datePickerBody'),
      datePickerGrid: document.getElementById('datePickerGrid'),
      datePickerWeekdays: document.getElementById('datePickerWeekdays'),
      datePickerMonthLabel: document.getElementById('datePickerMonthLabel'),
      datePickerYearButton: document.getElementById('datePickerYearButton'),
      datePickerYearLabel: document.getElementById('datePickerYearLabel'),
      datePickerYearGrid: document.getElementById('datePickerYearGrid'),
      datePickerPrev: document.getElementById('datePickerPrev'),
"""
if s.count(old) != 1:
    raise SystemExit('date picker element registry anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 2) Date picker HTML: year button lives inside the existing month bar and keeps the same visual language.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.12' not in s:
    raise SystemExit('expected v2.12 index wiring')
old = """      <div class=\"app-date-picker-body\">
        <div class=\"app-date-monthbar\">
          <button id=\"datePickerPrev\" class=\"app-date-nav\" type=\"button\" aria-label=\"上個月\">‹</button>
          <div id=\"datePickerMonthLabel\" class=\"app-date-month-label\"></div>
          <button id=\"datePickerNext\" class=\"app-date-nav\" type=\"button\" aria-label=\"下個月\">›</button>
        </div>
        <div class=\"app-date-weekdays\" aria-hidden=\"true\">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div id=\"datePickerGrid\" class=\"app-date-grid\" role=\"grid\" aria-label=\"日期\"></div>
        <div class=\"app-date-footer\">
          <button id=\"datePickerToday\" class=\"press-btn app-date-today\" type=\"button\">今天</button>
        </div>
      </div>
"""
new = """      <div id=\"datePickerBody\" class=\"app-date-picker-body\">
        <div class=\"app-date-monthbar\">
          <button id=\"datePickerPrev\" class=\"app-date-nav\" type=\"button\" aria-label=\"上個月\">‹</button>
          <div class=\"app-date-heading\">
            <button id=\"datePickerYearButton\" class=\"app-date-year-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-controls=\"datePickerYearGrid\">
              <span id=\"datePickerYearLabel\">年份</span>
              <svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"m7 9 5 5 5-5\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>
            </button>
            <div id=\"datePickerMonthLabel\" class=\"app-date-month-label\"></div>
          </div>
          <button id=\"datePickerNext\" class=\"app-date-nav\" type=\"button\" aria-label=\"下個月\">›</button>
        </div>
        <div id=\"datePickerYearGrid\" class=\"app-date-year-grid hidden\" role=\"listbox\" aria-label=\"年份\"></div>
        <div id=\"datePickerWeekdays\" class=\"app-date-weekdays\" aria-hidden=\"true\">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div id=\"datePickerGrid\" class=\"app-date-grid\" role=\"grid\" aria-label=\"日期\"></div>
        <div class=\"app-date-footer\">
          <button id=\"datePickerToday\" class=\"press-btn app-date-today\" type=\"button\">今天</button>
        </div>
      </div>
"""
if s.count(old) != 1:
    raise SystemExit('date picker HTML block not found')
s = s.replace(old, new, 1)
s = s.replace('v2.12', 'v2.13')
p.write_text(s, encoding='utf-8')

# 3) Date picker behavior: click the year to switch to a custom year grid, select once, keep the current month.
p = ROOT / 'js' / '19-forms-events.js'
s = p.read_text(encoding='utf-8')
old = """    let activeAllFilterSelect = null;
    let appToastTimer = null;
    let datePickerView = null;
"""
new = """    let activeAllFilterSelect = null;
    let appToastTimer = null;
    let datePickerView = null;
    let datePickerYearMode = false;
"""
if s.count(old) != 1:
    raise SystemExit('date picker state anchor not found')
s = s.replace(old, new, 1)

old = """    function renderDatePicker() {
      if (!els.datePickerGrid || !els.datePickerMonthLabel) return;
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      if (!(datePickerView instanceof Date) || !Number.isFinite(datePickerView.getTime())) {
        datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }

      const year = datePickerView.getFullYear();
      const month = datePickerView.getMonth();
      els.datePickerMonthLabel.textContent = `${year} 年 ${month + 1} 月`;

      const firstDay = new Date(year, month, 1).getDay();
"""
new = """    function renderDatePickerYearGrid() {
      if (!els.datePickerYearGrid || !(datePickerView instanceof Date)) return;
      const activeYear = datePickerView.getFullYear();
      const minYear = Math.min(1990, activeYear);
      const maxYear = Math.max(CURRENT_YEAR, activeYear);
      const years = [];
      for (let year = maxYear; year >= minYear; year--) years.push(year);

      els.datePickerYearGrid.innerHTML = years.map(year => {
        const active = year === activeYear;
        return `<button class=\"app-date-year-option ${active ? 'is-selected' : ''}\" type=\"button\" role=\"option\" data-picker-year=\"${year}\" aria-selected=\"${active}\">${year}</button>`;
      }).join('');

      els.datePickerYearGrid.querySelectorAll('[data-picker-year]').forEach(button => {
        button.addEventListener('click', () => {
          const year = Number(button.dataset.pickerYear);
          if (!Number.isInteger(year) || !(datePickerView instanceof Date)) return;
          datePickerView = new Date(year, datePickerView.getMonth(), 1);
          datePickerYearMode = false;
          renderDatePicker();
        });
      });

      requestAnimationFrame(() => {
        els.datePickerYearGrid?.querySelector('.is-selected')?.scrollIntoView({ block:'center' });
      });
    }

    function syncDatePickerMode() {
      els.datePickerBody?.classList.toggle('is-year-mode', datePickerYearMode);
      els.datePickerYearGrid?.classList.toggle('hidden', !datePickerYearMode);
      els.datePickerWeekdays?.classList.toggle('hidden', datePickerYearMode);
      els.datePickerGrid?.classList.toggle('hidden', datePickerYearMode);
      els.datePickerYearButton?.setAttribute('aria-expanded', String(datePickerYearMode));
      if (datePickerYearMode) renderDatePickerYearGrid();
    }

    function renderDatePicker() {
      if (!els.datePickerGrid || !els.datePickerMonthLabel) return;
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      if (!(datePickerView instanceof Date) || !Number.isFinite(datePickerView.getTime())) {
        datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }

      const year = datePickerView.getFullYear();
      const month = datePickerView.getMonth();
      if (els.datePickerYearLabel) els.datePickerYearLabel.textContent = `${year} 年`;
      els.datePickerMonthLabel.textContent = `${month + 1} 月`;
      syncDatePickerMode();

      const firstDay = new Date(year, month, 1).getDay();
"""
if s.count(old) != 1:
    raise SystemExit('renderDatePicker anchor not found')
s = s.replace(old, new, 1)

old = """    function openDatePicker() {
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderDatePicker();
      if (els.datePickerDialog && !els.datePickerDialog.open) els.datePickerDialog.showModal();
    }
"""
new = """    function openDatePicker() {
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      datePickerYearMode = false;
      renderDatePicker();
      if (els.datePickerDialog && !els.datePickerDialog.open) els.datePickerDialog.showModal();
    }
"""
if s.count(old) != 1:
    raise SystemExit('openDatePicker anchor not found')
s = s.replace(old, new, 1)

old = """    els.gameDateButton?.addEventListener('click', openDatePicker);
    els.datePickerPrev?.addEventListener('click', () => {
"""
new = """    els.gameDateButton?.addEventListener('click', openDatePicker);
    els.datePickerYearButton?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerYearMode = !datePickerYearMode;
      syncDatePickerMode();
    });
    els.datePickerPrev?.addEventListener('click', () => {
"""
if s.count(old) != 1:
    raise SystemExit('date picker listener anchor not found')
s = s.replace(old, new, 1)

# Choosing previous/next month always returns to the calendar view.
s = s.replace(
"""      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() - 1, 1);
      renderDatePicker();
""",
"""      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() - 1, 1);
      datePickerYearMode = false;
      renderDatePicker();
""", 1)
s = s.replace(
"""      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() + 1, 1);
      renderDatePicker();
""",
"""      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() + 1, 1);
      datePickerYearMode = false;
      renderDatePicker();
""", 1)
p.write_text(s, encoding='utf-8')

# 4) Styling: same navy + gold picker language; year view replaces calendar cells inside the same dialog.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
old = """.app-date-month-label{
  color:#173754;
  font-size:17px;
  font-weight:950;
  text-align:center;
  font-variant-numeric:tabular-nums;
  letter-spacing:.03em;
}
"""
new = """.app-date-heading{
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
}
.app-date-year-trigger{
  min-height:36px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:5px;
  padding:6px 9px 6px 11px;
  border:1px solid #d6e0e9;
  border-radius:10px;
  background:linear-gradient(180deg,#fff,#f7f9fc);
  color:#153b62;
  font-size:15px;
  font-weight:950;
  font-variant-numeric:tabular-nums;
  box-shadow:0 3px 9px rgba(17,38,66,.05);
}
.app-date-year-trigger:hover,
.app-date-year-trigger[aria-expanded=\"true\"]{
  border-color:#d8bb73;
  background:#fffaf0;
  color:#76551b;
}
.app-date-year-trigger svg{
  width:15px;
  height:15px;
  color:#a0782a;
  transition:transform .15s ease;
}
.app-date-year-trigger[aria-expanded=\"true\"] svg{transform:rotate(180deg);}
.app-date-month-label{
  min-width:44px;
  color:#173754;
  font-size:17px;
  font-weight:950;
  text-align:center;
  font-variant-numeric:tabular-nums;
  letter-spacing:.03em;
}
.app-date-year-grid{
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:7px;
  min-height:282px;
  max-height:282px;
  overflow-y:auto;
  padding:5px 3px 6px;
  overscroll-behavior:contain;
  scrollbar-width:thin;
}
.app-date-year-grid:not(.hidden){display:grid;}
.app-date-year-option{
  min-height:46px;
  padding:7px 5px;
  border:1px solid #dce4ec;
  border-radius:11px;
  background:linear-gradient(180deg,#fff,#f7f9fc);
  color:#31475e;
  font-size:13px;
  font-weight:950;
  font-variant-numeric:tabular-nums;
  box-shadow:0 3px 8px rgba(17,38,66,.045);
}
.app-date-year-option:hover{
  border-color:#c7d4e1;
  background:#f1f6fb;
}
.app-date-year-option.is-selected{
  border-color:#123f6d;
  background:linear-gradient(145deg,#174f86,#0c3156);
  color:#fff;
  box-shadow:0 5px 13px rgba(18,63,109,.20),inset 0 -3px #c79a39;
}
.app-date-picker-body.is-year-mode .app-date-nav{
  opacity:.42;
}
"""
if s.count(old) != 1:
    raise SystemExit('date picker CSS anchor not found')
s = s.replace(old, new, 1)

old = """  .app-date-nav{width:38px;height:38px;border-radius:10px;}
  .app-date-month-label{font-size:16px;}
  .app-date-weekdays,.app-date-grid{gap:3px;}
"""
new = """  .app-date-nav{width:38px;height:38px;border-radius:10px;}
  .app-date-heading{gap:5px;}
  .app-date-year-trigger{min-height:34px;padding:5px 6px 5px 8px;font-size:13px;}
  .app-date-year-trigger svg{width:13px;height:13px;}
  .app-date-month-label{min-width:38px;font-size:15px;}
  .app-date-year-grid{grid-template-columns:repeat(3,minmax(0,1fr));min-height:258px;max-height:258px;gap:5px;}
  .app-date-year-option{min-height:43px;font-size:12px;}
  .app-date-weekdays,.app-date-grid{gap:3px;}
"""
if s.count(old) != 1:
    raise SystemExit('mobile date picker CSS anchor not found')
s = s.replace(old, new, 1)
s += "\n/* ===== v2.13 DATE YEAR PICKER ===== */\n"
p.write_text(s, encoding='utf-8')

# 5) PWA cache version + static asset cache busting.
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if "baseball-player-card-pwa-v129" not in s:
    raise SystemExit('expected service worker cache v129')
s = s.replace('baseball-player-card-pwa-v129', 'baseball-player-card-pwa-v130', 1)
s = s.replace('v2.12', 'v2.13')
p.write_text(s, encoding='utf-8')

# 6) Rebuild deterministic bundle.
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 7) Archive policy: current + previous only.
(ROOT / 'index v2.13.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.11.html'
if old_archive.exists():
    old_archive.unlink()
if not (ROOT / 'index v2.12.html').exists():
    raise SystemExit('index v2.12.html must remain as previous version')

print('v2.13 date year picker applied')
