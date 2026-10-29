# First-team skill progress in General Skills ++

**English** · [Español](TALENT_SUMMARY.es.md)

General Skills ++ reads the first-team history already saved in IndexedDB. Hover or focus a player's name on the squad, player, training setup, or training report details page to open the same two-column summary and weekly table. The training report keeps its separate junior hover on junior names. Hover or focus a skill value in the first-team view to see its native Canvas curve; clicking the value pins that card. Hovering does not sync, fetch, or write data.

Name and skill hover waits 400 ms before opening a card. Leaving earlier cancels opening, as do navigation and a row reused for another identity. Keyboard focus, `+` controls and clicks that pin a card remain immediate. Native Sokker clicks are preserved.

The supported beta squad and player pages use the same saved history and chart calculations as the classic pages. Their layout is recognized by route and structure, including when a beta route is served from the main domain. Table and card views share a player history read. On beta skill buttons, the native Sokker click remains available; hovering or focusing them opens the extension chart. Beta training setup and report rows have their own adapters. See the [verification record](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) for observed structures and runtime checks.

The **Main team progress** page, at both `/training/main-team-progress` and `/{locale}/app/training/main-team-progress/`, also provides name hover/focus and `+` controls for the summary, skill hover/focus for all eight charts, and the same observed-change value colors as the squad table. Native player development links keep working. Training setup accepts both the earlier markup and the table structure observed on October 29, 2026. Row IDs must agree with their player links; hidden or mismatched rows are ignored. These adapters were checked against the owner's locally saved pages; tracked regression fixtures use synthetic data.

The `+` controls appear beside player names in classic and beta views: they pin the summary and keep a subtle border. Skills have no `+` buttons; hovering or focusing a skill with the keyboard still opens its chart. Native Sokker actions remain available.

The popup includes **Show + history buttons**, enabled by default. This preference is saved per extension installation and browser profile and applies across supported hosts, including open tabs. Hiding the controls preserves existing name and skill hover/focus interactions. The preference is stored separately from history and does not change data or JSON backups.

See the [General Skills ++ screenshot](SCREENSHOTS.md#general-skills-summary) for an example of the summary and weekly table.

Skill-change indicators retain the last completed training result until the next training window, even after Sokker starts a new game week. When `/api/current` is available, the current report week is excluded before training (`day < 5`), even if its entries have valid dates. A missing current-week entry never discards the latest completed report. From `day >= 5`, the current report week becomes eligible; a completed report with unchanged levels clears the previous indicators. These are Sokker's game-day values, not the computer's local weekday.

Eligible observations use the chart's observed-week normalization and source priority. Repeated captures of a week collapse into one point. A carried-over or roster reference cannot establish a rise or drop on its own. Gaps allow a net change between real reports without assigning an exact change week. Invalid dates fall back to the stored report week. This calculation does not modify history or CSV data. Colors remain visible while a rescan or ordinary history refresh reads the same player and skill. When a change no longer applies, or the native value is reused for another player or skill, the original native styling is restored. Classic and beta player profiles show changes through colors, without arrows. Both highlight the numeric level and its text description in green for rises and red for drops, including in text-only beta cards. The description remains highlighted when numbers are omitted. Beta cards also highlight the skill name; native bars keep their colors. Highlighting survives native text-color updates. Squad and progress tables also show changes through colors only; no triangular change indicators are generated.

## What the two numbers mean

The eight skills follow the familiar player-page order: Stamina, Pace, Technique, Passing on the left; Keeper, Defending, Playmaking, Striker on the right. Each row shows a large **advanced** count and a smaller **formation** count. Hover or focus a count for its explanation.

- An advanced count includes a saved week when `training.kind === 'individual'`, `training.skill` matches that row, and `training.intensity > 0`.
- For every other displayed skill in that positive-intensity week, the count goes to formation. A `training.kind === 'formation'` report therefore adds formation to all eight skills, including its assigned skill. A positive-intensity `general` report also adds formation to all eight.
- Zero-intensity weeks and weeks without a real training report add neither count. Formation counts weeks without direct focus on that skill; they do not measure the amount of indirect progress or guarantee a skill increase.
- Counts start **after** the report that shows the last observed rise in that skill. If no rise was observed, or a report/whole week is missing in the relevant period, `≥` marks the number as a known minimum. `≥0` does not prove the player had no training.
- Each report week contributes at most one count per skill. The weekly table continues to show the report's actual training kind and effectiveness, which may differ from the per-skill counter category.

## What the curve means

Each skill card draws every saved level observation across the full game-week span in one 680 × 400 px chart, scaled down on narrow screens without horizontal scrolling. The Y axis stays at 0–18, with grid lines at every level and labels at even levels. The X axis labels only the first week, the last week, and weeks with an observed rise from a real report. Those rises have green dots; consecutive real reports use a solid blue line. Missing-week spans and reference snapshots use dashed lines, without inventing intermediate points. Carried-over values recorded during injury are orange, and roster-only snapshots use violet squares. The junior chart keeps its own scale.

The skill card and PNG show observed levels and rises without a fitted average line or weeks-per-level estimate. A rise after a gap is assigned to the later real report; the precise week of the change within that gap is unknown. Stamina shows its saved values on the same fixed scale.

Observed rises are **not Sokker's hidden talent**. Age, level, coaches, minutes, interruptions, and training type also affect progress. The old global average, ASCII progress bars, and “soon” marker are no longer shown.

## Weeks, sources, and exports

The summary modal uses 80% of the viewport height.

The weekly table keeps one row per report and its original columns. The summary card is at most 640 px wide, independent of its two-column grid; the skill card remains 720 px wide for its chart. The table fills the available height within the summary card and keeps the footer visible. On narrow screens, the table retains its horizontal scrolling. `Record` has a fixed width and visually truncates long text, with the full label available on hover. `Pos / Skill` starts at the same position in every row. Injury appears as an icon with an accessible explanation. If a report marks injury and `0` effectiveness, the visible record shows only the injury; CSV retains the original training kind.

The weekly table remains open beneath the two-column summary. Its `Week` and CSV `Week` fields retain the stored **report week**. For the curve, a Thursday/Friday capture uses that week; a Saturday–Wednesday capture is placed in the previous **observed week**. Calendar-day parsing is independent of the computer's timezone. An invalid date falls back to the stored week, marked `?` in the table and explained in the skill card and PNG; duplicate observed weeks prefer a real report, then the latest capture. Implausible old-week entries stamped on the latest capture day are excluded from analysis but remain visible in the table. The expanded level list labels carried-over and roster-only values as references.

The effectiveness cell has a yellow background with dark text only for real Advanced or Formation reports with effectiveness strictly greater than 49% and strictly less than 80%, excluding rows marked as injured. Values of 49% or less, 80% or more, unknown values, and reference rows keep the normal background. An injured row with zero effectiveness displays `—`; a positive recorded value remains visible without yellow highlighting. This is a display rule only: saved values and CSV exports retain the original effectiveness.

The table has one localized **Record** column in place of the old flag and `Kind` columns:

| Record | Meaning |
| --- | --- |
| Advanced / Formation | Real report with the corresponding training kind. |
| No report | Values carried from a prior week; no known training details. |
| Roster only | Snapshot from the current squad without a historical report. |
| Report without detail | Older real report without the `training` metadata. |

The injury icon does not claim that injury caused a missing report. The table keeps `Pos / Skill`, effectiveness, levels, and CSV export. The CSV keeps the original source, kind, skill, position, intensity, minutes, report week, and level columns. The skill PNG uses the shared Canvas compositor, an English `Skill · weeks first–last` footer, and `by manuel.team`.

New card text supports English, Spanish, Polish, Portuguese, Italian, German, Romanian, Turkish, Slovak, and French, with English fallback. The PNG footer stays in English.

## Implementation and limits

- Timeline normalization: `src/core/playerTimeline.ts`.
- Focused counts: `src/core/talent.ts`.
- Native chart and PNG: `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/playerSkillExport.ts`, and the shared `chartExport.ts`.
- Cards, translations, and hover lifecycle: `src/content/playerCard.ts`, `src/content/playerLocale.ts`, `src/content/tooltip.ts`, and `src/content/ui.ts`.

Older history may have skill levels without training details. Missing reports and weeks make focused counts a minimum. A rise between two real observations is assigned to the later report only to define the count window; its precise day and training cause are unknown. No private API captures are needed to use this feature.
