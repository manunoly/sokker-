# ⚽ Sokker++

**English** · [Español](readme.es.md)

Sokker++ is an ultra-light Google Chrome extension that injects advanced analytics, skill tracking and talent estimation straight into the [Sokker.org](https://sokker.org) interface.

Its name is a nod to C++ and to its core philosophy: **maximum performance, full control over state and zero unnecessary dependencies.**

## 🚀 Key Features

* **History Tracking (Skill Tracker):** Tracks players' skill increases and decreases week by week.
* **Non-Invasive UI Injection:** Dynamically colors the squad table cells (`/app/squad/`) green (increase) or red (decrease).
* **Native Charts:** Floating tooltips with progression charts drawn 100% with the native `<canvas>` API, no heavy external libraries.
* **Junior Talent:** On training report details and your own junior-team page, hover over or focus a junior's name to see observed levels, their trend, Sokker's talent value and a separate estimate in weeks per level. [Behavior and limits](docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md).
* **Smart Sync:** Reads Sokker's own API to get the current week (`today.week`) and only downloads the missing weeks, so the game servers are not flooded.
* **First-team progress:** General Skills ++ shows focused advanced and formation counts since each skill's last observed increase, a native per-skill curve, and an observed pace in weeks per level where the data supports it. The weekly table stays visible; [calculation and limits](documentation/TALENT_SUMMARY.md).
* **Backup Manager:** Local database with JSON import/export of first-team and junior history.

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
    │   ├── talent.ts          # Focused counts and observed per-skill pace
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

## 📚 Documentation

* [LOGIC_EXPLANATION.md](documentation/LOGIC_EXPLANATION.md): sync, charts and skill increase detection.
* [TALENT_SUMMARY.md](documentation/TALENT_SUMMARY.md): first-team focused counts, observed pace, weekly table, and their limits.
* [Junior talent design](docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md): supported pages, weekly sync, curve estimate and known limits.
* [PRIVACY.md](PRIVACY.md): privacy policy (data stays in your browser).
* [store/](store/LISTING.md): Chrome Web Store listing and submission checklist.
* Installation: [English](documentation/INSTALL-en.md) · [Español](documentation/INSTALL-es.md).
