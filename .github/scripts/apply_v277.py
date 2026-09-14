from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


# app.js: expose current page plus known one-/two-team career years.
p = Path("app.js")
s = p.read_text(encoding="utf-8")
old = "    window.__getPlayerContext = () => ({ player:selectedPlayer(), selectedSeason, selectedTab });"
new = """    window.__getPlayerContext = () => {
      const player = selectedPlayer();
      return {
        player,
        selectedSeason,
        selectedTab,
        currentPage,
        careerYears: player ? {
          A: availableSeasonYears(player, 'A'),
          D: availableSeasonYears(player, 'D')
        } : { A:[], D:[] }
      };
    };"""
s = replace_once(s, old, new, "player context bridge")
p.write_text(s, encoding="utf-8")


# postseason-history.js: use A + D years and warm postseason availability silently.
p = Path("postseason-history.js")
s = p.read_text(encoding="utf-8")
old = """  function rememberCandidateYears(ctx, league) {
    if (!ctx?.player || !league) return [];
    const key = playerKey(ctx, league);
    const visible = readVisibleYears();
    const prior = candidateYearsCache.get(key) || [];
    const merged = [...new Set([...prior, ...visible, Number(ctx.selectedSeason)])]
      .filter(year => Number.isInteger(year) && year >= 1990 && year <= 2100)
      .sort((a,b) => b-a);
    if (merged.length) candidateYearsCache.set(key, merged);
    return merged;
  }"""
new = """  function rememberCandidateYears(ctx, league) {
    if (!ctx?.player || !league) return [];
    const key = playerKey(ctx, league);
    const visible = readVisibleYears();
    const major = Array.isArray(ctx?.careerYears?.A) ? ctx.careerYears.A : [];
    const minor = Array.isArray(ctx?.careerYears?.D) ? ctx.careerYears.D : [];
    const prior = candidateYearsCache.get(key) || [];
    const merged = [...new Set([...prior, ...major, ...minor, ...visible, Number(ctx.selectedSeason)])]
      .map(Number)
      .filter(year => Number.isInteger(year) && year >= 1990 && year <= 2100)
      .sort((a,b) => b-a);
    if (merged.length) candidateYearsCache.set(key, merged);
    return merged;
  }"""
s = replace_once(s, old, new, "candidate year union")

s = replace_once(
    s,
    "  async function scanPostseasonYears(ctx, league, candidates) {",
    "  async function scanPostseasonYears(ctx, league, candidates, silent = false) {",
    "silent scan signature",
)
s = replace_once(
    s,
    "    showYearScanProgress(0, candidates.length);",
    "    if (!silent) showYearScanProgress(0, candidates.length);",
    "silent scan initial progress",
)
s = replace_once(
    s,
    "          showYearScanProgress(done, candidates.length);",
    "          if (!silent) showYearScanProgress(done, candidates.length);",
    "silent scan incremental progress",
)

start = s.index("  async function preparePostseasonYears(ctx, league) {")
end = s.index("\n  function statGrid(", start)
replacement = """  async function preparePostseasonYears(ctx, league, { background = false } = {}) {
    const key = playerKey(ctx, league);
    let candidates = candidateYearsCache.get(key) || [];
    const refreshedCandidates = rememberCandidateYears(ctx, league);
    if (refreshedCandidates.length) candidates = refreshedCandidates;

    if (!candidates.length) {
      if (!background) applyYearOptions(ctx, league, []);
      return { year:0, failures:[] };
    }

    if (validYearsCache.has(key)) {
      const years = validYearsCache.get(key) || [];
      return {
        year: background ? 0 : applyYearOptions(ctx, league, years),
        failures:[]
      };
    }

    if (!scanPromises.has(key)) {
      const mySeq = ++scanSeq;
      const promise = scanPostseasonYears(ctx, league, candidates, background)
        .then(result => {
          if (mySeq !== scanSeq && getContext()?.selectedTab !== 'postseason') return result;
          validYearsCache.set(key, result.years);
          return result;
        })
        .finally(() => scanPromises.delete(key));
      scanPromises.set(key, promise);
    }

    const result = await scanPromises.get(key);
    if (background) return { year:0, failures:result?.failures || [] };

    const fresh = getContext();
    if (!fresh?.player || fresh.selectedTab !== 'postseason' || playerKey(fresh, league) !== key) {
      return { year:0, failures:result?.failures || [] };
    }
    const year = applyYearOptions(fresh, league, result?.years || []);
    return { year, failures:result?.failures || [] };
  }
"""
s = s[:start] + replacement + s[end:]

old = """    if (ctx.selectedTab !== 'postseason') {
      rememberCandidateYears(ctx, league);
      setMode(false);
      return;
    }

    void openPostseason(ctx, league);"""
new = """    if (ctx.selectedTab !== 'postseason') {
      rememberCandidateYears(ctx, league);
      setMode(false);
      if (ctx.currentPage === 'player') {
        // Validate postseason seasons immediately after entering a player page.
        // This is silent and never replaces the current A/D page with scan progress.
        void preparePostseasonYears(ctx, league, { background:true });
      }
      return;
    }

    void openPostseason(ctx, league);"""
s = replace_once(s, old, new, "background warm on player page")
p.write_text(s, encoding="utf-8")


# Bump active browser/PWA assets to v2.77.
files = [
    "app.js", "index.html", "service-worker.js", "styles.css",
    "live-static-update.js", "cpbl-realtime.js", "npb-realtime.js",
    "postseason-history.js", "postseason-history.css", "cpbl-cache-router.js",
    "game-detail-enhancement.js", "game-detail-enhancement.css",
    "report-layout.js", "report-layout.css", "landscape-state.js", "landscape-state.css",
    "manifest.webmanifest", "rescue.html",
]
for name in files:
    q = Path(name)
    if not q.exists():
        continue
    text = q.read_text(encoding="utf-8")
    text = text.replace("v2.76", "v2.77").replace("v276", "v277").replace("V276", "V277")
    q.write_text(text, encoding="utf-8")

Path("version.json").write_text('{"version":"v2.77"}\n', encoding="utf-8")
