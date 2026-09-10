# JavaScript structure (v2.06)

The previous monolithic `app.js` is split without reordering code. The scripts load in this exact order:

1. `core.js` — version/config, DOM references, global state, shared constants/helpers.
2. `providers.js` — CPBL/MLB/MiLB/NPB/KBO/international data fetching and synchronization.
3. `storage-stats.js` — IndexedDB, player/game persistence, stat derivation, search/message helpers.
4. `player-ui.js` — player selection, season/level switching, player pages, batch reports, daily editors.
5. `report-canvas.js` — daily report canvas rendering, backgrounds, image/frame drawing.
6. `forms.js` — add-player flows, pickers, dialogs, photo interaction and form/event wiring.
7. `output.js` — annual-season output and prepared download/share generation.
8. `bootstrap.js` — initialization, update checks and application boot.

Rollback baseline: branch `rollback-v2.05-pre-deep-split`.
Work branch: `modularize-v2.06`.
