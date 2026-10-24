# History buttons implementation plan

> **For agentic workers:** Use the local `executing-plans` workflow. The owner requested Sol for implementation and Astra at high for auditing; do not add another approval gate.

**Goal:** Deliver the proposed history controls in a rebuilt extension the owner can test.

**Architecture:** A small extension preference module persists visibility independently of history. A shared DOM button helper supplies name/skill presentation; existing bindings own identity and card selection. The junior card gains explicit pinned state while preserving hover behavior.

**Tech Stack:** Existing TypeScript, Chrome MV3, Canvas and Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-history-buttons-design.md`.

## Constraints and review focus

- Preserve all stored history, migration and API behavior.
- Keep native name/skill actions, focus navigation and separate junior eligibility checks.
- Test startup preference read racing a change; persisted false must not be overwritten by stale true.
- Test recycled DOM identities, duplicate scans and late card reads.
- Check hidden controls do not remain visible because inline display overrides the hidden attribute.
- Verify borderless skill controls in the generated bundle, rather than rebuilding unchanged code.

## Tasks

### 1. Persistent visibility and popup

**Files:** `src/core/historyButtonPreferences.ts`, `popup/index.html`, `popup/popup.ts`, `src/content/main.ts`, `manifest.json`, and related tests.

**Interfaces:** `historyButtonsVisible(): boolean`; `initHistoryButtonPreferences(): Promise<void>`; `setHistoryButtonsVisible(visible: boolean): Promise<void>`; `subscribeHistoryButtonsVisibility(listener: (visible: boolean) => void): () => void`.

- [x] Default to true; load/save a boolean from `chrome.storage.local`, listen to changes and keep preferences separate from history.
- [x] Initialize independently of history readiness. Add a checkbox with accessible failure feedback and the storage permission.
- [x] Verify absent/invalid values, false persistence, startup races, changes and write failures in focused tests.

### 2. Common controls and juvenile pinning

**Files:** `src/content/historyButton.ts`, `playerBindings.ts`, `trainingPlayerPage.ts`, `juniorPage.ts`, `juniorCard.ts`, relevant locales and tests.

- [x] Share presentation and visibility: skills without border/background, names with a discreet border, minimum 24 × 24 px and visible keyboard focus.
- [x] Enable classic and beta controls as siblings of native interactive elements; maintain current identity checks and cleanup.
- [x] Add eligible junior controls, pinned state, visible close and Escape. Preserve hover/focus when buttons are hidden.
- [x] Verify repeated/recycled scans, native actions, hidden controls and pinned card lifecycle with synthetic DOM fixtures.

### 3. Review, documentation and delivery

- [x] Update current first-team and junior guides in English and Spanish.
- [x] Run focused tests, the full suite with `--maxWorkers=2`, `npx tsc --noEmit`, and `git diff --check`.
- [x] Obtain Astra high audit and resolve actionable findings.
- [x] Rebuild with `npm run build`, verify emitted assets contain the new controls/preference, and report the exact `dist` path.
- [x] Record actual browser evidence and limitations. Do not claim a live MV3 check that did not run.

## Progress

Implemented by two GPT-6.1-Sol workers. Astra high found two P2 gaps (training controls and keyboard entry from a junior +); both were corrected and revalidated. The final full suite passed 454 tests in 49 files. TypeScript and build passed. The browser harness passed 83 checks per logical source host (root and app), 166 total. See [verification and audit evidence](../../research/2026-10-24-history-buttons-verification.es.md), including native CSS and MV3 limits.
