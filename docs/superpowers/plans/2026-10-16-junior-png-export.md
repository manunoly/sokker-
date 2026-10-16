# Junior PNG Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the local `executing-plans` adaptation to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descargar un PNG de la gráfica juvenil con un pie mínimo de semanas restantes, talento estimado y atribución.

**Architecture:** Persistir `weeksLeft` en el registro juvenil durante la sincronización semanal, con una recaptura de plantilla solo para registros antiguos de la semana actual. Componer un Canvas de exportación independiente desde los puntos locales y activar su descarga desde la tarjeta.

**Tech Stack:** TypeScript, Canvas 2D, IndexedDB, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-16-junior-png-export-design.md`

## Global Constraints

- El PNG usa texto fijo en inglés: `{n} weeks left · {n.n} talent` y `by manuel.team` alineados a la derecha debajo de la gráfica.
- No incluir talento nativo, nombre ni ID en los píxeles del PNG.
- El clic de exportación no hace peticiones de red ni requiere nuevas dependencias o permisos.
- Conservar copias antiguas y la regla semanal juvenil; no alterar el tracker del primer equipo.
- No hacer commit sin petición del propietario.

## Review Focus

- Registro anterior sin `weeksLeft`: recaptura única de plantilla durante entrada elegible; ninguna gráfica repetida.
- `weeksLeft` inválido o ausente: no bloquear la gráfica y mostrar `— weeks left`.
- Estimación insuficiente o sin progreso: mostrar `— talent` sin usar el talento de Sokker.
- Juvenil ausente: no presentar semanas restantes antiguas como vigentes.
- Descarga fallida o múltiples clics: mantener la tarjeta usable y no acumular recursos temporales.

---

### Task 1: Weeks remaining in local records

**Files:** `src/core/juniorTypes.ts`, `src/core/api.ts`, `src/core/juniorRepository.ts`, `src/core/juniorSync.ts`, `src/core/repository.ts`, and their focused tests.

**Interfaces:** `JuniorRosterEntry.weeksLeft: number | null`; legacy-compatible `JuniorRecord.weeksLeft?: number | null`. `fetchJuniorRoster` parses it; roster save persists it with `nativeTalentWeek`; restore validates and merges it.

- [x] Add failing synthetic tests for parsing, local save/backup merge, and one-time current-week backfill without graph fetch.
- [x] Implement the field and current-week backfill within the existing serialized sync.
- [x] Run focused tests and `npx tsc --noEmit`.

### Task 2: PNG composition and card action

**Files:** `src/ui-components/chartExport.ts` and test; `src/ui-components/juniorExport.ts` and test; `src/content/juniorCard.ts`, `src/content/juniorLocale.ts`, and their tests.

**Interfaces:** `createChartExportCanvas({ draw, footer, credit })` and `downloadChartPng(canvas, filename)` provide reusable Canvas export. `createJuniorExportCanvas(points, weeksLeft)` supplies only juvenile labels and drawing; the card calls it on a click.

- [x] Add failing synthetic tests for fixed English footer, right alignment, estimated-only talent, keyboard-accessible action, and no network on click.
- [x] Implement the compositor and localized button; handle unavailable values and export errors without closing the card.
- [x] Run focused tests and `npx tsc --noEmit`.

### Task 3: Documentation and complete verification

**Files:** optional local `docs/juniors/README.md` and the plan progress marks.

- [x] Document what the image contains, the provenance of weeks, and legacy backfill.
- [x] Run `npx vitest run`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [x] Review the changed code and private-file status; report actual verification and limitations.
