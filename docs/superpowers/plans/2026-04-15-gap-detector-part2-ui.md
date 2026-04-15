# Gap Detector Part 2 — UI surfacing + manual trigger + auto-trigger on squad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer visible al usuario qué entradas del histórico son `source:'carried-over'`, ofrecer un botón manual de reparación en el popup, y disparar `reconcileGaps()` automáticamente (best-effort, no bloqueante) cuando el usuario navega a `/app/squad/`.

**Architecture:** Los datos ya traen `source` e `injured` desde Part 1. Esta fase solo surface ese dato:
- `prepareChartData` (tooltip) pasa `source`/`injured` por punto. `drawChart` dibuja segmentos que terminan en un punto `carried-over` con línea punteada atenuada y los puntos carry-over con relleno distinto (naranja para `injured:true`, gris para unknown).
- `showHistoryTooltip` añade una columna de estado al inicio de cada fila: 🩹 si `injured`, ⏸ si `carried-over` sin injury confirmado, vacío si `training`.
- `observer.ts` gana un parámetro opcional `onSquadReady` que dispara `reconcileGaps()` en `requestIdleCallback` cuando detecta `/app/squad/`.
- `main.ts` añade handler `REPAIR_HISTORY` que invoca `reconcileGaps()` y responde con `ReconcileResult`.
- `popup/` añade botón "Repair History" que envía `REPAIR_HISTORY`, muestra `gapsFilled` / `error` en el status div.

**Tech Stack:** mismo stack de Part 1 (Vite 7, TS, Vitest 4, canvas nativo, Chrome MV3).

---

## Archivos que se crean o modifican

**Modificar:**
- `src/ui-components/canvas.ts` — extender `drawChart` y la shape de `dataPoints` para aceptar `source?` y `injured?`; renderizar segmentos y puntos con estilo diferenciado.
- `src/content/tooltip.ts` — `prepareChartData` preserva `source` e `injured` por punto; `showHistoryTooltip` añade columna "Status" con icono 🩹 / ⏸.
- `src/content/tooltip.test.ts` — tests sobre `prepareChartData` para confirmar pass-through.
- `src/content/observer.ts` — exponer hook adicional `onSquadReady` que se dispara en idle cuando la ruta es `/app/squad/`.
- `src/content/main.ts` — cablear el `onSquadReady` hook con `reconcileGaps`; añadir handler de mensaje `REPAIR_HISTORY`.
- `popup/index.html` — nuevo botón "Repair History".
- `popup/popup.ts` — handler del nuevo botón.

**No se crean archivos nuevos** — todo vive en los módulos existentes.

---

## Invariantes (heredadas de Part 1)

Nada nuevo. Solo consumimos `source` e `injured`; no escribimos ni mutamos snapshots. R1–R4 siguen vigentes.

---

## Task 1: Canvas — estilo diferenciado por `source`

**Files:**
- Modify: `src/ui-components/canvas.ts`

- [ ] **Step 1.1: Extender la shape pública de `dataPoints` y `ChartOptions`**

Abrir `src/ui-components/canvas.ts`. Reemplazar la firma y la interfaz.

Reemplazar:
```ts
export interface ChartOptions {
    forceYRange?: [number, number];
    showAllXLabels?: boolean;
    showGrid?: boolean;
}
```

por:

```ts
export type ChartPointSource = 'training' | 'carried-over' | 'roster-fallback';

export interface ChartPoint {
    week: number;
    value: number;
    source?: ChartPointSource;
    injured?: boolean;
}

export interface ChartOptions {
    forceYRange?: [number, number];
    showAllXLabels?: boolean;
    showGrid?: boolean;
}
```

Reemplazar la firma de `drawChart` de:

```ts
export function drawChart(ctx: CanvasRenderingContext2D, dataPoints: Array<{ week: number, value: number }>, width: number, height: number, options?: ChartOptions): void {
```

a:

```ts
export function drawChart(ctx: CanvasRenderingContext2D, dataPoints: ChartPoint[], width: number, height: number, options?: ChartOptions): void {
```

- [ ] **Step 1.2: Dibujar segmentos de línea por tramos (solid vs dashed)**

Localizar el bloque "Draw Line" (aprox. `ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.beginPath();` seguido del `forEach`). Reemplazarlo por:

```ts
    // Draw Line — segment by segment. A segment ending on a carried-over point
    // (or starting from one) is rendered dashed + atenuated to signal that the
    // training data for that week was inferred, not observed.
    const SOLID_COLOR = '#00ff00';
    const CARRY_COLOR = '#888';

    for (let i = 1; i < sortedData.length; i++) {
        const prev = sortedData[i - 1];
        const curr = sortedData[i];
        const anyCarry = prev.source === 'carried-over' || curr.source === 'carried-over';

        ctx.beginPath();
        ctx.moveTo(getX(prev.week), getY(prev.value));
        ctx.lineTo(getX(curr.week), getY(curr.value));
        ctx.setLineDash(anyCarry ? [4, 3] : []);
        ctx.strokeStyle = anyCarry ? CARRY_COLOR : SOLID_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset for any subsequent drawing
```

- [ ] **Step 1.3: Diferenciar los puntos por `source` e `injured`**

Localizar el bloque "Draw Points". Reemplazarlo por:

```ts
    // Draw Points — color conveys source. Training = white, carry-over = gray,
    // carry-over + injured-inferred = orange. Radius is slightly smaller for
    // non-training to visually de-emphasize inferred data.
    sortedData.forEach((point) => {
        const x = getX(point.week);
        const y = getY(point.value);

        let fill = '#fff';
        let radius = 3;
        if (point.source === 'carried-over') {
            fill = point.injured ? '#ff9900' : '#888';
            radius = 2.5;
        } else if (point.source === 'roster-fallback') {
            fill = '#888';
            radius = 2.5;
        }

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
```

- [ ] **Step 1.4: Verificar compilación y build**

Run: `npx tsc --noEmit` — limpio.
Run: `npm run build 2>&1 | tail -5` — build OK.

- [ ] **Step 1.5: Commit**

Add only `src/ui-components/canvas.ts`. Message:

```
feat(canvas): render carry-over points/segments with dashed atenuated style

Points with source='carried-over' draw in gray (orange when injured is
inferred) and at slightly smaller radius; segments touching a carried-over
point render dashed. Honest visual signal that those weeks are inferred,
not observed training.
```

---

## Task 2: Tooltip — preservar `source`/`injured` y surface en la tabla

**Files:**
- Modify: `src/content/tooltip.ts`
- Modify: `src/content/tooltip.test.ts`

### 2A: Tests primero

- [ ] **Step 2.1: Añadir tests a `src/content/tooltip.test.ts`**

Localizar el archivo y APPEND al final:

```ts
describe('prepareChartData preserves source and injured metadata', () => {
    it('maps source from each history entry to the produced ChartPoint', () => {
        const history = [
            {
                week: 100,
                date: '2026-02-05', // Thursday → keeps week=100
                skills: { stamina: 10 },
                value: 1,
                source: 'training'
            },
            {
                week: 101,
                date: '2026-02-12', // Thursday → keeps week=101
                skills: { stamina: 10 },
                value: 1,
                source: 'carried-over',
                injured: true
            }
        ];

        const points = prepareChartData(history, 'stamina');

        // Find point by week — post-filter logic may dedupe/truncate.
        const w100 = points.find((p) => p.week === 100);
        const w101 = points.find((p) => p.week === 101);
        expect(w100?.source).toBe('training');
        expect(w101?.source).toBe('carried-over');
        expect(w101?.injured).toBe(true);
    });
});
```

- [ ] **Step 2.2: Correr y verificar fallo**

Run: `npx vitest run src/content/tooltip.test.ts 2>&1 | tail -20` — el nuevo test FALLA porque `prepareChartData` actualmente no propaga `source`/`injured` (los returns son `{ week, value, date }`).

### 2B: Implementar pass-through

- [ ] **Step 2.3: Modificar `prepareChartData` para propagar `source` e `injured`**

En `src/content/tooltip.ts`, reemplazar la firma pública y el cuerpo relevante.

Cambiar la firma de:

```ts
export function prepareChartData(history: any[], skillName: string): Array<{ week: number, value: number, date: Date }> {
```

a:

```ts
import { ChartPoint, ChartPointSource } from '../ui-components/canvas';

export function prepareChartData(
    history: any[],
    skillName: string
): Array<ChartPoint & { date: Date }> {
```

(añadir el import al top del archivo, próximo al import existente de `drawChart`).

Dentro del `map(...)` que construye `rawPoints`, cambiar el objeto returned de:

```ts
        return {
            week: adjustedWeek,
            value: entry.skills[skillName],
            date: date
        };
```

a:

```ts
        return {
            week: adjustedWeek,
            value: entry.skills[skillName],
            date: date,
            source: entry.source as ChartPointSource | undefined,
            injured: entry.injured
        };
```

En el `Map<number, …>` y en el `.map(p => ({ week: p.week, value: p.value, date: p.date }))` que aplana al final, reemplazar por:

```ts
    let sortedPoints = Array.from(bestPointsMap.values())
        .sort((a, b) => a.week - b.week)
        .map(p => ({
            week: p.week,
            value: p.value,
            date: p.date,
            source: p.source,
            injured: p.injured
        }));
```

Y ajustar el tipo del `Map` al inicio de la función:

```ts
    const bestPointsMap = new Map<number, { week: number, value: any, date: Date, source?: ChartPointSource, injured?: boolean }>();
```

- [ ] **Step 2.4: Verificar test pasa**

Run: `npx vitest run src/content/tooltip.test.ts 2>&1 | tail -15` — PASS.

### 2C: Surface en la tabla de `showHistoryTooltip`

- [ ] **Step 2.5: Añadir columna "Status" a la tabla**

En `src/content/tooltip.ts`, dentro de `showHistoryTooltip`, localizar `skillsOrder` y el template de la tabla.

Añadir una columna "Status" al inicio. Encontrar:

```ts
        <table style="border-collapse: collapse; font-size: 12px; text-align: center; width: 100%; min-width: 350px;">
            <thead>
                <tr style="border-bottom: 1px solid #555;">
                    <th style="padding: 6px 4px;">Week</th>
                    ${skillsOrder.map(s => `<th style="padding: 6px 4px;">${s.label}</th>`).join('')}
                </tr>
            </thead>
```

y reemplazar por:

```ts
        <table style="border-collapse: collapse; font-size: 12px; text-align: center; width: 100%; min-width: 350px;">
            <thead>
                <tr style="border-bottom: 1px solid #555;">
                    <th style="padding: 6px 4px;" title="Source of the data">⚑</th>
                    <th style="padding: 6px 4px;">Week</th>
                    ${skillsOrder.map(s => `<th style="padding: 6px 4px;">${s.label}</th>`).join('')}
                </tr>
            </thead>
```

Luego, dentro del `rows.forEach(...)` existente, antes del `<td>` que pinta `row.week`, inyectar una nueva celda de status. Encontrar:

```ts
        html += `<tr style="border-bottom: 1px solid #444; background-color: ${rowBgColor};">`;
        html += `<td style="padding: 6px 4px; color: #aaa; background-color: ${rowBgColor};">${row.week}</td>`;
```

y reemplazar por:

```ts
        let statusIcon = '';
        let statusTitle = 'Training report';
        if (row.source === 'carried-over') {
            if (row.injured === true) {
                statusIcon = '🩹';
                statusTitle = 'Inferred: injured (data carried over from previous week)';
            } else {
                statusIcon = '⏸';
                statusTitle = 'Missing training report — data carried over';
            }
        } else if (row.source === 'roster-fallback') {
            statusIcon = '⏸';
            statusTitle = 'Data derived from current roster (no previous training)';
        }

        html += `<tr style="border-bottom: 1px solid #444; background-color: ${rowBgColor};">`;
        html += `<td style="padding: 6px 4px; color: #aaa; background-color: ${rowBgColor};" title="${statusTitle}">${statusIcon}</td>`;
        html += `<td style="padding: 6px 4px; color: #aaa; background-color: ${rowBgColor};">${row.week}</td>`;
```

También actualizar el CSV export para incluir la columna Status. Encontrar:

```ts
            let csv = 'Week,' + skillsOrder.map(s => s.label).join(',') + '\n';
            rows.forEach(r => {
                csv += `${r.week},` + skillsOrder.map(s => r.skills[s.key] || '').join(',') + '\n';
            });
```

y reemplazar por:

```ts
            let csv = 'Source,Week,' + skillsOrder.map(s => s.label).join(',') + '\n';
            rows.forEach(r => {
                const sourceLabel = r.source ?? 'training';
                csv += `${sourceLabel},${r.week},` + skillsOrder.map(s => r.skills[s.key] || '').join(',') + '\n';
            });
```

- [ ] **Step 2.6: Verificar tests y compilación**

Run: `npx vitest run 2>&1 | tail -15` — todos los tests pasan.
Run: `npx tsc --noEmit` — limpio.
Run: `npm run build 2>&1 | tail -5` — OK.

- [ ] **Step 2.7: Commit**

Add `src/content/tooltip.ts` y `src/content/tooltip.test.ts`. Message:

```
feat(tooltip): surface source/injured metadata in chart and history table

prepareChartData now propagates source and injured per point for drawChart
to render carried-over segments dashed. showHistoryTooltip renders a status
column with 🩹 (injured-inferred) or ⏸ (unknown) for non-training rows, and
the CSV export includes a Source column.
```

---

## Task 3: Observer — hook `onSquadReady` que dispara `reconcileGaps`

**Files:**
- Modify: `src/content/observer.ts`
- Modify: `src/content/main.ts`

- [ ] **Step 3.1: Añadir `onSquadReady` opcional a `initObserver`**

En `src/content/observer.ts`, reemplazar la firma de `initObserver`:

```ts
export function initObserver(onTableFound: (container: HTMLElement) => void, onPlayerPageFound?: (container: HTMLElement) => void): void {
```

por:

```ts
export function initObserver(
    onTableFound: (container: HTMLElement) => void,
    onPlayerPageFound?: (container: HTMLElement) => void,
    onSquadReady?: () => void
): void {
```

Dentro de `runPageProcessing`, después de llamar a `onTableFound(squadContainer)`, añadir:

```ts
                if (onSquadReady) {
                    scheduleIdle(onSquadReady);
                }
```

Añadir el helper `scheduleIdle` al final del archivo (mismo patrón que `sync.ts`):

```ts
/**
 * Runs a callback when the browser is idle. Falls back to a small setTimeout
 * when requestIdleCallback is not available.
 */
function scheduleIdle(cb: () => void): void {
    const ric = (globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
        ric(cb);
    } else {
        setTimeout(cb, 0);
    }
}
```

**Nota sobre deduplicación:** `runPageProcessing` puede dispararse múltiples veces mientras el usuario navega dentro de `/app/squad/` (resize, interacción). El debounce de 500ms del observer ya limita la frecuencia, pero aun así podría invocarse dos veces por visita a squad. `reconcileGaps` es idempotente (una segunda corrida sobre snapshots recién creados no los toca porque R1/R2 y la ausencia de huecos hacen que `findWeekGaps` retorne `[]`), así que este "multiple-fire" es aceptable. No introducimos flag de "already-ran" para mantener el módulo puro.

- [ ] **Step 3.2: Cablear en `main.ts`**

En `src/content/main.ts`, añadir al top:

```ts
import { reconcileGaps } from '../core/gapDetector';
```

Reemplazar:

```ts
    initObserver(processSquadTable, processPlayerPage);
```

por:

```ts
    initObserver(processSquadTable, processPlayerPage, () => {
        reconcileGaps().catch((err) => console.warn('reconcileGaps on squad failed:', err));
    });
```

- [ ] **Step 3.3: Verificación**

Run: `npx tsc --noEmit` — limpio.
Run: `npm run build 2>&1 | tail -5` — OK.
Run: `npx vitest run 2>&1 | tail -10` — todos pasan.

- [ ] **Step 3.4: Commit**

Add `src/content/observer.ts` y `src/content/main.ts`. Message:

```
feat(observer): trigger reconcileGaps on every /app/squad/ visit (idle)

The main content script now wires an onSquadReady callback into the
observer. When the user lands on /app/squad/, reconcileGaps runs in
requestIdleCallback — failures are logged and swallowed.
```

---

## Task 4: Popup — botón "Repair History" + handler en content

**Files:**
- Modify: `popup/index.html`
- Modify: `popup/popup.ts`
- Modify: `src/content/main.ts`

### 4A: Mensaje `REPAIR_HISTORY` en content script

- [ ] **Step 4.1: Añadir handler en `src/content/main.ts`**

En `src/content/main.ts`, dentro del `chrome.runtime.onMessage.addListener` callback, antes del `if (request.action === 'CLEAR_DATA')`, añadir:

```ts
        if (request.action === 'REPAIR_HISTORY') {
            reconcileGaps()
                .then(result => sendResponse({ status: 'success', result }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
            return true;
        }
```

### 4B: Botón en popup HTML

- [ ] **Step 4.2: Añadir botón en `popup/index.html`**

Dentro del primer `<div class="card">` (el que tiene el status y el `syncBtn`), insertar después de `<button id="syncBtn" ...>Sync Data Now</button>`:

```html
        <button id="repairBtn" class="btn btn-secondary">Repair History</button>
```

### 4C: Handler en popup.ts

- [ ] **Step 4.3: Añadir handler en `popup/popup.ts`**

Después del bloque `if (syncBtn) { ... }`, antes del `if (exportBtn)`, añadir:

```ts
    const repairBtn = document.getElementById('repairBtn') as HTMLButtonElement;
    if (repairBtn) {
        repairBtn.addEventListener('click', () => {
            if (statusDiv) statusDiv.textContent = 'Repairing history...';
            sendMessageToContentScript({ action: 'REPAIR_HISTORY' }, (response) => {
                if (response && response.status === 'success') {
                    const r = response.result;
                    if (r.error) {
                        if (statusDiv) statusDiv.textContent = `Repair error: ${r.error}`;
                        return;
                    }
                    if (statusDiv) {
                        statusDiv.textContent = `Repair done. ${r.gapsFilled} gap(s) filled across ${r.rosterSize} roster player(s).`;
                    }
                } else {
                    if (statusDiv) statusDiv.textContent = 'Repair Failed.';
                }
            });
        });
    }
```

- [ ] **Step 4.4: Verificación**

Run: `npx tsc --noEmit` — limpio.
Run: `npm run build 2>&1 | tail -5` — OK.

- [ ] **Step 4.5: Commit**

Add `popup/index.html`, `popup/popup.ts`, `src/content/main.ts`. Message:

```
feat(popup): add Repair History button wired to reconcileGaps

New popup button sends REPAIR_HISTORY to the content script, which runs
reconcileGaps and returns the ReconcileResult. The popup surfaces
gapsFilled or error back to the user.
```

---

## Task 5: Self-review, batería completa, build

- [ ] **Step 5.1: Cobertura**

| Decisión original | Tarea |
|---|---|
| UI diferenciada para carry-over en canvas | Task 1 |
| Tooltip surface injured / carry-over | Task 2 |
| Disparo al navegar a `/app/squad/` | Task 3 |
| Botón manual en popup | Task 4 |

- [ ] **Step 5.2: Correr suite completa y build**

Run: `npx vitest run` — todos pasan (≥45 tests).
Run: `npx tsc --noEmit` — limpio.
Run: `npm run build 2>&1 | tail -10` — build OK.

- [ ] **Step 5.3: QA manual (cuando decidas)**

1. `npm run build` en el worktree.
2. Cargar `dist/` en Chrome (`chrome://extensions` → reload).
3. Abrir Sokker, hacer sync.
4. En `/app/squad/`, verificar en consola que `reconcileGaps` se ejecutó (warn solo si falló).
5. Hacer hover sobre una celda de skill cuyo histórico tenga huecos — la gráfica debe mostrar segmentos punteados y al menos un punto gris o naranja.
6. Click en un jugador con huecos conocidos, abrir tooltip de historia — la columna nueva debe mostrar 🩹 / ⏸ en las filas correspondientes.
7. Abrir popup → click "Repair History" → status debe mostrar "Repair done. N gap(s) filled across M roster player(s)."

- [ ] **Step 5.4: Commit de cierre (si hubo ajustes)**

Si 5.1–5.3 encontraron algo, commit con mensaje `chore: part 2 self-review fixes`. Si nada, skip.

---

## Notas

1. **Idempotencia de `reconcileGaps`:** el trigger en observer puede dispararse varias veces por sesión (cada vez que el usuario entra a squad). Es intencional: reconcileGaps es cheap cuando no hay huecos (`findWeekGaps` devuelve `[]` y no se hacen writes). No bloquear.

2. **Estilo atenuado en canvas:** se usan valores literales (`#888`, `#ff9900`, `[4, 3]`) directamente. No se extraen a constantes porque son usados solo en una función. Si el tema del canvas cambia (ej. dark → light), se tocan los 3-4 lugares de una vez.

3. **i18n:** los strings de popup y tooltip nuevos quedan en inglés para consistencia con el resto de la UI existente (todo el popup y el tooltip ya están en inglés hardcoded). No introducimos infraestructura i18n nueva.

4. **Parte 3 potencial (fuera de alcance):** estilos en la tabla del squad (`ui.ts`) para marcar filas con último snapshot carry-over. Se puede hacer cuando haya feedback del usuario sobre si lo necesita.
