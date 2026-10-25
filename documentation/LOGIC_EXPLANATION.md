# Sokker++ runtime logic

This guide describes the current pipelines. See [first-team behavior](TALENT_SUMMARY.md) and [junior behavior](JUNIOR_TALENT.md) for chart details and their limits.

## First-team synchronization

The content script attempts `syncData()` when a Sokker page loads. It obtains the current game week from `/api/current` and reads the last stored week. When that stored week is older, it refreshes it once to capture late updates. It then checks the last 30 game weeks: previously saved or marked-empty past weeks are skipped; missing past weeks are fetched from `/api/training?filter[week]=N`. The current week is fetched on each sync because its report can change within the week. Empty past weeks are marked checked. The roster from `/api/player` can also support the separate best-effort gap reconciliation pass.

`src/core/sync.ts` owns the report sequence; `src/core/gapDetector.ts` reconciles missing player entries; `src/core/repository.ts` stores the history. A carried-over value or roster snapshot is labeled as a reference, not presented as a measured training report. Historical availability depends on what Sokker returns and what this browser has saved. Use JSON backup export/import to preserve accumulated local history between devices.

## Junior synchronization

Junior synchronization starts only on an eligible report details page or the user's own academy page. It checks `/api/current`, the visible junior IDs, the current roster, and cached graph resolution for that game week. Only unresolved juniors need graph requests. The roster supplies Sokker's talent value and weeks remaining; the graph supplies observed level points. The hover card reads the shared local IndexedDB. Details and limits are in [JUNIOR_TALENT.md](JUNIOR_TALENT.md).

## First-team display

Squad and player views use `src/core/skillChanges.ts` for their improvement arrows and numeric colors. It compares the two latest measured observations for each skill using the chart's observed-week normalization, source priority, and date-echo filtering. Repeated captures of the same observed week collapse into one point. A missing current-week entry never causes the latest completed report to be discarded, and a dated Thursday/Friday report from the current week can already establish the latest change regardless of the day threshold.

When `/api/current` is available, future report weeks are excluded. An invalid capture date falls back to its stored report week; before the training window (`day < 5`), only an undated entry actually belonging to the current report week is excluded. If the context request fails, the saved observations still use the chart's date normalization, without guessing the current week from the computer's clock. Legacy entries without `source` count as real reports. A latest point that is only carried over or roster-derived does not establish a measured change; earlier references are skipped when finding the preceding real observation. A gap can show a net change between real reports but does not establish the exact week or cause of the rise. No history or CSV data is rewritten by this display calculation.

General Skills ++ opens from first-team names on squad/player pages, training setup, and training report details. On the two training routes, `src/content/trainingPlayerPage.ts` identifies first-team rows and leaves junior report rows to `src/content/juniorPage.ts`. The card reads local history and uses the same rendering on every route.

The weekly table keeps the stored **report week** in the table and CSV. Its skill chart uses an **observed week** derived from the capture date: Thursday or Friday stays in the report week; Saturday through Wednesday moves to the preceding week. Date parsing uses the written calendar date, not the computer's local timezone. If the date is invalid, the report week is used with an uncertainty marker. Duplicate observed weeks prefer a real training report, then the latest capture. Implausible old-week entries stamped on the latest capture day remain in the table but are excluded from the skill curve. Missing weeks are not filled with invented chart points.

`src/core/playerTimeline.ts` normalizes the observations, `src/core/talent.ts` counts assigned advanced and formation training since each skill's last observed rise, and `src/ui-components/playerSkillCanvas.ts` draws the observed levels and rises. The card does not display a fitted weeks-per-level talent value for first-team skills. See [TALENT_SUMMARY.md](TALENT_SUMMARY.md) for count rules and source labels.

## Storage and export

The MV3 worker is the sole writer of `SokkerPlusPlusDB` in extension-local IndexedDB. Supported classic and beta pages, including routes served under the main domain, use typed clients for this shared history. First-team player identities remain global; junior identities and sync markers are team-scoped. A sync keeps one team and epoch context; writes check the persisted epoch inside their transaction, so a late response cannot undo a clear or restore.

Before syncing an origin, the page inspects its older `SokkerTalentTrackerDB` through a separate read-only reader. Migration preserves the complete source as a verified reversible archive, stages a merged candidate, and publishes atomically with an epoch/revision check. It never upgrades, writes, clears, or deletes the source. Opening a classic page on the main domain may be needed to recover that origin. Clearing shared data blocks later automatic legacy reimports. A real-data pilot requires an independent complete backup with an isolated restoration check first.

The worker makes only the fixed authenticated GET requests to `https://sokker.org/api`; the API host does not depend on the page host. Hover and focus continue to read local data. All transfers of unbounded data, including backups and large reads, use verified fragments with complete JSON envelopes of at most 262144 UTF-8 bytes. Backup export fixes one consistent snapshot; migration and import share staging, conflict preservation, publication receipts, and revision-aware rebasing. Exported backups do not carry runtime epochs or automatic-migration permissions. The popup exports/imports a JSON backup; General Skills ++ exports a CSV of its table; skill and junior cards export PNG charts. Backups can contain account history, so keep them outside the repository and share them only intentionally. Real API captures and account data belong in ignored local documents, never tracked examples.
