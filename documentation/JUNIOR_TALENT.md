# Junior talent in Sokker++

**English** · [Español](JUNIOR_TALENT.es.md)

The junior card appears when you hover or focus a junior's name in a training report details page (`/{locale}/app/training/reports/details/{week}/`) or on **your own** `/juniors/teamID/{teamId}/` page. It opens left of the name in a report and right of the name in the academy. The extension checks the current team ID before enabling the academy card. The hover reads IndexedDB; it does not fetch the graph on hover.

See [screenshots of the card and its PNG export](SCREENSHOTS.md#junior-talent-card).

## Data and weekly synchronization

On an eligible page, the extension obtains the current game week and team from `/api/current`. It reads visible junior IDs, uses `/api/junior?filter[limit]=100` for the current roster, Sokker's own `talent`, and `weeksLeft`, and requests `/api/junior/{id}/graph` for observed level points when needed. Up to three graph requests run at once. Results are saved in the junior store of the same `SokkerTalentTrackerDB` as the first-team history.

For a junior already resolved in the current game week, the saved graph is reused. A newly visible ID or a new game week may require another roster or graph request. An absent junior is recorded for the week when the roster is complete; the card can still show previously saved history. If the 100-entry roster limit is reached, absence is treated as unknown. Leaving the page cancels queued work. Imported JSON backups can include junior history; a restore does not treat an old roster snapshot as current.

## Chart and estimate

Canvas draws only observed levels. Consecutive observed weeks have a solid line; gaps stay unconnected. The Y scale runs from the lowest to the highest observed level, with one level of padding when all values match. The X axis shows weeks remaining until departure when `weeksLeft` is available, ending at the last observation rather than drawing empty future weeks. Without `weeksLeft`, it shows elapsed weeks from the first observation. The fitted trend is dashed and spans only the observed interval.

The card labels **Sokker talent** from the roster separately from **estimated talent** calculated from the curve. The estimate fits a straight line by ordinary least squares to the distinct observed game-week coordinates. For a positive slope, `estimated talent = 1 / slope` in weeks per level. It requires at least four distinct observations. A flat or falling fit shows “no measurable progress” instead of a number. This estimate is a descriptive trend, not Sokker's hidden talent; it does not infer missing observations or correct level drops. The card displays estimates below 3 or above 12 as ranges.

The card can export a PNG using the shared Canvas export compositor. Its footer shows remaining weeks, the curve estimate, and `by manuel.team` in English. Card text supports English, Spanish, Polish, Portuguese, Italian, German, Romanian, Turkish, and Slovak, with English fallback.

## Implementation

- Route detection and hover: `src/content/juniorPage.ts`, `src/content/juniorCard.ts`.
- Fetch and weekly cache: `src/core/api.ts`, `src/core/juniorSync.ts`, `src/core/juniorRepository.ts`.
- Estimate and chart: `src/core/levelTrend.ts`, `src/core/juniorTalent.ts`, `src/ui-components/juniorCanvas.ts`, `src/ui-components/juniorExport.ts`.

Observed API response examples, if needed, are kept locally in the Git-ignored `docs/documentacion-talent/API-SOKKER.md`. The dated [design spec](../docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md) explains earlier decisions.
