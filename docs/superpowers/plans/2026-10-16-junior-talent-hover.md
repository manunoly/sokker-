# Gráfica de talento juvenil al pasar sobre el nombre — plan de implementación

> **Para quien implemente:** usar `.agents/skills/executing-plans/SKILL.md` tarea por tarea cuando el propietario pida implementar. El resultado y la verificación de esta ejecución están en `2026-10-16-junior-talent-progress.md`; las casillas siguientes conservan la lista original de comprobación. No crear commits ni delegar por rutina: rigen `AGENTS.md` y `docs/WORKFLOW.md`.

**Objetivo:** Mostrar en la propia cantera y en detalles de informes de entrenamiento una gráfica juvenil nativa y dos talentos claramente diferenciados, con datos locales cargados al entrar en esas páginas y sin peticiones al pasar el cursor.

**Arquitectura:** Añadir contratos juveniles, funciones API validadas y un área juvenil en la IndexedDB existente. Un coordinador consulta la semana, resuelve solo los IDs visibles pendientes con una cola pequeña y notifica cada guardado; módulos de contenido separados detectan las dos páginas y muestran un recuadro que solo lee la base local. El cálculo y el Canvas juveniles permanecen separados de los del primer equipo.

**Tecnología:** TypeScript, IndexedDB, Fetch, MutationObserver, Canvas, Vitest, Vite; cero bibliotecas nuevas en producción.

**Spec:** `docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md`. Consultar la guía local `docs/juniors/README.md` si está disponible y, para formas de respuesta y dudas de API, `docs/documentacion-talent/API-SOKKER.md` (local y excluido de Git).

## Restricciones comunes

- Solo `/[idioma/]app/training/reports/details/{week}/` y `/juniors/teamID/{ownTeamId}`. La otra cantera no activa consultas juveniles ni recuadro.
- Comprobar primero `GET /api/current` y usar `today.week` como marca de sincronización; conservar `graph.values[].x` intacto y mostrar semanas relativas.
- Una resolución correcta por juvenil y semana evita repetir `/api/junior` y `/api/junior/{id}/graph` en visitas posteriores de esa semana. `values: []` es éxito válido solo tras persistirlo; error HTTP, respuesta mal formada o fallo de guardado no marcan éxito.
- Una ausencia transitoria en el DOM no confirma una baja. En esta primera versión, confirmar salidas solo con una captura completa de `/api/junior`; si la captura no prueba completitud, registrar pertenencia no confirmada para evitar sondeos repetidos sin declarar una baja.
- Hover o foco únicamente sobre el nombre; nunca hacen `fetch`. Canvas nativo, observaciones reales y tendencia OLS, cuatro puntos mínimos, dos talentos etiquetados, ocho idiomas existentes con inglés de respaldo. Mantener clic y navegación originales.
- La misma IndexedDB conserva historias juveniles separadas de jugadores. Importación, exportación y borrado incluyen esa área; ninguna captura real de la cuenta entra en archivos destinados a Git.
- La actualización de documentación tras implementar y verificar es la **última tarea**. El plan por sí solo no autoriza implementación.

## Enfoque de revisión

1. Respuesta de gráfica con `juniorId` ajeno o `values` mal formado: no guardar ni marcar la semana (tarea 1).
2. Respuesta válida `values: []` y visita repetida en la misma semana: mostrar estado vacío sin repetir la gráfica (tareas 2 y 4).
3. Informe histórico con juvenil ya fuera de una plantilla completa: conservar curva local, etiquetar el último `talent` y no pedir la gráfica (tareas 4 y 6).
4. Nueva fila durante un render de la misma ruta: detectar el ID nuevo sin interpretar filas temporalmente ausentes como bajas ni duplicar peticiones (tarea 5).
5. Borrado o restauración mientras hay descargas: descartar las respuestas tardías; una copia antigua no elimina puntos locales posteriores (tarea 7).
6. Salida de ruta mientras `/api/current` sigue pendiente: su respuesta tardía no activa eventos ni sincronización juvenil (tarea 5).

---

### Tarea 1: contratos juveniles y API validada

**Archivos:** crear `src/core/juniorTypes.ts` y `src/core/juniorApi.test.ts`; modificar `src/core/api.ts`.

**Interfaces:**

```ts
export interface JuniorPoint { x: number; y: number; scale?: number; source: 'graph' }
export interface JuniorRosterEntry { id: number; teamId: number; talent: number | null }
export type JuniorResolution = 'graph' | 'absent' | 'unknown';
export interface JuniorRecord {
  teamId: number; juniorId: number; points: JuniorPoint[];
  nativeTalent: number | null; nativeTalentWeek: number | null;
  resolvedWeek: number | null; resolution: JuniorResolution | null;
}
export interface JuniorRosterSnapshot { teamId: number; week: number; ids: number[]; complete: boolean }
export function fetchJuniorRoster(): Promise<JuniorRosterEntry[]>;
export function fetchJuniorGraph(juniorId: number): Promise<JuniorPoint[]>;
```

El wrapper de gráfica comprueba `juniorId`, array `values`, cada `x` entero finito y cada `y` finito dentro de 0–18; `scale` no determina la semana. El wrapper de plantilla exige `juniors[]`, IDs numéricos y `teamId` coherente; nunca convertir un campo ausente en `[]`.

- [ ] Escribir tests con `fetch` simulado: lista y gráfica válidas, `values: []`, ID distinto, array ausente, punto inválido, HTTP no exitoso y respuesta de plantilla mal formada.
- [ ] Confirmar que fallan antes de añadir las funciones: `npx vitest run src/core/juniorApi.test.ts`.
- [ ] Añadir contratos y wrappers sin cambiar las funciones API del primer equipo; verificar que los tests pasan con el mismo comando.
- [ ] Ejecutar `npx tsc --noEmit`; mantener ejemplos de test sintéticos.

### Tarea 2: almacenamiento juvenil y resolución semanal atómica

**Archivos:** crear `src/core/juniorRepository.ts` y `src/core/juniorRepository.test.ts`; modificar `src/core/repository.ts` solo para la migración de IndexedDB.

**Interfaces:** subir `DB_VERSION` de 2 a 3 y crear el almacén `juniors` con clave compuesta `[teamId, juniorId]`; reutilizar `metadata` para `juniorRoster:{teamId}`. Exportar `getJuniorRecords(teamId: number, ids: readonly number[]): Promise<Map<number, JuniorRecord>>`, `getJuniorRecord(teamId: number, juniorId: number): Promise<JuniorRecord | null>`, `getJuniorRosterSnapshot(teamId: number): Promise<JuniorRosterSnapshot | null>`, `saveJuniorRosterSnapshot(snapshot: JuniorRosterSnapshot, entries: readonly JuniorRosterEntry[]): Promise<void>`, `saveJuniorGraph(teamId: number, juniorId: number, week: number, points: readonly JuniorPoint[]): Promise<void>` y `saveJuniorResolution(teamId: number, juniorId: number, week: number, resolution: 'absent' | 'unknown'): Promise<void>`. `saveJuniorGraph` fusiona por `x`, conserva puntos antiguos, da prioridad a la respuesta nueva en colisiones y guarda serie más marca en **una transacción**. Los registros son por equipo; el talento nativo conserva su semana de captura.

- [ ] Probar la función pura de fusión: orden, huecos, deduplicación, prioridad de API y no mutación de la entrada; probar que una gráfica vacía conserva la historia anterior.
- [ ] Confirmar fallo inicial con `npx vitest run src/core/juniorRepository.test.ts`.
- [ ] Añadir almacén y operaciones; resolver las promesas al completar la transacción, no al finalizar un `put`. Cerrar la conexión en `versionchange` para no bloquear la migración en pestañas antiguas.
- [ ] Pasar el test enfocado y `npx tsc --noEmit`; dejar una comprobación manual de migración real de v2 a v3 en la tarea 8 porque Vitest no trae IndexedDB de navegador.

### Tarea 3: estimación y dibujo juvenil nativo

**Archivos:** crear `src/core/juniorTalent.ts`, `src/core/juniorTalent.test.ts`, `src/ui-components/juniorCanvas.ts` y `src/ui-components/juniorCanvas.test.ts`.

**Interfaces:** `estimateJuniorTalent(points: readonly JuniorPoint[]): { slope: number | null; weeksPerLevel: number | null; state: 'insufficient' | 'no-progress' | 'estimated' }`. Con menos de cuatro `x` distintos, `insufficient`; con cuatro o más, pendiente OLS de `(x,y)` y `1/slope` solo si es positiva. El resultado positivo se conserva numérico sin recortar; la presentación usa `menos de 3` o `más de 12` fuera del intervalo de referencia. `drawJuniorChart(ctx: CanvasRenderingContext2D, points: readonly JuniorPoint[], width: number, height: number, trendSlope: number | null): void` dibuja puntos reales, une únicamente semanas consecutivas (`Δx === 1`) y traza tendencia discontinua dentro del intervalo observado. No reutilizar `prepareChartData` ni `drawChart` del primer equipo: ajustan `week` o unen huecos.

- [ ] Probar cero, uno y tres puntos; cuatro puntos planos o descendentes; `2 2 2 3 3 3 4` con resultado aproximado `3,11`; distancias desiguales entre `x` y entrada desordenada.
- [ ] Probar Canvas con contexto simulado: no hay segmento real sobre un hueco y la tendencia usa un trazo diferenciado sin prolongarse fuera de los datos.
- [ ] Observar fallo inicial con `npx vitest run src/core/juniorTalent.test.ts src/ui-components/juniorCanvas.test.ts`; implementar solo estas funciones y repetir hasta pasar.
- [ ] Ejecutar `npx tsc --noEmit`.

### Tarea 4: coordinador semanal y cola acotada

**Archivos:** crear `src/core/juniorSync.ts` y `src/core/juniorSync.test.ts`.

**Interfaces:** `syncVisibleJuniors(input: { teamId: number; week: number; kind: 'report' | 'academy'; ids: readonly number[] }): Promise<void>` recibe una semana validada después de `/api/current`; `getJuniorSyncState(teamId: number, juniorId: number): 'idle' | 'queued' | 'loading' | 'error'`; `subscribeJuniorUpdates(listener: (teamId: number, juniorId: number) => void): () => void` notifica tanto cambios de estado como guardados; `cancelQueuedJuniorSync(): void` para salir de ruta; `invalidateJuniorSync(): void` para borrar o restaurar, incluyendo respuestas en vuelo. Los estados de carga y error viven solo en memoria. Mantener una captura de plantilla por equipo y semana; refrescarla una vez si aparece en **cualquiera de las dos páginas** un ID visible sin resolución semanal que no figure en esa captura, también cuando el primer indicio de un alta sea un informe. Rechazar una respuesta cuyos registros pertenecen a otro equipo. Marcar `complete` solo si la respuesta permite demostrar que terminó la lista (con `limit=100`, no inferir bajas si se alcanza el límite sin prueba de última página). Programar hasta tres gráficas simultáneas, deduplicar por equipo/semana/ID y notificar cada guardado o transición de estado. En informes antiguos, IDs no incluidos en captura completa quedan `absent`; si la completitud es incierta, `unknown`. Una aparición en cantera propia invalida ambos estados.

- [ ] Probar primera visita, segunda visita de la misma semana (cero peticiones juveniles), semana nueva, ingreso dentro de la semana detectado primero en informe y `values: []` sin repetición. Para el alta en informe, una segunda entrada no debe repetir peticiones.
- [ ] Probar informe antiguo con ID ausente de plantilla completa, captura de plantilla incompleta, error reintentable en próxima entrada, máximo de tres peticiones a la vez y deduplicación en render repetido.
- [ ] Probar estados `queued`, `loading` y `error` por juvenil y sus notificaciones, tanto con registro local como sin él; los errores no se persisten.
- [ ] Probar que cancelación de cola e invalidación evitan guardar/notificar respuestas tardías tras borrar o restaurar.
- [ ] Confirmar fallos iniciales y luego pasar `npx vitest run src/core/juniorSync.test.ts`; ejecutar `npx tsc --noEmit`.

### Tarea 5: reconocer páginas y nombres sin depender del idioma

**Archivos:** crear `src/content/juniorPage.ts` y `src/content/juniorPage.test.ts`; modificar `src/content/observer.ts` y `src/content/main.ts`.

**Interfaces:** `JuniorPageView = { kind: 'report'; pathname: string; names: Map<number, HTMLElement> } | { kind: 'academy'; pathname: string; routeTeamId: number; names: Map<number, HTMLElement> }`; sus IDs son las claves de `names`. `scanJuniorPage(pathname: string, root: Document): JuniorPageView | null` reconoce la ruta moderna con prefijo de idioma opcional y la clásica con ID de equipo. En el informe moderno extrae `tr.table-row[data-row-id]` **solo si la fila contiene** `td.table__cell--exp` y `td.table__cell--weeks`, y toma el nombre de `td.table__cell--player .text.c-text-link`; así no incluye las filas del primer equipo de la misma pantalla. En la cantera clásica usa `tr[id^="juniorRow"]` y `td:first-child strong`. Estos selectores estructurales se comprobaron en las páginas de Sokker el 16-10-2026; los tests usan HTML sintético. `handleJuniorPage(view: JuniorPageView): Promise<void>` obtiene `fetchTodayInfo()` una vez por entrada y reutiliza esa promesa para nuevos IDs en la misma ruta. Antes de leer o escribir datos juveniles, valida que `today.week` sea entero finito positivo y `today.teamId` entero positivo; luego verifica equipo propio **antes** de unir eventos o pedir datos juveniles. Usar un contador de entrada/ruta y comprobarlo al resolver `/api/current`, antes de unir eventos o sincronizar: si la página ya no corresponde, descartar la continuación. Usar un único delegado de `mouseover`/`focusin` para que un render que reemplace los nombres mantenga la interacción; una firma de ruta + IDs evita **sincronizaciones** duplicadas, pero nuevos IDs disparan otra pasada. Al salir, cancela la cola pendiente y desmonta el recuadro. Mantener la lógica existente de squad/player del observador; la detección juvenil debe repetirse tras renders parciales aunque el cooldown de squad sea de 2 s.

- [ ] Probar rutas con/sin idioma, otra cantera, filas principales mezcladas con juveniles, IDs inválidos, nombres sin enlace, render parcial, reemplazo de nodos con los mismos IDs y nuevo ID en la misma ruta; ningún texto de encabezado forma parte del selector.
- [ ] Probar `/api/current` mal formado: semana o equipo inválidos no generan peticiones juveniles ni escrituras. Probar salida hacia cantera ajena mientras `/api/current` está pendiente: su respuesta posterior no une eventos, abre recuadro ni inicia peticiones juveniles.
- [ ] Confirmar fallo inicial con `npx vitest run src/content/juniorPage.test.ts` en entorno jsdom.
- [ ] Implementar escaneo y enganche idempotente; garantizar que el nombre solamente activa el recuadro y que la ruta ajena no registra eventos juveniles.
- [ ] Repetir test enfocado y `npx tsc --noEmit`.

### Tarea 6: recuadro, idiomas y accesibilidad

**Archivos:** crear `src/content/juniorCard.ts`, `src/content/juniorLocale.ts`, `src/content/juniorCard.test.ts` y `src/content/juniorLocale.test.ts`; conectar desde `src/content/juniorPage.ts`.

**Interfaces:** `showJuniorCard(anchor: HTMLElement, teamId: number, juniorId: number, name: string): Promise<void>` y `hideJuniorCard(): void` usan `getJuniorRecord`, `getJuniorSyncState` y `subscribeJuniorUpdates`, nunca API. Al recibir una transición del juvenil abierto, vuelven a leer estado y registro: cola/carga sin caché muestran espera; con caché mantienen la curva y avisan que se actualiza; error con caché conserva la curva y avisa del fallo; error sin caché muestra fallo. La capa de idioma resuelve prefijo de ruta, `document.documentElement.lang`, idioma del navegador e inglés de respaldo; exporta `getJuniorStrings(pathname: string, documentLang: string, browserLang: string): JuniorStrings` y formatea cifras con `Intl.NumberFormat`. Crear textos completos en `en`, `es`, `pl`, `pt`, `it`, `de`, `ro`, `tr`. Seguir el boceto aprobado: cabecera, dos bloques de talento, Canvas, leyenda y lista textual accesible de **todos** los puntos locales, incluso posteriores a la semana de un informe antiguo. El valor nativo lleva semana de captura (como último valor registrado si salió); también hay estados carga/caché/error. El valor positivo estimado fuera de 3–12 se presenta como `menos de 3` o `más de 12`, sin recortar el dato calculado. Solo el nombre obtiene foco (`tabindex=0` si hace falta); Escape cierra; el puntero puede entrar al recuadro; clic original no se intercepta. Un token de presentación impide que una lectura antigua sustituya otro juvenil.

- [ ] Probar selección de los ocho idiomas y respaldo, los dos talentos etiquetados, valor nativo de baja como último registrado, estados sin datos y sin progreso, límites de presentación `menos de 3`/`más de 12`, formato decimal y textos de semana relativa.
- [ ] Probar con jsdom que hover/foco leen local, Escape cierra, mover puntero al recuadro lo mantiene, respuesta antigua no reemplaza al juvenil activo y una notificación actualiza el recuadro abierto; cubrir cola, fallo con/sin caché y transición a éxito.
- [ ] Confirmar fallos iniciales; implementar sin modificar el tooltip del primer equipo y repetir `npx vitest run src/content/juniorCard.test.ts src/content/juniorLocale.test.ts`.
- [ ] Ejecutar `npx tsc --noEmit` y revisar visualmente etiquetas largas y posición en ambos diseños de página.

### Tarea 7: copia, restauración y borrado coherentes

**Archivos:** modificar `src/core/repository.ts`, `src/core/repository.test.ts` y `src/content/main.ts`; ampliar `src/core/juniorRepository.ts` si la unión necesita una función pura exportada.

**Interfaces:** `BackupData` admite `juniors?: JuniorRecord[]`; `getAllData()` los exporta; `restoreData()` valida antes de escribir y une puntos por equipo/ID/`x`, con preferencia del dato local en colisiones. Copias antiguas sin `juniors` siguen válidas. Invalidar marcas semanales importadas cuando no pueda garantizarse que acompañan a una serie válida; descartar capturas de plantilla restauradas si están desfasadas. `clearDatabase()` vacía el nuevo almacén. En `main.ts`, llamar `invalidateJuniorSync()` **antes** de `IMPORT_DATA` y `CLEAR_DATA` para ignorar respuestas pendientes, sin alterar las otras acciones del popup.

- [ ] Probar validación de copia juvenil, compatibilidad de copia anterior, unión que preserva puntos locales, colisiones, marcas inciertas y exclusión de secciones mal formadas; probar el orden de invalidación frente a importación/borrado.
- [ ] Confirmar fallo inicial con `npx vitest run src/core/repository.test.ts`; implementar y repetir.
- [ ] Ejecutar `npx tsc --noEmit` y una prueba manual de exportar/restaurar/borrar con datos sintéticos o descartables, comprobando que ninguna respuesta tardía los repuebla.

### Tarea 8: verificación integral y documentación final

**Archivos:** actualizar `readme.md` y la guía local `docs/juniors/README.md` si está disponible; actualizar `docs/documentacion-talent/API-SOKKER.md` solo si la implementación aporta nuevos hechos de API; corregir la spec si difiere del comportamiento verificado.

- [ ] Ejecutar una vez los checks completos: `npx vitest run`, `npx tsc --noEmit`, `npm run build` y `git diff --check`; registrar resultados reales, no prometer los que no corrieron.
- [ ] Verificar manualmente en Chrome con la extensión cargada: informe moderno, cantera propia, cantera ajena, otra ruta, semana repetida, un ID nuevo, historial corto y largo, foco/Escape y respaldo de idioma. Inspeccionar Network para confirmar que el hover no solicita API y que una segunda entrada de la misma semana no repite gráficas.
- [ ] Comprobar migración v2→v3 y copia/restauración/borrado sobre datos de prueba; revisar que los archivos preparados para Git usan solo ejemplos sintéticos y que `docs/documentacion-talent/` sigue ignorada.
- [ ] Actualizar la documentación indicada arriba **después** de verificar lo implementado; dejar anotadas las limitaciones comprobadas, incluida la detección de bajas entre capturas de plantilla. Revisar los cambios materiales con `code-review-and-quality` antes de dar la implementación por concluida.

## Fuera del primer alcance

Sin Chart.js ni nuevas dependencias de gráficos, sin reconstruir historia antigua desde `change: 0`, sin corrección estadística de anomalías, sin gráfica para otras canteras, sin activación táctil propia y sin modificar la lógica de talento del primer equipo. La cola, los estados y las interfaces anteriores permiten ampliar la función cuando haya evidencia de uso o nuevos datos fiables.
