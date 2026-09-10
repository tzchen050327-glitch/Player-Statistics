# JavaScript architecture — v2.06

`js/` is the maintainable source. Files are intentionally ordered and must be concatenated in `module-order.txt` order.

The live page loads the generated `app.js` bundle instead of executing every source file separately. This is deliberate: it preserves the exact hoisting and global lexical semantics of the original single-script application while still allowing the source to be maintained by feature area.

**Do not edit `app.js` as the primary source.** Edit the appropriate file in `js/`, then run `python3 scripts/build-app.py`. CI verifies that the committed bundle is exactly reproducible from the module source and also runs syntax, version-wiring, regression-guard and browser smoke checks.

## Source modules

- `00-core-config.js` — version/config, DOM references, global state, sync metadata and special-record normalization.
- `01-catalogs.js` — league/tournament/team/template catalogs and static configuration.
- `02-core-helpers.js` — shared display/template/opponent helpers.
- `03-provider-us.js` — provider HTTP clients and MLB/MiLB career helpers.
- `04-provider-season.js` — normalized season stat conversion and overseas season synchronization.
- `05-provider-international.js` — international tournament totals and per-game synchronization.
- `06-provider-cpbl.js` — CPBL roster/history/season/daily synchronization.
- `07-storage.js` — IndexedDB persistence, game record loading/saving and player stat profiles.
- `08-stats-search.js` — stat derivation, PA localization, dialogs, status and player search.
- `09-player-navigation.js` — player selection and season/level switching.
- `10-batch-reports.js` — batch report data retrieval and generation.
- `11-home-international.js` — home filters, international explorer and archived international games.
- `12-player-pages.js` — season/role/player settings views.
- `13-daily-editor.js` — hitter/pitcher daily record editors and dependency rules.
- `14-photo-template-ui.js` — photo/template UI and template preview rendering.
- `15-render-controller.js` — page rendering controller and game commit helpers.
- `16-daily-canvas.js` — primary daily report canvas renderer and styled card primitives.
- `17-canvas-backgrounds.js` — scoreboard/stadium/bullpen/background drawing.
- `18-canvas-utils.js` — photo-frame/canvas/image/tag utilities.
- `19-forms-events.js` — add-player forms, pickers, dialogs, event wiring and photo interaction.
- `20-output-core.js` — output role/file-name helpers.
- `21-annual-report.js` — annual report canvas and capture flow.
- `22-output-actions.js` — prepared-output generation/download/share actions.
- `23-bootstrap.js` — initialization, update checks and application boot.

## Build

Run `python3 scripts/build-app.py`. The build is deterministic and reconstructs `app.js` from the source modules. The live `index.html` carries an `app-version` meta value so the update checker can still detect new versions after the HTML/JavaScript split.

## Rollback

- Stable pre-deep-split branch: `rollback-v2.05-pre-deep-split`
- Monolithic preserved file: `index v2.04 monolith.html`
- Modularization branch: `modularize-v2.06`
