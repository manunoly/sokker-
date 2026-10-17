# Sokker++ runtime logic

This guide describes the current pipelines. See [first-team behavior](TALENT_SUMMARY.md) and [junior behavior](JUNIOR_TALENT.md) for chart details and their limits.

## First-team synchronization

The content script attempts `syncData()` when a Sokker page loads. It obtains the current game week from `/api/current` and reads the last stored week. When that stored week is older, it refreshes it once to capture late updates. It then checks the last 30 game weeks: previously saved or marked-empty past weeks are skipped; missing past weeks are fetched from `/api/training?filter[week]=N`. The current week is fetched on each sync because its report can change within the week. Empty past weeks are marked checked. The roster from `/api/player` can also support the separate best-effort gap reconciliation pass.

`src/core/sync.ts` owns the report sequence; `src/core/gapDetector.ts` reconciles missing player entries; `src/core/repository.ts` stores the history. A carried-over value or roster snapshot is labeled as a reference, not presented as a measured training report. Historical availability depends on what Sokker returns and what this browser has saved. Use JSON backup export/import to preserve accumulated local history between devices.

## Junior synchronization

Junior synchronization starts only on an eligible report details page or the user's own academy page. It checks `/api/current`, the visible junior IDs, the current roster, and cached graph resolution for that game week. Only unresolved juniors need graph requests. The roster supplies Sokker's talent value and weeks remaining; the graph supplies observed level points. The hover card reads the shared local IndexedDB. Details and limits are in [JUNIOR_TALENT.md](JUNIOR_TALENT.md).

## First-team display

Squad and player views compare saved skill snapshots for the improvement arrows. Before the current week's training window, the comparison can use the preceding completed weeks; after it, the latest two saved entries are compared. See `src/content/ui.ts` for the exact page handling. Do not interpret an arrow as proof of which training caused a rise.

General Skills ++ keeps the stored **report week** in the table and CSV. Its skill chart uses an **observed week** derived from the capture date: Thursday or Friday stays in the report week; Saturday through Wednesday moves to the preceding week. Date parsing uses the written calendar date, not the computer's local timezone. If the date is invalid, the report week is used with an uncertainty marker. Duplicate observed weeks prefer a real training report, then the latest capture. Implausible old-week entries stamped on the latest capture day remain in the table but are excluded from the skill curve. Missing weeks are not filled with invented chart points.

`src/core/playerTimeline.ts` normalizes the observations, `src/core/talent.ts` counts assigned advanced and formation training since each skill's last observed rise, and `src/ui-components/playerSkillCanvas.ts` draws the observed levels and rises. The card does not display a fitted weeks-per-level talent value for first-team skills. See [TALENT_SUMMARY.md](TALENT_SUMMARY.md) for count rules and source labels.

## Storage and export

`SokkerTalentTrackerDB` is in the browser's `sokker.org` site storage. First-team and junior records share this database but use separate stores. The popup exports/imports a JSON backup; General Skills ++ exports a CSV of its table; skill and junior cards export PNG charts. Backups can contain account history, so keep them outside the repository and share them only intentionally. Real API captures and account data belong in ignored local documents, never tracked examples.
