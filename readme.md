# ⚽ Sokker++

**English** · [Español](readme.es.md)

Sokker++ is a Chromium extension that adds skill history and junior talent estimates to [Sokker.org](https://sokker.org). It is an unofficial fan project, not affiliated with Sokker.

It uses TypeScript, native browser APIs, and local IndexedDB storage. Charts use Canvas without a charting library.

## 🚀 Key Features

* **History Tracking (Skill Tracker):** Tracks players' skill increases and decreases week by week.
* **Non-Invasive UI Injection:** Dynamically colors the squad table cells (`/app/squad/`) green (increase) or red (decrease).
* **Native Charts:** Floating tooltips with progression charts drawn 100% with the native `<canvas>` API, no heavy external libraries.
* **Junior Talent:** On training report details and your own academy page, hover over or focus a junior's name to see observed levels, a fitted trend, Sokker's talent value and a separate estimate in weeks per level. [Behavior and limits](documentation/JUNIOR_TALENT.md).
* **Smart Sync:** Reads Sokker's current game week, refreshes the latest stored week at a week change, fetches missing recent report weeks, and refreshes the current report week. Junior data syncs only on eligible junior pages and is reused for the game week.
* **First-team progress:** General Skills ++ shows assigned advanced and formation training counts since each skill's last observed rise, plus a native chart of observed levels and rises. The weekly table stays visible; [calculation and limits](documentation/TALENT_SUMMARY.md).
* **Backup Manager:** Local database with JSON import/export of first-team and junior history.

## 🛠️ Architecture and Technical Philosophy

The Manifest V3 content script separates same-origin API access (`src/core/api.ts`), IndexedDB persistence (`src/core/repository.ts` and `src/core/juniorRepository.ts`), synchronization (`src/core/sync.ts` and `src/core/juniorSync.ts`), and page integration (`src/content/`). The build uses Vite; runtime charts use the browser's Canvas API.

## 📁 Project Structure

The source code is split to maximize testability and separation of concerns:

```text
sokker-plus-plus/
├── manifest.json              # Manifest V3 configuration
├── popup/                     # Extension UI (Import/Export/manual Sync)
└── src/
    ├── content/               # DOM interaction (side effects)
    │   ├── main.ts            # Content script entry point
    │   ├── observer.ts        # MutationObserver for the Sokker SPA
    │   ├── ui.ts              # Visual table mutations
    │   ├── tooltip.ts         # First-team hover and focus lifecycle
    │   ├── playerCard.ts      # First-team summary, skill card, and weekly table
    │   ├── playerLocale.ts    # Eight first-team card languages
    │   ├── i18n.ts            # Incoming skill-label normalization
    │   ├── juniorPage.ts      # Eligible routes and junior-name interaction
    │   ├── juniorCard.ts      # Local-data hover card
    │   └── juniorLocale.ts    # Eight UI languages with English fallback
    ├── core/                  # Business logic and data
    │   ├── api.ts             # Pure fetchers for sokker.org/api (same origin)
    │   ├── repository.ts      # Functional IndexedDB wrapper (closures)
    │   ├── sync.ts            # Orchestrator: compares weeks and decides what to fetch
    │   ├── gapDetector.ts     # Detects missing weeks in the history
    │   ├── talent.ts          # Focused per-skill training counts
    │   ├── playerTimeline.ts  # Report weeks and observed skill levels
    │   ├── levelTrend.ts      # Shared regression math
    │   ├── juniorSync.ts      # Weekly junior queue and roster decisions
    │   ├── juniorRepository.ts # Junior records in the shared IndexedDB
    │   ├── juniorTalent.ts    # Junior curve estimate
    │   └── trainingReport.ts  # Per-player training report
    ├── types/                 # Shared TypeScript types
    ├── ui-components/         # Pure presentation
    │   ├── playerSkillCanvas.ts # First-team skill chart (Canvas API)
    │   ├── playerSkillExport.ts # First-team PNG adapter
    │   ├── chartExport.ts     # Shared PNG compositor
    │   └── juniorCanvas.ts    # Junior chart (Canvas API)
    └── utils/                 # Utilities
        ├── scheduleIdle.ts    # Schedules work during idle time
        └── escapeHtml.ts      # Escapes values rendered as HTML
```

## 🧑‍💻 Development

```bash
npm ci            # install dependencies
npm run dev       # build in watch mode
npm run build     # generates dist/ (load it as "unpacked" in chrome://extensions)
npm run package   # build + zip dist/ into store/sokker-plus-plus.zip
npx vitest run    # tests
npx tsc --noEmit  # typecheck
```

`npm run package` currently needs POSIX `rm` and `zip`; on Windows use a shell that provides them. Loading `dist/` only needs `npm run build`.

## 📚 Documentation

* [Documentation index](documentation/README.md): current guides and historical design records.
* [LOGIC_EXPLANATION.md](documentation/LOGIC_EXPLANATION.md): sync, charts and skill increase detection.
* [TALENT_SUMMARY.md](documentation/TALENT_SUMMARY.md): first-team counts, observed skill curves, weekly table, and limits.
* [Junior talent](documentation/JUNIOR_TALENT.md): supported pages, weekly sync, curve estimate and limits.
* [PRIVACY.md](PRIVACY.md): privacy policy (data stays in your browser).
* [store/](store/LISTING.md): Chrome Web Store listing and submission checklist.
* Installation: [English](documentation/INSTALL-en.md) · [Español](documentation/INSTALL-es.md).
