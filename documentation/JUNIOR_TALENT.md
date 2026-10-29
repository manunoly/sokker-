# Junior talent in Sokker++

**English** · [Español](JUNIOR_TALENT.es.md)

The junior card appears when you hover or focus a junior's name in a training report details page (`/{locale}/app/training/reports/details/{week}/`) or on **your own** `/juniors/teamID/{teamId}/` page. It opens left of the name in a report and right of the name in the academy. The extension checks the current team ID before enabling the academy card. The hover reads IndexedDB; it does not fetch the graph on hover.

Hover waits 400 ms before opening the card and cancels when the pointer leaves, the page changes or a row is reused. Keyboard focus and the `+` control open immediately. The delay adds no network requests.

Beta academy pages at `/juniors/{teamId}` and beta report details at `/training/reports/details/{id}` use the same synchronization coordinator and chart. The academy still requires your own team. Routes are recognized independently of the subdomain. Beta native name actions remain available. See the [verification record](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) for the earlier tested scope.

A subtly bordered `+` beside a junior's name opens and pins the card on supported classic and beta pages. A pinned card stays open when the pointer leaves; its visible close button or Escape dismisses it. Controls retain the same own-team eligibility check and native name actions.

The popup's **Show + history buttons** option, enabled by default, also controls these shortcuts. It is saved per extension installation and browser profile and shared across supported hosts. Hiding controls preserves existing hover/focus interactions; the preference does not change history or JSON backups.

See [screenshots of the card and its PNG export](SCREENSHOTS.md#junior-talent-card).

## Data and synchronization

On an eligible page, the extension obtains the current game week and team from `/api/current`. It reads visible junior IDs, uses `/api/junior?filter[limit]=100` for the current roster, Sokker's own `talent`, and `weeksLeft`, and requests `/api/junior/{id}/graph` for observed level points when needed. Up to three graph requests run at once. Results are saved in the junior store of the extension-local `SokkerPlusPlusDB`, shared with first-team history across supported Sokker hosts in the same browser profile.

Each eligible page visit refreshes the roster and visible junior graphs, even when they were previously saved in the same game week: training can change levels before the week changes. Repeated renders during that visit reuse attempted IDs, while newly visible IDs can add work. Reloading or reentering the page starts another check. Hovering still reads local history only. An absent junior is recorded for the week when the roster is complete; the card can still show previously saved history. If the 100-entry roster limit is reached, absence is treated as unknown. Leaving the page cancels queued work. Imported JSON backups can include junior history; a restore does not treat an old roster snapshot as current.

The popup's **Sync** button refreshes first-team reports and then the current own junior roster and its graphs, including when invoked on a supported first-team page. It waits for both pipelines and reports junior failures. A retry can refresh the same week again. New API points replace saved points with the same coordinate while preserving earlier history; no levels are inferred from screenshots. A page kept open across training can be refreshed with this button or by reloading.

## Chart and estimate

Canvas draws only observed levels. Consecutive observed weeks have a solid line; gaps stay unconnected. The Y scale runs from the lowest to the highest observed level, with one level of padding when all values match. The X axis shows weeks remaining until departure when `weeksLeft` is available, ending at the last observation rather than drawing empty future weeks. Without `weeksLeft`, it shows elapsed weeks from the first observation. The fitted trend is dashed and spans only the observed interval.

The card labels **Sokker talent** from the roster separately from **estimated talent** calculated from the curve. The estimate fits a straight line by ordinary least squares to the distinct observed game-week coordinates. For a positive slope, `estimated talent = 1 / slope` in weeks per level. It requires at least four distinct observations. A flat or falling fit shows “no measurable progress” instead of a number. This estimate is a descriptive trend, not Sokker's hidden talent; it does not infer missing observations or correct level drops. The card displays estimates below 3 or above 12 as ranges.

The card can export a PNG using the shared Canvas export compositor. Its footer shows remaining weeks, the curve estimate, and `by manuel.team` in English. Card text supports English, Spanish, Polish, Portuguese, Italian, German, Romanian, Turkish, Slovak, and French, with English fallback.

## Implementation

- Route detection and hover: `src/content/juniorPage.ts`, `src/content/juniorCard.ts`.
- Fetch and per-visit refresh: `src/core/api.ts`, `src/core/juniorSync.ts`, `src/core/juniorRepository.ts`.
- Estimate and chart: `src/core/levelTrend.ts`, `src/core/juniorTalent.ts`, `src/ui-components/juniorCanvas.ts`, `src/ui-components/juniorExport.ts`.

Observed API response examples, if needed, are kept locally in the Git-ignored `docs/documentacion-talent/API-SOKKER.md`. The dated [design spec](../docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md) explains earlier decisions.
