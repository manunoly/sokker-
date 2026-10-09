# Talent summary (direct training since last pop)

**English** · [Español](TALENT_SUMMARY.es.md)

Block shown above the table of the **General Skills ++** panel (history tooltip, `#sokkerpp-history-tooltip`). For each skill it shows how many direct trainings the player has received since that skill's last pop, and estimates the player's **talent**: how many direct trainings a skill needs to go up one level.

- Calculation: `src/core/talent.ts` → `computeTalentSummary(history)` (pure function, no DOM or network).
- Rendering: `src/content/tooltip.ts` → `renderTalentSummary(summary)`.
- Tests: `src/core/talent.test.ts`, `src/content/tooltip.test.ts`.
- Data: the weekly history already stored in IndexedDB (`PlayerHistoryEntry`: `week`, `skills`, `training`, `source`). It makes no new API calls.
- History: the first sync tries to backfill up to 30 weeks (past weeks that come back empty are not requested again). Verified on 2026-10-09: the Sokker API only returns the last 10 weeks, so a longer history only builds up by keeping the extension installed; after that the history grows without limit. Training data (kind/skill/intensity) only exists for weeks stored since 2026-04-15; older weeks have skills but no training.
- `computeTalentSummary` expects at most one entry per week (the caller dedupes).

## Sokker concepts

- **Advanced training** (`kind: 'individual'`, 🎯 in the table): trains one specific skill. It is the only training used to measure talent.
- **Formation training** (`kind: 'formation'`, 📋): treated as **general training (GT)**. It never counts as direct.
- **Talent**: approximate number of direct trainings a skill needs to go up one level. It is not exact:
  - it changes with age (young players improve faster; older players need more trainings);
  - each skill has its own pace (e.g. Pace every ~5, Playmaking every ~4).

## Rules

### R1 — Direct training

A week counts as **direct training** for skill X if and only if all three conditions hold:

| Condition | Value |
|---|---|
| Training kind | `training.kind === 'individual'` |
| Trained skill | `training.skill === X` |
| Effectiveness | `training.intensity >= 50` |

- **Minutes played do not matter**: a player with 0 minutes can still get 50% of the training in the intensity, and that counts.
- *Carry-over* weeks (no `training`) add no direct trainings, but they are known weeks: they do not invalidate the interval.
- Weeks without training data that are not *carry-over* (legacy, before 2026-04-15) are "unknown": they add no direct trainings and make the interval incomplete. *Carry-over* weeks are known (no report = 0 direct trainings).
- A week that does not meet the conditions adds nothing, but does not reset the counter either.

### R2 — Pop

Skill X **pops** in week W when `skills[X]` in W is greater than in the previous history entry, with the history sorted by `week` ascending.

- The value in W already includes W's training. So if W was a direct training, that training counts toward the interval that ends at that pop.
- It is the same detection that paints table cells green.
- A decrease is not a pop and does not reset the counter.

### R3 — Counter reset

**Any pop resets the counter to 0**, whether it came from direct training or from GT.

### R4 — "Since last pop" counter

`sinceLastPop` = direct trainings accumulated since that skill's last pop.

- It is shown as `≥ N` (the counter is a minimum) when no pop has been observed, or when there is a week with unknown training data since the last pop.

### R5 — Complete intervals

An **interval** is the number of direct trainings between two consecutive observed pops.

- The interval before the **first** observed pop is incomplete (its start is unknown) and **is not used**.
- Intervals with **0 direct trainings** (pop from GT only) **are not used** for talent, so they do not lower it artificially.
- Intervals that contain a week with unknown training data (legacy) **are not used**.
- Intervals that contain a skill decrease **are not used** (dropping and recovering does not count as a full level).

### R6 — Talent per skill

`talent` = average of that skill's complete intervals (R5). If there are none, talent is unknown (`?`).

### R7 — Overall player talent

`overallTalent` = sum of all used intervals across all skills ÷ number of those intervals. Each pop weighs the same. If there are no intervals, it is unknown (`?`).

### R8 — Listed skills and order

1. **Kp (keeper)** first, only if the latest keeper value in the history is **greater than 6**; the player is then considered a goalkeeper. With 6 or less it is not shown.
2. Then, always in this order: **Pc** (pace), **Tec** (technique), **Pas** (passing), **Def** (defending), **Plm** (playmaking), **Str** (striker).
3. **Stamina is never shown.**
4. Every listed skill is shown even with 0 trainings, so the block always has the same shape.

## Presentation

```
 DIRECT TRAINING SINCE LAST POP                    Est. talent ≈ 4.5
  Pc    ■■□□□   2 / ~5    last pop wk 1182 · after 5
  Tec   □□□□□   ≥ 0 / ?   no pop in history
  Plm   ■■■■□   4 / ~4    last pop wk 1176 · after 4             ▲?
```

| Element | Meaning |
|---|---|
| `2 / ~5` | counter (R4) / skill talent (R6) |
| `≥ 0` | the counter is a minimum (R4): no pop observed, or weeks with unknown training since the last pop |
| `?` | unknown talent (no complete intervals) |
| `■□` bar | counter progress toward the skill's talent. If the skill has no talent of its own, the overall talent (R7) is used. If there is neither, no bar is drawn. Rounded to the nearest integer. |
| `last pop wk W · after N` | week of the last pop and direct trainings in the interval that ended there (`after` is omitted if it was the first observed pop) |
| `▲?` | the counter reached the bar size (the skill's talent, or the overall talent when the skill has none) |
| `Est. talent ≈ X` | overall player talent (R7) |

- The panel text is in English, like the rest of the tooltip.
- The panel footer shows `History: N wks (A–B)`: how far back the player's stored history goes, from the oldest (A) to the newest (B) week, gaps included.
- Numbers use `font-variant-numeric: tabular-nums`. The bar is decorative (`aria-hidden="true"`). Each row has a `title` explaining the calculation.

## Known limitations

- Legacy weeks (before 2026-04-15) have no training data and are not downloaded again: intervals that cross them are excluded and counters may be a minimum. With little usable history, talent will be `?` or based on few intervals.
- Real talent changes with age: an average of old intervals may overestimate how fast a player who has aged improves.
- If the history has missing weeks filled in as *carry-over*, those weeks add no direct trainings. The counter may be lower than the real one.
