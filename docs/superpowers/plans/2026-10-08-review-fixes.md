# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los hallazgos del review de 2026-10-08: XSS en el tooltip, validación débil del backup, README desactualizado, versiones inconsistentes, zip versionado y limpiezas menores.

**Architecture:** Defensa en dos puntos: escapar al renderizar (`tooltip.ts`) y validar tipos al importar (`restoreData`). El resto son cambios de configuración y documentación, sin tocar la lógica de sync ni el gap detector.

**Tech Stack:** TypeScript, Vite 7, Vitest 4 (jsdom), Chrome MV3, IndexedDB.

**Spec:** Review en conversación (2026-10-08), puntos 1–5.

## Global Constraints

- Cero dependencias en runtime; cero `class`; estilo funcional con closures (ver `readme.md`).
- Rama de trabajo: `chore/review-fixes`. Un commit por tarea.
- Validación obligatoria en cada tarea: `npx tsc --noEmit`, `npx vitest run`, `npm run build`. Al final, carga manual de `dist/` en Chrome y abrir el tooltip de un jugador.
- Presupuesto: ~1 h. Al agotarse, entregar lo hecho más los bloqueos concretos.
- Fuera de alcance: refactor de `tooltip.ts`/`ui.ts`, reescribir la historia de git para eliminar el zip, `console.log` comentados fuera de `sync.ts`.

## Review Focus

1. Un backup real exportado por la versión actual debe seguir importándose (la validación nueva no puede rechazar datos legítimos) → test en Task 2 + chequeo manual al final.
2. Strings de `training.skill`/`training.position` con HTML → deben verse como texto → test en Task 1.
3. Historial con `skills` no numéricos (`"<img …>"`) → el import se rechaza con "Invalid backup format" → test en Task 2.
4. El popup abierto cuando IndexedDB falla → muestra "Connect Error", no se queda colgado → Task 3 (verificación manual).
5. Usuarios que siguen `INSTALL-*.md` → el enlace de descarga sigue funcionando tras quitar el zip → Task 4, Step 4.

---

### Task 1: Escapar HTML en el tooltip

**Files:**
- Create: `src/utils/escapeHtml.ts`
- Modify: `src/content/tooltip.ts` (`renderSkillAtPosCell` ~809, celdas de week/skills ~479 y ~495)
- Test: `src/content/tooltip.test.ts`

**Interfaces:**
- Produces: `escapeHtml(value: unknown): string`; `renderSkillAtPosCell` pasa a ser `export`.

- [ ] **Step 1: Write the failing test** (añadir a `tooltip.test.ts`)

```ts
import { prepareChartData, renderSkillAtPosCell } from './tooltip';
import { TrainingReport } from '../types/index';

describe('renderSkillAtPosCell', () => {
    it('escapes HTML coming from stored training data', () => {
        const training = {
            kind: 'individual',
            skill: '<img src=x onerror=alert(1)>',
            position: '<b>',
            intensity: 90,
            minutes: 90,
        } as unknown as TrainingReport;

        const html = renderSkillAtPosCell(training);

        expect(html).not.toContain('<img');
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/tooltip.test.ts`
Expected: FAIL (`renderSkillAtPosCell` no exportado).

- [ ] **Step 3: Implementación mínima**

`src/utils/escapeHtml.ts`:

```ts
const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export const escapeHtml = (value: unknown): string =>
    String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
```

En `tooltip.ts`: `import { escapeHtml } from '../utils/escapeHtml';` y:

```ts
export function renderSkillAtPosCell(training: TrainingReport | undefined): string {
    if (!training) {
        return '<span style="color:#888;">—</span>';
    }
    const label = formatSkillAtPosition(training);
    if (!training.position) {
        return `<span>${escapeHtml(label)}</span>`;
    }
    const [skillPart] = label.split(' @ ');
    const bg = positionBadgeColor(training.position);
    return `${escapeHtml(skillPart)} <span style="display:inline-block;padding:1px 5px;border-radius:3px;background:${bg};color:#fff;font-size:10px;margin-left:4px;">${escapeHtml(training.position)}</span>`;
}
```

Celdas de la tabla:

```ts
html += `<td style="padding: 6px 4px; color: #aaa; background-color: ${rowBgColor};">${escapeHtml(row.week)}</td>`;
// ...
html += `<td style="padding: 6px 4px; background-color: ${bgColor}; color: ${color};">${val !== undefined ? escapeHtml(val) : '-'}</td>`;
```

(`statusIcon/Title`, `kindIcon/Title`, `eff`, `bg` salen de constantes o de `Number.isFinite` → no necesitan escape.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/utils/escapeHtml.ts src/content/tooltip.ts src/content/tooltip.test.ts
git commit -m "fix(security): escape stored values rendered in history tooltip"
```

---

### Task 2: Validar tipos del backup en `restoreData`

**Files:**
- Modify: `src/core/repository.ts` (`isValidBackupData` ~76, `restoreData` ~303)
- Test: `src/core/repository.test.ts` (bloque `describe('isValidBackupData')` ~198)

**Interfaces:**
- Produces: `interface BackupData { players?: PlayerData[]; metadata?: Array<{ key: string } & Record<string, unknown>>; weeks?: Array<{ week: number } & Record<string, unknown>> }`; `isValidBackupData(data: unknown): data is BackupData`.

- [ ] **Step 1: Write the failing tests**

```ts
it('accepts a player record produced by upsertPlayerWeekRecord', () => {
    const player = upsertPlayerWeekRecord(undefined, 1, 'Test', makeWeekStats(10, 5));
    expect(isValidBackupData({ players: [player], metadata: [{ key: 'lastSyncWeek', value: 10 }], weeks: [{ week: 10 }] })).toBe(true);
});

it('rejects players whose skills are not numbers', () => {
    const player = upsertPlayerWeekRecord(undefined, 1, 'Test', makeWeekStats(10, 5));
    const bad = { ...player, history: [{ ...player.history[0], skills: { ...player.history[0].skills, pace: '<img src=x>' } }] };
    expect(isValidBackupData({ players: [bad] })).toBe(false);
});

it('rejects players without numeric id or history array', () => {
    expect(isValidBackupData({ players: [{ id: '1', name: 'x', history: [] }] })).toBe(false);
    expect(isValidBackupData({ players: [{ id: 1, name: 'x' }] })).toBe(false);
});

it('rejects metadata without key and weeks without numeric week', () => {
    expect(isValidBackupData({ metadata: [{ value: 1 }] })).toBe(false);
    expect(isValidBackupData({ weeks: [{ week: 'x' }] })).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/repository.test.ts`
Expected: FAIL en los tres tests de rechazo.

- [ ] **Step 3: Implementación**

```ts
export interface BackupData {
    players?: PlayerData[];
    metadata?: Array<{ key: string } & Record<string, unknown>>;
    weeks?: Array<{ week: number } & Record<string, unknown>>;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isValidHistoryEntry(value: unknown): boolean {
    return isObject(value)
        && isFiniteNumber(value.week)
        && isObject(value.skills)
        && Object.values(value.skills).every(isFiniteNumber);
}

function isValidPlayerRecord(value: unknown): boolean {
    return isObject(value)
        && isFiniteNumber(value.id)
        && typeof value.name === 'string'
        && Array.isArray(value.history)
        && value.history.every(isValidHistoryEntry);
}

const isArrayOf = (value: unknown, check: (item: unknown) => boolean): boolean =>
    value === undefined || (Array.isArray(value) && value.every(check));

export function isValidBackupData(data: unknown): data is BackupData {
    return isObject(data)
        && isArrayOf(data.players, isValidPlayerRecord)
        && isArrayOf(data.metadata, (m) => isObject(m) && typeof m.key === 'string')
        && isArrayOf(data.weeks, (w) => isObject(w) && isFiniteNumber(w.week));
}
```

En `restoreData`, quitar los `any`:

```ts
data.players?.forEach((p) => playerStore.put(p));
data.metadata?.forEach((m) => metaStore.put(m));
data.weeks?.forEach((w) => weekStore.put(w));
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (incluidos los tests existentes de `isValidBackupData`).

- [ ] **Step 5: Commit**

```bash
git add src/core/repository.ts src/core/repository.test.ts
git commit -m "fix(security): validate backup field types before import"
```

---

### Task 3: Limpiezas menores

**Files:**
- Modify: `src/content/main.ts` (`CHECK_STATUS`), `manifest.json`, `vite.config.js`, `src/core/sync.ts`

Sin test unitario nuevo (son cambios de wiring y config); la verificación es build + manual.

- [ ] **Step 1: `CHECK_STATUS` con catch** (`main.ts`)

```ts
if (request.action === 'CHECK_STATUS') {
    getLastSyncWeek()
        .then(week => sendResponse({ status: 'alive', lastWeek: week }))
        .catch(err => sendResponse({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
    return true;
}
```

- [ ] **Step 2: Quitar permiso sin uso** — en `manifest.json` eliminar el bloque `"permissions": ["storage"],` (confirmado: no hay `chrome.storage` en `src/` ni `popup/`).

- [ ] **Step 3: `vite.config.js`** — reemplazar los comentarios de scaffolding del `input` por:

```js
input: {
    content: resolve(__dirname, 'src/content/main.ts'),
    popup: resolve(__dirname, 'popup/index.html'),
},
```

- [ ] **Step 4: `sync.ts`** — borrar las líneas `// console.log(...)` comentadas (4 líneas) y el comentario de la línea `.then(res => { /* console.log(...) */ })` en `main.ts` → `syncData().catch(err => console.error(err));`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx vitest run && npm run build && grep -c storage dist/manifest.json`
Expected: todo PASS; el grep devuelve `0`.

- [ ] **Step 6: Commit**

```bash
git add src/content/main.ts manifest.json vite.config.js src/core/sync.ts
git commit -m "chore: handle CHECK_STATUS errors, drop unused storage permission, tidy config"
```

---

### Task 4: Versiones, README y zip

**Files:**
- Modify: `package.json`, `readme.md`, `documentation/INSTALL-en.md`, `documentation/INSTALL-es.md`
- Delete: `documentation/sokker-plus-plus.zip`

- [ ] **Step 1: Versiones** — `manifest.json` es la fuente de verdad (`0.1.0`). En `package.json`: `"name": "sokker-plus-plus"`, `"version": "0.1.0"`, `"description": "Sokker++ Chrome extension"`, borrar `"main": "index.js"`. Luego `npm install --package-lock-only` para alinear el lock.

- [ ] **Step 2: README** — en `readme.md`:
  - Árbol de estructura: `.js` → `.ts`, raíz `sokker-plus-plus/`, añadir `core/gapDetector.ts`, `core/trainingReport.ts`, `content/i18n.ts`, `types/`, `utils/scheduleIdle.ts`, `utils/escapeHtml.ts`.
  - Sección de desarrollo nueva:

```markdown
## 🧑‍💻 Desarrollo

npm ci            # instalar dependencias
npm run dev       # build en modo watch
npm run build     # genera dist/ (cargar como "unpacked" en chrome://extensions)
npx vitest run    # tests
npx tsc --noEmit  # typecheck
```

- [ ] **Step 3: Publicar el zip como Release** ⚠️ acción externa: **confirmar con el usuario antes de ejecutarla**.

```bash
npm run build && (cd dist && zip -r ../sokker-plus-plus.zip .)
gh release create v0.1.0 sokker-plus-plus.zip --title "Sokker++ 0.1.0" --notes "Security fixes + cleanup"
rm sokker-plus-plus.zip
```

- [ ] **Step 4: Actualizar enlaces y quitar el zip** — en ambos `INSTALL-*.md` reemplazar
`https://github.com/manunoly/sokker-/raw/main/documentation/sokker-plus-plus.zip` por
`https://github.com/manunoly/sokker-/releases/latest/download/sokker-plus-plus.zip`. Luego:

```bash
git rm documentation/sokker-plus-plus.zip
grep -rn "raw/main/documentation/sokker-plus-plus.zip" documentation readme.md   # Expected: sin resultados
curl -sIL https://github.com/manunoly/sokker-/releases/latest/download/sokker-plus-plus.zip | grep -m1 "HTTP/.* 200"
```

(Nota: el zip sigue en la historia de git; purgarlo requiere reescribir la historia — fuera de alcance.)

- [ ] **Step 5: Verificación final + commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Manual: cargar `dist/` en Chrome, abrir plantilla, pasar sobre un jugador (tabla "General Skills ++" se ve igual), exportar backup e importarlo de nuevo (debe aceptarlo).

```bash
git add package.json package-lock.json readme.md documentation/INSTALL-en.md documentation/INSTALL-es.md
git commit -m "docs: align versions, refresh README, serve zip from GitHub Releases"
```
