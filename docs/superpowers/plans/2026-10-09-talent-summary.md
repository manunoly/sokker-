# Talent Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar encima de la tabla del panel "General Skills ++" un resumen por skill de entrenos directos acumulados desde la última subida, con talento estimado.

**Architecture:** Módulo puro `src/core/talent.ts` calcula el resumen a partir del historial semanal ya guardado (sin API ni DB nuevas). `tooltip.ts` lo renderiza como bloque HTML entre el `<h3>` y la `<table>`.

**Tech Stack:** TypeScript, Vitest (jsdom), Vite.

**Spec:** Reglas acordadas con el usuario en conversación (2026-10-09), copiadas en "Reglas de dominio".

## Reglas de dominio (vinculantes)

1. **Entreno directo** de la skill X en una semana ⇔ `training.kind === 'individual'` **y** `training.skill === X` **y** `training.intensity >= 50`. Los minutos NO cuentan (un jugador con 0 min puede recibir 50 %). Formación = GT, nunca directo. Semanas sin `training` (carry-over) no cuentan.
2. **Subida (pop)** de X en la semana W ⇔ `skills[X]` en W > `skills[X]` en la entrada anterior (orden por `week` ascendente). El valor de W ya incluye el entreno de W: el directo de W cuenta para el tramo que termina en esa subida.
3. **Cualquier subida** (directa o por GT) reinicia el contador a 0.
4. **Contador** (`sinceLastPop`) = directos desde la última subida. Si no hubo subida en el historial, `hasPop = false` y se muestra `≥ N`.
5. **Tramo completo** = directos entre dos subidas observadas consecutivas. El tramo previo a la primera subida observada es incompleto y no se usa. Los tramos con 0 directos (subida solo por GT) no se usan para talento.
6. **Talento por skill** = media de sus tramos completos (con >0 directos); `null` si no hay.
7. **Talento global** = suma de todos los tramos usados de todas las skills ÷ número de esos tramos; `null` si no hay.
8. **Skills listadas** (siempre todas, aun con 0): si el último `skills.keeper > 6` → `keeper` primero; luego `pace, technique, passing, defending, playmaking, striker`. Nunca `stamina`.

## Global Constraints

- Cero dependencias en runtime; cero `class`; estilo funcional.
- Rama `feat/talent-summary` creada desde `chore/review-fixes` (su punta, que ya incluye este plan). Un commit por tarea, con `Co-Authored-By`.
- Validación por tarea: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- Texto del panel en inglés (como el resto del panel). Números con `font-variant-numeric: tabular-nums`; barra decorativa con `aria-hidden="true"`.
- Fuera de alcance: cambios en DB, API, columnas de la tabla o CSV.

## Review Focus

1. Intensidad exactamente 50 con 0 minutos → cuenta como directo (Task 1 test).
2. Historial desordenado → mismo resultado que ordenado (Task 1 test).
3. Subida solo por GT → reinicia contador y no rebaja el talento (Task 1 test).
4. Keeper = 6 → no es GK; keeper = 7 → GK primero (Task 1 test).
5. Skill sin talento propio → barra usa el talento global; sin ninguno → sin barra (Task 2 test).

---

### Task 1: `computeTalentSummary` (lógica pura)

**Files:**
- Create: `src/core/talent.ts`
- Test: `src/core/talent.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TalentSkill = 'keeper' | 'pace' | 'technique' | 'passing' | 'defending' | 'playmaking' | 'striker';
  export interface TalentRow { skill: TalentSkill; sinceLastPop: number; hasPop: boolean; lastPopWeek: number | null; lastPopAfter: number | null; talent: number | null; }
  export interface TalentSummary { rows: TalentRow[]; overallTalent: number | null; }
  export function computeTalentSummary(history: Array<Pick<PlayerHistoryEntry, 'week' | 'skills' | 'training'>>): TalentSummary;
  ```
  `lastPopAfter` = directos del tramo que terminó en la última subida (`null` si esa subida es la primera observada).

- [ ] **Step 1: Write the failing tests** (`src/core/talent.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { computeTalentSummary, TalentSkill, TalentSummary } from './talent';
import { Skills, TrainingReport } from '../types/index';

const BASE: Skills = {
    stamina: 10, keeper: 1, playmaking: 10, passing: 10, technique: 10, defending: 10,
    striker: 10, pace: 10, tacticalDiscipline: 10, form: 10, teamwork: 10, experience: 10,
};

const wk = (week: number, skills: Partial<Skills>, training?: Partial<TrainingReport>) => ({
    week,
    skills: { ...BASE, ...skills } as Skills,
    training: training
        ? ({ kind: 'individual', skill: 'pace', position: 'MID', intensity: 100, minutes: 90, ...training } as TrainingReport)
        : undefined,
});

const row = (s: TalentSummary, skill: TalentSkill) => s.rows.find((r) => r.skill === skill)!;

describe('computeTalentSummary', () => {
    it('counts only advanced training on that skill with intensity >= 50, ignoring minutes', () => {
        const s = computeTalentSummary([
            wk(1, {}, {}),                                  // direct
            wk(2, {}, { kind: 'formation' }),               // GT
            wk(3, {}, { skill: 'passing' }),                // other skill
            wk(4, {}, { intensity: 49 }),                   // too weak
            wk(5, {}, { intensity: 50, minutes: 0 }),       // direct
            wk(6, {}),                                      // no training (carry-over)
        ]);
        expect(row(s, 'pace')).toMatchObject({ sinceLastPop: 2, hasPop: false, lastPopWeek: null, talent: null });
        expect(row(s, 'passing').sinceLastPop).toBe(1);
    });

    it('resets on pop and estimates talent from complete intervals only (input order irrelevant)', () => {
        const history = [
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}),                          // first pop: incomplete interval
            wk(3, { pace: 11 }, {}), wk(4, { pace: 11 }, {}), wk(5, { pace: 11 }, {}), wk(6, { pace: 12 }, {}), // 4 directs
            wk(7, { pace: 12 }, {}), wk(8, { pace: 12 }, {}),
        ];
        const s = computeTalentSummary([...history].reverse());
        expect(row(s, 'pace')).toEqual({ skill: 'pace', sinceLastPop: 2, hasPop: true, lastPopWeek: 6, lastPopAfter: 4, talent: 4 });
    });

    it('resets on a GT-only pop without lowering talent', () => {
        const s = computeTalentSummary([
            wk(1, { pace: 10 }, {}), wk(2, { pace: 11 }, {}),                          // first pop
            wk(3, { pace: 11 }, {}), wk(4, { pace: 11 }, {}), wk(5, { pace: 12 }, {}), // 3 directs
            wk(6, { pace: 13 }, { kind: 'formation' }),                                // GT pop, 0 directs
            wk(7, { pace: 13 }, {}),
        ]);
        expect(row(s, 'pace')).toMatchObject({ sinceLastPop: 1, lastPopWeek: 6, lastPopAfter: 0, talent: 3 });
        expect(s.overallTalent).toBe(3);
    });

    it('computes overall talent across skills weighted by interval', () => {
        const s = computeTalentSummary([
            wk(1, { pace: 10, playmaking: 10 }),
            wk(2, { pace: 11, playmaking: 11 }),                                         // first pops
            wk(3, { pace: 11, playmaking: 11 }, {}), wk(4, { pace: 11, playmaking: 11 }, {}),
            wk(5, { pace: 11, playmaking: 11 }, {}), wk(6, { pace: 12, playmaking: 11 }, {}), // pace: 4
            wk(7, { pace: 12, playmaking: 11 }, { skill: 'playmaking' }),
            wk(8, { pace: 12, playmaking: 11 }, { skill: 'playmaking' }),
            wk(9, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),               // playmaking: 3
            wk(10, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(11, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(12, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(13, { pace: 12, playmaking: 12 }, { skill: 'playmaking' }),
            wk(14, { pace: 12, playmaking: 13 }, { skill: 'playmaking' }),              // playmaking: 5
        ]);
        expect(row(s, 'pace').talent).toBe(4);
        expect(row(s, 'playmaking').talent).toBe(4);
        expect(s.overallTalent).toBe(4); // (4 + 3 + 5) / 3
    });

    it('lists skills in order, never stamina, keeper first only when keeper > 6', () => {
        const order = (keeper: number) => computeTalentSummary([wk(1, { keeper })]).rows.map((r) => r.skill);
        expect(order(6)).toEqual(['pace', 'technique', 'passing', 'defending', 'playmaking', 'striker']);
        expect(order(7)).toEqual(['keeper', 'pace', 'technique', 'passing', 'defending', 'playmaking', 'striker']);
    });

    it('handles empty history', () => {
        const s = computeTalentSummary([]);
        expect(s.overallTalent).toBeNull();
        expect(s.rows.every((r) => r.sinceLastPop === 0 && r.talent === null && !r.hasPop)).toBe(true);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/talent.test.ts` → FAIL (`./talent` no existe).

- [ ] **Step 3: Implementación** (`src/core/talent.ts`)

```ts
import { PlayerHistoryEntry, TrainingReport } from '../types/index';

export type TalentSkill = 'keeper' | 'pace' | 'technique' | 'passing' | 'defending' | 'playmaking' | 'striker';

export interface TalentRow {
    skill: TalentSkill;
    sinceLastPop: number;
    hasPop: boolean;
    lastPopWeek: number | null;
    lastPopAfter: number | null;
    talent: number | null;
}

export interface TalentSummary {
    rows: TalentRow[];
    overallTalent: number | null;
}

type HistoryPoint = Pick<PlayerHistoryEntry, 'week' | 'skills' | 'training'>;

const FIELD_SKILLS: TalentSkill[] = ['pace', 'technique', 'passing', 'defending', 'playmaking', 'striker'];
const GK_THRESHOLD = 6;
const MIN_DIRECT_INTENSITY = 50;

const isDirectTraining = (training: TrainingReport | undefined, skill: TalentSkill): boolean =>
    training?.kind === 'individual' && training.skill === skill && training.intensity >= MIN_DIRECT_INTENSITY;

const average = (values: number[]): number | null =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function analyzeSkill(sorted: HistoryPoint[], skill: TalentSkill): { row: TalentRow; intervals: number[] } {
    let count = 0;
    let pops = 0;
    let lastPopWeek: number | null = null;
    let lastPopAfter: number | null = null;
    const intervals: number[] = [];

    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        if (isDirectTraining(entry.training, skill)) count++;
        if (i > 0 && entry.skills[skill] > sorted[i - 1].skills[skill]) {
            lastPopAfter = pops > 0 ? count : null;
            if (pops > 0 && count > 0) intervals.push(count);
            pops++;
            lastPopWeek = entry.week;
            count = 0;
        }
    }

    return {
        row: { skill, sinceLastPop: count, hasPop: pops > 0, lastPopWeek, lastPopAfter, talent: average(intervals) },
        intervals,
    };
}

export function computeTalentSummary(history: HistoryPoint[]): TalentSummary {
    const sorted = [...history].sort((a, b) => a.week - b.week);
    const latestKeeper = sorted.length ? sorted[sorted.length - 1].skills.keeper : 0;
    const skills: TalentSkill[] = latestKeeper > GK_THRESHOLD ? ['keeper', ...FIELD_SKILLS] : FIELD_SKILLS;

    const analyses = skills.map((skill) => analyzeSkill(sorted, skill));
    return {
        rows: analyses.map((a) => a.row),
        overallTalent: average(analyses.flatMap((a) => a.intervals)),
    };
}
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run src/core/talent.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/talent.ts src/core/talent.test.ts
git commit -m "feat(talent): compute direct-training counters and talent estimate per skill"
```

---

### Task 2: Render del bloque en el panel

**Files:**
- Modify: `src/content/tooltip.ts` (imports; nueva `renderTalentSummary`; insertar tras el `<h3>…General Skills ++</h3>` ~línea 428)
- Test: `src/content/tooltip.test.ts`

**Interfaces:**
- Consumes: `computeTalentSummary`, `TalentSummary`, `TalentSkill` de `../core/talent` (Task 1).
- Produces: `export function renderTalentSummary(summary: TalentSummary): string`.

- [ ] **Step 1: Write the failing tests** (añadir a `tooltip.test.ts`; añadir `renderTalentSummary` al import de `./tooltip` y `import { TalentSummary } from '../core/talent';`)

```ts
describe('renderTalentSummary', () => {
    const base = { hasPop: true, lastPopWeek: 1176, lastPopAfter: 4 };

    it('renders progress bar and soon marker when counter reaches talent', () => {
        const html = renderTalentSummary({
            rows: [{ ...base, skill: 'pace', sinceLastPop: 4, talent: 4 }],
            overallTalent: 4,
        } as TalentSummary);
        expect(html).toContain('Pc');
        expect(html).toContain('■■■■');
        expect(html).toContain('▲?');
        expect(html).toContain('last pop wk 1176 · after 4');
    });

    it('shows ≥ and ? without bar when there is no pop and no talent', () => {
        const html = renderTalentSummary({
            rows: [{ skill: 'technique', sinceLastPop: 1, hasPop: false, lastPopWeek: null, lastPopAfter: null, talent: null }],
            overallTalent: null,
        });
        expect(html).toContain('≥ 1 / ?');
        expect(html).toContain('no pop in history');
        expect(html).not.toContain('■');
        expect(html).not.toContain('▲?');
    });

    it('falls back to overall talent for the bar', () => {
        const html = renderTalentSummary({
            rows: [{ ...base, skill: 'passing', sinceLastPop: 2, talent: null }],
            overallTalent: 5,
        } as TalentSummary);
        expect(html).toContain('■■□□□');
        expect(html).toContain('2 / ?');
        expect(html).toContain('Est. talent ≈ 5');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/content/tooltip.test.ts` → FAIL (`renderTalentSummary` no exportado).

- [ ] **Step 3: Implementación** (`tooltip.ts`)

Imports:

```ts
import { computeTalentSummary, TalentSkill, TalentSummary } from '../core/talent';
```

Función nueva (junto a `renderSkillAtPosCell`):

```ts
const TALENT_LABELS: Record<TalentSkill, string> = {
    keeper: 'Kp', pace: 'Pc', technique: 'Tec', passing: 'Pas', defending: 'Def', playmaking: 'Plm', striker: 'Str',
};
const talentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function renderTalentSummary(summary: TalentSummary): string {
    const rowsHtml = summary.rows.map((r) => {
        const target = r.talent ?? summary.overallTalent;
        const cells = target !== null ? Math.round(target) : 0;
        const filled = Math.min(r.sinceLastPop, cells);
        const bar = '■'.repeat(filled) + '□'.repeat(cells - filled);
        const count = r.hasPop ? `${r.sinceLastPop}` : `≥ ${r.sinceLastPop}`;
        const talent = r.talent !== null ? `~${talentFormat.format(r.talent)}` : '?';
        const soon = target !== null && r.sinceLastPop >= target ? '▲?' : '';
        const detail = r.lastPopWeek === null
            ? 'no pop in history'
            : `last pop wk ${r.lastPopWeek}${r.lastPopAfter !== null ? ` · after ${r.lastPopAfter}` : ''}`;
        const label = TALENT_LABELS[r.skill];
        return `<tr title="Advanced trainings (intensity ≥ 50%) since the last ${label} pop">`
            + `<td style="padding:2px 6px;text-align:left;color:#fff;">${label}</td>`
            + `<td aria-hidden="true" style="padding:2px 6px;text-align:left;color:#8fbf8f;letter-spacing:1px;">${bar}</td>`
            + `<td style="padding:2px 6px;text-align:right;color:#fff;">${count} / ${talent}</td>`
            + `<td style="padding:2px 6px;text-align:left;color:#aaa;">${detail}</td>`
            + `<td style="padding:2px 6px;color:#e0c060;">${soon}</td>`
            + `</tr>`;
    }).join('');
    const overall = summary.overallTalent !== null ? `≈ ${talentFormat.format(summary.overallTalent)}` : '?';
    return `<div style="margin:0 0 10px 0;padding:6px 8px;background:#2a2a2a;border:1px solid #444;border-radius:4px;font-size:11px;font-variant-numeric:tabular-nums;">`
        + `<div style="display:flex;justify-content:space-between;color:#aaa;margin-bottom:4px;">`
        + `<span>DIRECT TRAINING SINCE LAST POP</span>`
        + `<span title="Average advanced trainings per pop, all skills">Est. talent ${overall}</span>`
        + `</div>`
        + `<table style="border-collapse:collapse;width:100%;">${rowsHtml}</table>`
        + `</div>`;
}
```

(Todo el contenido son números o constantes → no requiere `escapeHtml`.)

En `showHistoryTooltip`, dentro del template `html`, justo después de `</h3>` y antes de `<table`:

```ts
        ${renderTalentSummary(computeTalentSummary(rows))}
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run && npx tsc --noEmit && npm run build` → PASS.
Manual: recargar `dist/` en `chrome://extensions`, pasar el ratón sobre un jugador → bloque visible sobre la tabla; contadores coherentes con las filas 🎯 de la tabla.

- [ ] **Step 5: Commit**

```bash
git add src/content/tooltip.ts src/content/tooltip.test.ts
git commit -m "feat(tooltip): show direct-training talent summary above General Skills table"
```
