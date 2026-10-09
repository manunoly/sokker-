# ⚽ Sokker++

**English** · [Español](readme.es.md)

Sokker++ is an ultra-light Google Chrome extension that injects advanced analytics, skill tracking and talent estimation straight into the [Sokker.org](https://sokker.org) interface.

Its name is a nod to C++ and to its core philosophy: **maximum performance, full control over state and zero unnecessary dependencies.**

## 🚀 Key Features

* **History Tracking (Skill Tracker):** Tracks players' skill increases and decreases week by week.
* **Non-Invasive UI Injection:** Dynamically colors the squad table cells (`/app/squad/`) green (increase) or red (decrease).
* **Native Charts:** Floating tooltips with progression charts drawn 100% with the native `<canvas>` API, no heavy external libraries.
* **Smart Sync:** Reads Sokker's own API to get the current week (`today.week`) and only downloads the missing weeks, so the game servers are not flooded.
* **Talent Summary:** In the General Skills ++ panel, counts each skill's advanced trainings since its last increase and estimates the player's talent ([rules](documentation/TALENT_SUMMARY.md)).
* **Backup Manager:** Local database with import/export of the full history as JSON.

## 🛠️ Architecture and Technical Philosophy

Sokker++ follows **ECMAScript (ES2026+)** best practices under a strictly **functional** paradigm.

**Repository Rules:**
1.  **Zero Classes (`class`):** State is encapsulated with closures and modules (*ESM*).
2.  **Zero Dependencies (Vanilla JS):** No React, no Chart.js, no state libraries. Everything uses native browser APIs (IndexedDB, Canvas, Fetch, MutationObserver).
3.  **Side-Effect Separation:**
    * DOM manipulation (`ui.ts`, `observer.ts`) is isolated.
    * Network requests (`api.ts`) are purely asynchronous functions.
    * Persistence (`repository.ts`) abstracts IndexedDB without exposing its internal API.

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
    │   ├── tooltip.ts         # Floating tooltip logic
    │   └── i18n.ts            # Translated texts
    ├── core/                  # Business logic and data
    │   ├── api.ts             # Pure fetchers for sokker.org/api (same origin)
    │   ├── repository.ts      # Functional IndexedDB wrapper (closures)
    │   ├── sync.ts            # Orchestrator: compares weeks and decides what to fetch
    │   ├── gapDetector.ts     # Detects missing weeks in the history
    │   ├── talent.ts          # Talent summary (direct training since last increase)
    │   └── trainingReport.ts  # Per-player training report
    ├── types/                 # Shared TypeScript types
    ├── ui-components/         # Pure presentation
    │   └── canvas.ts          # Pure function that draws the chart (Canvas API)
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

## 📚 Documentation

* [LOGIC_EXPLANATION.md](documentation/LOGIC_EXPLANATION.md): sync, charts and skill increase detection.
* [TALENT_SUMMARY.md](documentation/TALENT_SUMMARY.md): talent summary rules (direct training since last increase) for the General Skills ++ panel.
* [PRIVACY.md](PRIVACY.md): privacy policy (data stays in your browser).
* [store/](store/LISTING.md): Chrome Web Store listing and submission checklist.
* Installation: [English](documentation/INSTALL-en.md) · [Español](documentation/INSTALL-es.md).
