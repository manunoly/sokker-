# First-team skill progress in General Skills ++

**English** · [Español](TALENT_SUMMARY.es.md)

General Skills ++ reads the first-team history already saved in IndexedDB. Hover or focus a player's name to open the two-column summary and the weekly table. Hover or focus a skill value to see its native Canvas curve; clicking the value pins that card. Hovering does not sync, fetch, or write data.

## What the two numbers mean

The eight skills follow the familiar player-page order: Stamina, Pace, Technique, Passing on the left; Keeper, Defending, Playmaking, Striker on the right. Each row shows a large **advanced** count and a smaller **formation** count. Hover or focus a count for its explanation.

- An advanced count includes a saved week when `training.kind === 'individual'`, `training.skill` matches that row, and `training.intensity > 0`.
- A formation count uses the same assigned-skill and positive-intensity rules with `training.kind === 'formation'`.
- A training assigned to `general` or another skill is not assigned to this row. An observed skill rise may still have received indirect training; the stored report cannot measure that contribution by skill.
- Counts start **after** the report that shows the last observed rise in that skill. If no rise was observed, or a report/whole week is missing in the relevant period, `≥` marks the number as a known minimum. `≥0` does not prove the player had no training.
- Each report week contributes at most one count to its assigned skill and kind. The effectiveness percentage remains visible in the weekly table.

## What the curve means

Each skill card draws every saved level observation across the full game-week span in one 680 × 400 px chart, scaled down on narrow screens without horizontal scrolling. The Y axis stays at 0–18, with grid lines at every level and labels at even levels. The X axis labels only the first week, the last week, and weeks with an observed rise from a real report. Those rises have green dots; consecutive real reports use a solid blue line. Missing-week spans and reference snapshots use dashed lines, without inventing intermediate points. Carried-over values recorded during injury are orange, and roster-only snapshots use violet squares. The junior chart keeps its own scale.

The skill card and PNG show observed levels and rises without a fitted average line or weeks-per-level estimate. A rise after a gap is assigned to the later real report; the precise week of the change within that gap is unknown. Stamina shows its saved values on the same fixed scale.

Observed rises are **not Sokker's hidden talent**. Age, level, coaches, minutes, interruptions, and training type also affect progress. The old global average, ASCII progress bars, and “soon” marker are no longer shown.

## Weeks, sources, and exports

The summary modal uses 80% of the viewport height.

The weekly table keeps one row per report and its original columns. The summary card is at most 640 px wide, independent of its two-column grid; the skill card remains 720 px wide for its chart. The table fills the available height within the summary card and keeps the footer visible. On narrow screens, the table retains its horizontal scrolling. `Record` has a fixed width and visually truncates long text, with the full label available on hover. `Pos / Skill` starts at the same position in every row. Injury appears as an icon with an accessible explanation. If a report marks injury and `0` effectiveness, the visible record shows only the injury; CSV retains the original training kind.

The weekly table remains open beneath the two-column summary. Its `Week` and CSV `Week` fields retain the stored **report week**. For the curve, a Thursday/Friday capture uses that week; a Saturday–Wednesday capture is placed in the previous **observed week**. Calendar-day parsing is independent of the computer's timezone. An invalid date falls back to the stored week, marked `?` in the table and explained in the skill card and PNG; duplicate observed weeks prefer a real report, then the latest capture. Implausible old-week entries stamped on the latest capture day are excluded from analysis but remain visible in the table. The expanded level list labels carried-over and roster-only values as references.

The table has one localized **Record** column in place of the old flag and `Kind` columns:

| Record | Meaning |
| --- | --- |
| Advanced / Formation | Real report with the corresponding training kind. |
| No report | Values carried from a prior week; no known training details. |
| Roster only | Snapshot from the current squad without a historical report. |
| Report without detail | Older real report without the `training` metadata. |

The injury icon does not claim that injury caused a missing report. The table keeps `Pos / Skill`, effectiveness, levels, and CSV export. The CSV keeps the original source, kind, skill, position, intensity, minutes, report week, and level columns. The skill PNG uses the shared Canvas compositor, an English `Skill · weeks first–last` footer, and `by manuel.team`.

New card text supports English, Spanish, Polish, Portuguese, Italian, German, Romanian, and Turkish, with English fallback. The PNG footer stays in English.

## Implementation and limits

- Timeline normalization: `src/core/playerTimeline.ts`.
- Counts and per-skill pace: `src/core/talent.ts` and `src/core/levelTrend.ts`.
- Native chart and PNG: `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/playerSkillExport.ts`, and the shared `chartExport.ts`.
- Cards, translations, and hover lifecycle: `src/content/playerCard.ts`, `src/content/playerLocale.ts`, `src/content/tooltip.ts`, and `src/content/ui.ts`.

Older history may have skill levels without training details. Missing reports and weeks make focused counts a minimum. A rise between two real observations is assigned to the later report only to define the count window; its precise day and training cause are unknown. No private API captures are needed to use this feature.
