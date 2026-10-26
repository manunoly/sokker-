# Synthetic browser checks

Run `node scripts/browser-check/server.mjs` from the repository root, then open the printed localhost URL. `--build-only` compiles without starting a server; `SOKKER_CHECK_PORT` overrides port 4174. Builds are written under the ignored `node_modules/.cache/sokker-browser-check` directory.

The page uses production DOM scanners, bindings, tooltip cards and Canvas/PNG/CSV code, plus the small synthetic beta fixtures. Its isolated `chrome.runtime` port stub supplies synthetic player/junior history and current-week metadata. It rejects writes and unknown operations; CSP and a fetch guard block external network requests. It never starts content bootstrap, migration, the actual background worker or a real account session.

An in-memory `chrome.storage` stub exercises history-button visibility without saving a browser preference. Each view checks that only names have + controls, the preference hides/restores them, and existing skill focus still opens charts while controls are hidden. Junior views also check pin persistence and the visible close action. These checks do not certify the real extension storage permission or cross-tab event delivery.

Choose a source host and view, then load it for manual hover, keyboard, native click and pin checks. **Check current view** and **Check all views** record observable DOM/Canvas/export outcomes. Export anchor clicks are captured and their encoded data inspected instead of saving files. The source URL is passed explicitly through `resolvePageContext`; the real harness origin remains localhost. The same pathname is kept locally so the production SPA identity guards run unchanged.

Passing this harness verifies Chromium DOM, Canvas encoding and interaction behavior with synthetic data. It does not certify extension loading, MV3 permissions/service-worker lifecycle, authenticated API transport, persistence, browser downloads, real-page CSS, or safety of migrating a real database. Those require separate checks in an extension-enabled test profile.

The **Skill changes: current week absent** scenario reproduces issue #19 with synthetic weeks and levels. The current context is week 1003/day 2, while the saved history ends at week 1002. It asserts that the latest passing rise has an arrow and the older defending rise does not, while also exercising the skill chart and CSV export.

The **Player profile: stable name and level colors** scenario uses synthetic markup matching the separate label/value columns of the saved beta captures. Chromium computed-style checks cover both green texts, native inline-color updates, absence of profile arrows, unchanged bars, restoration and rerendering. These checks complement JSDOM, whose CSS cascade does not reliably model important stylesheet rules against inline colors.
