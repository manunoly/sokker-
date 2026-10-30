# Training refresh and beta progress implementation plan

> Execute with the repository `executing-plans` workflow in this session. The owner explicitly authorized autonomous implementation; preserve unrelated changes and do not commit.

**Goal:** Show post-training junior levels within the same week and expose existing history/skill changes on the supplied beta pages.

**Architecture:** Keep current shared storage/API, serialized junior coordinator and Canvas cards. Deduplicate junior work per page visit, not by a persisted current-week success. Reuse beta player anchors for the progress table.

**Tech Stack:** TypeScript, native DOM/Canvas, IndexedDB, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-10-29-training-refresh-and-progress-design.md`.

## Constraints and review focus

Preserve historical data, native links, host/ID ownership validation, bounded graph concurrency, route cancellation and late-write protection. Tests must include same-week changes, manual failures, hidden/mismatched links, reused rows and SPA departure. Do not include private captures in tracked fixtures.

## Tasks

- [x] 1. Junior refresh: update `src/core/juniorSync.ts` and its tests. `syncVisibleJuniors(input)` deduplicates within the visit; a new `syncCurrentJuniors({teamId, week})` refreshes all own roster IDs for manual sync. Verify a stored 13 becomes API-provided 14 without a week change; roster weeksLeft refreshes, repeat renders deduplicate and error/cancellation protections remain.
- [x] 2. Manual sync: wire `src/content/main.ts` to await both pipelines and refresh presentation; extend `main.test.ts` to verify invocation, waiting and failure reporting from supported pages.
- [x] 3. Progress/setup: extend `pageContext.ts`, `betaPlayerPage.ts`, `playerBindings.ts`, `observer.ts` and `trainingPlayerPage.ts`; add synthetic fixtures and regression tests. Validate progress row identities, all eight skill anchors, summary/skill interactions, indicators and setup names under both markup generations. Preserve native clicks and remove obsolete bindings.
- [x] 4. Verify and document: run focused regressions, `npx vitest run`, `npx tsc --noEmit`, `npm run build`; inspect saved HTML against actual scanners locally. Update EN/ES feature guides and perform five-axis self-review and `git diff --check`.

## Progress and evidence

Initial diagnosis: progress route resolves null; current setup scanner selects 0 of 25 rows. Backup junior final level 13 and current-week resolution blocks refetch. No feature changes at plan creation.

Completed October 29, 2026:
- Regression-first run reproduced the weekly junior cache, missing progress route and obsolete setup selectors before the fixes.
- Focused integration suite: 189 tests across 8 files passed. Full `npx vitest run`: 602 tests across 51 files passed. After final test-only cleanup/stronger manual concurrency assertions, junior sync rerun: 22 tests passed.
- `npx tsc --noEmit`: exit 0, including after final test cleanup. `npm run build`: exit 0; local `dist` generated. No dependencies or release versions changed.
- Current source scanners against the supplied full saved HTML: progress identifies 25 players, 200 skill anchors and 200 visible values; setup identifies 25 names. Node diagnostics used ES2022, consistent with iterable Map handling in production.
- EN/ES junior and first-team guides updated. Five-axis self-review found no remaining blocker in the change: existing cards/calculations reused, host/row checks and native links preserved, requests serialized/bounded, obsolete test mocks removed, meaningful checks retained. `git diff --check`: clean.
- No commit/push, private-data mutation, browser extension replacement or authenticated live API validation performed. To activate, reload the local extension build and the Sokker tab, then synchronize. The real API supplies the updated level; no screenshot value was written into history.

## Owner follow-up: hover, localized progress and local release 0.2.7

The owner requested removal of triangular change indicators, support for `/en/app/training/main-team-progress/`, and a delay everywhere a pointer opens a history card. Later, the owner replaced the PR request with a local commit on the current branch, a version bump and a store ZIP plus local dist.

- Shared 400 ms hover intent in `src/content/hoverIntent.ts`, used by first-team bindings, training names and delegated junior names. Leaving, Escape, navigation, hidden/detached triggers and identity changes cancel pending opening. Focus and explicit controls remain immediate; native actions are preserved.
- Change presentation uses colors only, including squad/progress tables. Existing extension-owned arrow nodes are removed and the compiled content must contain neither triangular change glyph.
- Localized progress routes use the existing table/history pipeline with validated row/link identity and classic text-name support. Both provided progress captures declare the beta app URL, so no separate authenticated legacy capture was available. Full saved-table inspection yields 25 players and 200 visible skill values with either recognized route.
- Graph discovery/coverage calls did not return during this follow-up; current owning source was read directly. Browser inspection was blocked by the automatic review service reporting model capacity. No private data was published or changed.
- Test runner uses `--configLoader runner` to keep configuration loading within sandbox permissions. The existing migration stress test hit its unchanged 5-second timeout under concurrent work, then passed isolated in 1.23 seconds; sequential full verification is in progress. No assertions or timeout thresholds were weakened.
- Release target: package.json, lockfile and manifest 0.2.7; fresh dist and `documentation/sokker-plus-plus.zip` with the manifest at archive root. No PR, push, store upload or publication is requested.


### Final follow-up validation and release artifacts

- `npx vitest run --configLoader runner --maxWorkers 1`: 629 tests across 52 files passed. Parallel runs hit the existing migration stress test's 5-second timeout; the same unchanged test passed both isolated and in the sequential full suite. No test timeout, assertion or persistent quality setting was weakened.
- `npx tsc --noEmit`: exit 0. Both production Vite configurations built successfully with the runner configuration loader, within sandbox permissions. A requested cleanup command was not executed because automatic review reported model capacity; rebuilding the existing generated files succeeded without deletion.
- Source package, lockfile root/package entry, source manifest, dist manifest and ZIP manifest all agree on 0.2.7. ZIP validation confirms 15 files, manifest at root, every required script/catalog/icon present, and byte-for-byte equality with dist. Neither triangular change glyph is in content.js. No private capture, test or source file is packaged.
- `git diff --check` clean. Self-review covered timing/cancellation, native clicks, per-player/per-skill selection, colors without arrows, row identity validation, version consistency and package contents. No blocker remains in the implemented changes; authenticated legacy-page inspection remained unavailable as noted above.
- The owner will create the PR. Only this task's implementation, tests, feature guides, plan/spec, version files and release ZIP are selected for a local commit on the existing branch; unrelated working changes and private captures remain outside the commit. No push or store submission.


## Confirmed legacy capture follow-up (same 0.2.7 release)

The owner provided a separate legacy failure capture after testing the beta view successfully. Its name links use `/{locale}//app/training/player-info/{id}`, which the existing player-link validator rejected. The progress route itself was already recognized; the rejected name links caused the adapter to discard every row.

- Extended only the opt-in training-link identity helper to accept classic player-info links, including the observed duplicate slash. Host/protocol validation and positive, safe player IDs still use the existing canonical route validator. The native URL is never rewritten, and player-info is not enabled as a standalone extension page.
- Added a synthetic legacy fixture derived from the supplied structure and switched legacy progress color/interaction regressions to that fixture. The regression first failed with zero players, then passed after the parser fix.
- Focused verification: 199 tests passed across page context, beta/legacy adapters, bindings, skill changes, training names, observer and tooltip. Type checking passed. Local inspection of the complete owner-provided legacy and beta HTML finds 25 players, 200 skill anchors and 200 visible levels in each.
- The owner explicitly asked to retain version 0.2.7 because it has not been uploaded yet. A temporary local metadata bump was reverted before building or committing. No push, PR or store upload.
- Rebuild dist and the release ZIP with 0.2.7 and this fix; keep private captures and unrelated working changes out of the local follow-up commit.
