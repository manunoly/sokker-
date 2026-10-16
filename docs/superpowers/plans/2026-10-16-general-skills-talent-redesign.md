# General Skills ++ Talent Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `.agents/skills/executing-plans/SKILL.md` task by task. Track each step with its checkbox. Follow `docs/WORKFLOW.md`; do not delegate or commit unless the owner requests it.

**Goal:** Replace the first-team talent summary and per-skill graphs with the approved two-column card, observed progress calculation, native chart, and readable weekly table.

**Architecture:** Normalize saved first-team history in pure code, then derive per-skill focused-training counts and observed pace. Keep IndexedDB access and hover lifecycle in the content layer, render Canvas without a chart library, and reuse the existing PNG compositor. The junior interface and data sync retain their behavior.

**Tech Stack:** TypeScript, browser DOM and Canvas, IndexedDB read API, Vitest with jsdom, Vite; no new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-16-general-skills-talent-redesign-design.md`

## Global Constraints

- Use only data already saved in `SokkerTalentTrackerDB`; a hover must not request an API or write to storage.
- The general card has two columns in the player's skill order; the weekly table stays visible and uses one localized `Registro` column in place of `⚑` and `Kind`.
- Large and small figures mean focused advanced and formation sessions since the last detected increase. A missing report is unknown, never an invented zero; `≥` marks a minimum.
- A pace value is observed weeks per level for one skill, not Sokker's hidden talent. Require four real observed weeks and positive slope; no numeric pace for stamina.
- Keep the eight existing languages with English fallback, native Canvas, keyboard access, and a short English PNG footer ending in `by manuel.team`.
- Preserve first-team CSV data fields, existing sync, and junior-visible behavior. Use synthetic data in tests and tracked documentation.
- Do not commit, push, package, or publish unless the owner requests it.

## Review Focus

1. Date-only Thursday/Friday versus Saturday/Wednesday entries and two sources for the same week must pick the right observation without moving the table's stored report week. Task 1 tests this.
2. A legacy real entry without `training`, a `carried-over` entry, and a `roster-fallback` entry must yield three distinct `Registro` meanings and no invented focused training. Tasks 1, 2, and 4 test this.
3. A rise after missing weeks or an indirect training must reset counters at the later observed report without claiming its exact pop week. Task 2 tests this.
4. Flat, declining, post-drop, and stamina series must not show a misleading positive pace, while the chart still shows their real levels. Tasks 2 and 3 test this.
5. Moving between a player name, skill, and card; keyboard focus; narrow viewports; and a late IndexedDB response must not leave stale cards or hide the weekly table. Tasks 4 and 5 test this.

---

### Task 1: Prepare one provenance-aware first-team timeline

**Files:** Create `src/core/playerTimeline.ts` and `src/core/playerTimeline.test.ts`; read the existing `src/types/index.ts` and `src/core/repository.ts` without changing the database schema.

**Interfaces:** Export `PlayerSkill` for the eight displayed skills; `PLAYER_SKILL_COLUMNS` as `[['stamina','pace','technique','passing'],['keeper','defending','playmaking','striker']]`; `PlayerTimelineRow` with the original `entry`, `reportWeek`, `observedWeek`, normalized `source`, and `dateReliable`; `PlayerSkillPoint` with `week`, `reportWeek`, `level`, `source`, and `injured`; `preparePlayerTimeline(history: readonly PlayerHistoryEntry[]): PlayerTimelineRow[]`; `observedSkillPoints(rows: readonly PlayerTimelineRow[], skill: PlayerSkill): PlayerSkillPoint[]`.

- [x] **Step 1: Write tests** for deterministic date-only weekdays, invalid-date fallback, raw report-week preservation, duplicate-week preference for a real report then latest timestamp, valid levels 0–18, a stable `form` history, and old-week date echoes.
- [x] **Step 2: Run** `npx vitest run src/core/playerTimeline.test.ts`; expect the new tests to fail because the module does not exist.
- [x] **Step 3: Implement** the two pure functions. Normalize a legacy missing `source` to `training`; derive calendar weekdays independently of local timezone. Keep a row per stored report week for the table; deduplicate observation points by adjusted week for charts, with source priority. Retain the current date-cluster guard for implausible old echoes, but remove the current static-`form` backfill heuristic from the new path.
- [x] **Step 4: Re-run** the targeted test; expect all cases to pass. Inspect the diff for any accidental repository or junior changes.

### Task 2: Compute per-skill counts and an honest observed pace

**Files:** Modify `src/core/talent.ts`, `src/core/talent.test.ts`, and `src/core/juniorTalent.ts`; create `src/core/levelTrend.ts` and `src/core/levelTrend.test.ts`; run the existing `src/core/juniorTalent.test.ts`.

**Interfaces:** Export `LevelTrendEstimate` (`state: 'insufficient' | 'no-progress' | 'estimated'`, `slope`, `weeksPerLevel`) and `estimateLevelTrend(points: readonly { x: number; y: number }[]): LevelTrendEstimate` from the generic module. Export `SkillProgress` and `computeSkillProgress(rows: readonly PlayerTimelineRow[], skill: PlayerSkill): SkillProgress` from `talent.ts`; `SkillProgress` contains displayed points, `advanced`, `formation`, `exact`, `lastRiseReportWeek`, trend start/end weeks, and the pace state/value. `estimateJuniorTalent` delegates only its unchanged regression math to the generic helper and preserves its public `JuniorTalentEstimate` type.

- [x] **Step 1: Write tests** for `3` versus `4` real weeks; the sample `(1205,10),(1208,10),(1211,11),(1214,11)` giving `7.5` weeks/level; flat/negative slope; a drop followed by fewer than four real weeks; and unchanged junior estimate results.
- [x] **Step 2: Write tests** for all eight skill rows, positive-intensity focused `individual` and `formation` counts, `general`/other-skill exclusion, zero-intensity exclusion, indirect rise, no rise, gap/arrastre/legacy minimum `≥`, and reset only after the later real observation that detects a rise. Stamina returns no pace.
- [x] **Step 3: Run** `npx vitest run src/core/levelTrend.test.ts src/core/talent.test.ts src/core/juniorTalent.test.ts`; expect new behavior tests to fail before implementation.
- [x] **Step 4: Implement** the generic OLS helper and new first-team analysis. Fit only real source points after the last level drop; retain the old first-team exports only if a current caller still needs them. Remove the global average, progress bars, and prediction marker when replacing their call site in Task 5.
- [x] **Step 5: Re-run** the three targeted suites; expect all cases, including juvenile regression tests, to pass.

### Task 3: Draw and export each first-team skill curve

**Files:** Create `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/playerSkillCanvas.test.ts`, `src/ui-components/playerSkillExport.ts`, and `src/ui-components/playerSkillExport.test.ts`; reuse `src/ui-components/chartExport.ts` unchanged.

**Interfaces:** `drawPlayerSkillChart(ctx: CanvasRenderingContext2D, progress: SkillProgress, width: number, height: number): void`; `createPlayerSkillExportCanvas(progress: SkillProgress, englishSkillName: string): HTMLCanvasElement`.

- [x] **Step 1: Write Canvas tests** for a Y range based on actual observed levels, a visible flat line, actual game-week X labels, unjoined missing weeks, distinguishable carried/roster points, and a dashed regression segment confined to its fitted weeks. Stamina gets no trend.
- [x] **Step 2: Write PNG tests** for the shared 960×488 export, a short fixed-English footer such as `Pace · 7.5 weeks/level`, an unavailable-pace footer without an invented number, and `by manuel.team`.
- [x] **Step 3: Run** `npx vitest run src/ui-components/playerSkillCanvas.test.ts src/ui-components/playerSkillExport.test.ts`; expect failure before implementation.
- [x] **Step 4: Implement** the native renderer in the junior palette and the thin export adapter. Connect only adjacent real observation weeks, show inferred references differently, and clip the trend to the fitted observation range.
- [x] **Step 5: Re-run** the targeted tests plus `src/ui-components/juniorCanvas.test.ts src/ui-components/juniorExport.test.ts src/ui-components/chartExport.test.ts`; expect all to pass.

### Task 4: Render localized first-team cards and the visible weekly table

**Files:** Create `src/content/playerLocale.ts`, `src/content/playerLocale.test.ts`, `src/content/playerCard.ts`, and `src/content/playerCard.test.ts`. Keep `src/content/juniorLocale.ts` behavior unchanged; its language detection/number formatting may be reused.

**Interfaces:** `getPlayerStrings(pathname: string, documentLang: string, browserLang: string): PlayerStrings`; `createPlayerSummaryContent(player: PlayerData, rows: readonly PlayerTimelineRow[], progress: readonly SkillProgress[], strings: PlayerStrings): HTMLElement`; `createPlayerSkillContent(player: PlayerData, progress: SkillProgress, strings: PlayerStrings): HTMLElement`.

- [x] **Step 1: Write tests** for eight languages and fallback; escaped player names; the exact two-column skill order; large advanced/small formation figures with localized `aria-label` and focus/hover help; and `≥` with incomplete history.
- [x] **Step 2: Write tests** for the table visible on initial render, one `Registro` column with `Avanzado`, `Formación`, `Sin informe`, `Solo plantilla`, and `Informe sin detalle`; `Pos / Skill`, effectiveness, stored report week, all level columns, injury note, and unchanged CSV fields.
- [x] **Step 3: Run** `npx vitest run src/content/playerLocale.test.ts src/content/playerCard.test.ts`; expect failure before implementation.
- [x] **Step 4: Implement** DOM-based cards using the existing junior visual language and localized copy. Use `textContent` for names and a safe renderer for stored values. Constrain the wide card and its table within the viewport; keep the table open, scrolling inside its region.
- [x] **Step 5: Re-run** both targeted suites; expect all cases to pass.

### Task 5: Connect hover, focus, positioning, and PNG to the existing pages

**Files:** Modify `src/content/tooltip.ts`, `src/content/ui.ts`, and `src/content/tooltip.test.ts`; use the Task 4 card constructors and the existing `getPlayerHistory` read API. No API or sync module changes.

**Interfaces:** Preserve the exported `showTooltip`, `showHistoryTooltip`, `openZoomChart`, `hideTooltip`, and `scheduleHide` entry points used by `ui.ts`, adapting their internals to the new cards. Add an optional `anchor?: HTMLElement` to `showTooltip(x, y, playerId, skillName, anchor?)` and `openZoomChart(playerId, skillName, anchor?)`; `ui.ts` passes its hovered/focused element for placement. A click on a skill value pins the same skill card instead of opening the old full-screen chart.

- [x] **Step 1: Update integration tests** for one local history read per opening, no network request, stale async response ignored after changing player/skill, mouse transfer into card, Escape close, focus access from name and skill, and viewport-edge placement that does not block the adjacent player name.
- [x] **Step 2: Run** `npx vitest run src/content/tooltip.test.ts`; expect the new tests to fail against the old tooltip.
- [x] **Step 3: Replace** the old green 200×100 chart, 0–18 zoom, ASCII talent block, `⚑`/`Kind` table header, and static-`form` filter with the new renderers and timeline. Reuse the existing timer/selection guard pattern; keep `showHistoryTooltip` and skill hover backed by local IndexedDB only. Bind keyboard focus and card PNG action.
- [ ] **Step 4: Re-run** the tooltip suite and `npx tsc --noEmit`; expect both to pass. Manually inspect the squad and player-detail pages at wide and narrow viewport sizes, including hover navigation, keyboard navigation, scroll, CSV, and PNG. Automated checks and a synthetic visual preview passed; live Sokker validation is still pending.

### Task 6: Document observed meaning and verify the complete change

**Files:** Modify `documentation/TALENT_SUMMARY.md`, `documentation/TALENT_SUMMARY.es.md`, `readme.md`, and `readme.es.md`; update this spec only if implementation evidence requires a correction. Do not add private captures to tracked files.

- [x] **Step 1: Document** the per-skill counters, the OLS weeks/level formula and its four-point rule, report week versus observed week, incomplete histories, `Registro` meanings, stamina, and why the number is not Sokker's hidden talent.
- [x] **Step 2: Run** `npx vitest run`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; record actual results. Use synthetic fixtures and verify no unrelated or youth behavior changed.
- [x] **Step 3: Review** the complete diff with `code-review-and-quality`, resolve material findings, rerun only checks affected by a fix, and report remaining limitations. Do not commit or open a PR without a new owner request.

## Self-review of plan against spec

- Data and provenance: Tasks 1–2; visual curve and PNG: Task 3; two-column card, `Registro`, CSV, locale: Task 4; existing Sokker page integration and keyboard: Task 5; documentation and whole-project checks: Task 6.
- The only planned juvenile source edit extracts existing regression math; Task 2 requires its current public result and tests to stay unchanged. Shared Canvas export remains unchanged.

## Execution evidence — 2026-10-16

- Tasks 1–4 and 6, plus the implementation and automated checks in Task 5, are complete on `codex/general-skills-talent`.
- `npx vitest run`: 25 files, 213 tests passed after the responsive table refinement. `npx tsc --noEmit`, `npm run build`, and `git diff --check` passed.
- A synthetic local preview was inspected at wide and narrow widths for the two-column summary, visible weekly table, and skill chart. Actual Sokker pages with the extension loaded remain for owner validation; this is the outstanding manual part of Task 5, Step 4.
- Review findings about Escape focus, uncertain dates, minimum-count wording, observed period, and inferred-source labels were fixed and retested. No commit or PR was created.
- The weekly table now uses two lines per week without horizontal scroll; a zero-effectiveness injured report shows the injury icon instead of a training-kind badge. The summary can use up to 80% of the viewport width, with a wider below-anchor fallback on narrow screens. These changes were inspected in a synthetic browser preview.
