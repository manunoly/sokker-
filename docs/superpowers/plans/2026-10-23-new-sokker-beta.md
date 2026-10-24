# New Sokker Compatibility Implementation Plan

> **For agentic workers:** Use the repository adaptation at `.agents/skills/executing-plans/SKILL.md` to implement this plan task by task when implementation is requested. Default: sequential work in the current session. Do not delegate, commit, push or publish without the owner's authorization. Steps use checkboxes for progress.

**Goal:** Mantener gráficas e historial en páginas antiguas y nuevas, en el dominio principal y sus subdominios, con una única persistencia local.

**Architecture:** Scripts de página con clasificación de rutas, adaptadores DOM y coordinadores de sincronización. Worker MV3 con dos fronteras tipadas: transporte GET autenticado a `https://sokker.org/api` y persistencia IndexedDB común. Migración mediante copia íntegra, staging verificado y publicación atómica sin modificar la fuente.

**Tech Stack:** TypeScript, Chrome MV3, IndexedDB, Canvas, Vite y Vitest/JSDOM existentes. Propuesta de una dependencia exclusivamente de desarrollo: `fake-indexeddb`, para verificar transacciones sin sustituirlas por mocks de funciones; no se añade ninguna dependencia de runtime.

**Spec:** [2026-10-23-new-sokker-beta-design.md](../specs/2026-10-23-new-sokker-beta-design.md).

**Estado:** Propuesta revisada con las instrucciones del propietario. El veredicto independiente y los hashes examinados constan en el [informe Astra](../../research/2026-10-23-new-sokker-beta-astra-review.es.md). No ejecutada. La investigación previa y su comprobación de 48 pruebas constituyen contexto histórico; no certifican este cambio futuro. No se ha instalado la dependencia propuesta ni accedido a la BD real.

## Global Constraints

- «El historial debe ser común en el mismo perfil del navegador.»
- «La versión de página se reconoce por su ruta y DOM, sin asociar “beta” con un hostname.»
- «La fuente original no se borra automáticamente en esta entrega, incluso tras una migración correcta.»
- No se puede perder ningún dato de la BD actual. El lector de migración no hace escrituras ni upgrades en la fuente. No activar el destino sin archivo íntegro leído de vuelta y verificado, staging comprobado y punto de retorno. Antes del primer ensayo real, copia independiente con recuperación demostrada en un entorno aislado.
- La API canónica confirmada por el propietario es `https://sokker.org/api`, incluso desde `app.sokker.org`. No derivar su host de `location.origin` ni cambiar sus endpoints o modelos.
- «Mantener hover y foco sin consultas a la API.»
- «No se cambia automáticamente el toggle de Sokker ni se navegan las pestañas del usuario para migrar.»
- Mantener fórmulas, procedencia, Canvas, traducciones existentes, límite de 30 semanas y concurrencia juvenil de tres solicitudes. No publicar datos reales ni modificar trabajos previos.
- Reutilizar el repositorio actual como lógica del worker; la página solo conserva un lector del legado. No introducir conexiones IDB en mensajes ni imports ESM en `content.js`.
- No debilitar pruebas, tipos o verificaciones. Verificar y revisar el código material antes de cualquier commit o publicación solicitados posteriormente.

## Review Focus

1. Dos pestañas completan consultas antiguas después de borrar o importar: ninguna escritura con epoch anterior se confirma. Pruebas en tareas 1–3.
2. Una transferencia de legado se corta o el worker se reinicia antes del commit: no hay marcador de éxito ni datos parcialmente publicados. Pruebas en tarea 2.
3. Al borrar, la copia antigua retenida vuelve a quedar accesible en otra pestaña: no se reimporta automáticamente. Pruebas en tareas 2–3.
4. El sitio reutiliza un elemento para otro jugador o mantiene tabla y tarjetas a la vez: identidad correcta, sin listeners duplicados. Pruebas en tareas 4–6.
5. La beta se sirve desde el dominio principal y sus botones siguen teniendo acciones nativas: se selecciona el adaptador correcto y se conserva el clic de Sokker. Pruebas en tareas 4–7.
6. La fuente contiene datos antiguos o campos/stores no reconocidos por el exportador actual: se conserva una representación íntegra recuperable y la fuente no cambia; un dato no representable bloquea la migración. Pruebas en tarea 2 y condición obligatoria del piloto real en tarea 7.
7. La página beta llama al mismo servidor API del dominio principal: transporte por worker con credenciales, cancelación por remitente y fallo de sesión sin convertirlo en datos vacíos. Pruebas en tareas 1A y 7.

## Archivos y responsabilidades

| Unidad | Archivos nuevos | Archivos actuales afectados |
| --- | --- | --- |
| Persistencia y mensajes | `src/core/storageTypes.ts`, `src/core/storageClient.ts`, `src/background/storageService.ts`, `src/background/main.ts` | `src/core/repository.ts`, `src/core/juniorRepository.ts` |
| Transferencia y propietario de mensajes | `src/core/transferProtocol.ts`, `src/background/transferService.ts`, `src/background/messageOwner.ts` | Clientes/servicios de persistencia, API y backups |
| Transporte API canónico | `src/core/apiClient.ts`, `src/core/apiTypes.ts`, `src/background/apiService.ts` | `src/core/api.ts`, `src/background/main.ts` y consumidores API existentes |
| Migración | `src/core/legacyStorage.ts`, `src/core/legacyCodec.ts`, `src/core/storageMigration.ts`, `src/core/storageMerge.ts` | Validadores y backup de `src/core/repository.ts` |
| Consumo común | — | `src/content/main.ts`, `ui.ts`, `tooltip.ts`, `juniorCard.ts`; `src/core/sync.ts`, `juniorSync.ts`, `gapDetector.ts`; `popup/popup.ts`, `popup/index.html` |
| Rutas y anclajes | `src/content/pageContext.ts`, `src/content/playerBindings.ts`, `src/content/betaPlayerPage.ts` | `observer.ts`, `ui.ts`, `juniorPage.ts`, `trainingPlayerPage.ts` |
| Build | `vite.content.config.js`, `scripts/build.mjs` | `vite.config.js`, `package.json`, `package-lock.json`, `manifest.json` |
| Pruebas | Archivos `.test.ts` junto a las unidades nuevas; `src/content/fixtures/beta*.html`, `src/core/storageFixtures.ts` | Pruebas existentes afectadas, sin eliminar sus garantías |
| Documentación | `docs/research/2026-10-23-new-sokker-beta-verification.es.md` | Guías EN/ES de instalación, privacidad, primer equipo, juveniles y `documentation/LOGIC_EXPLANATION.md` |

Los nombres sin directorio en las dos últimas filas de código de contenido pertenecen a `src/content/`. Cada tarea enumera sus archivos exactos y sus dependencias; no se requiere crear todos los archivos de esta tabla antes de empezar.

## Task 0: Registrar el contrato confirmado y cerrar la evidencia de las vistas

**Files:** Leer `documentation/new-page-sokker/`, `src/core/api.ts`, `src/content/juniorPage.ts`, `src/content/trainingPlayerPage.ts`. Actualizar solo evidencia privada en `docs/documentacion-talent/API-SOKKER.md` y conclusiones sin datos reales en `docs/research/2026-10-23-new-sokker-beta-verification.es.md`.

**Interfaces:** Consume la confirmación del propietario: las API y sus formatos se mantienen en `https://sokker.org/api`. Produce evidencia de estructura beta de configuración e informes y accesibilidad de una página clásica para migrar. No investiga ni inventa una API alternativa en `app.sokker.org`.

- [ ] Registrar la confirmación del propietario y el ejemplo de Request URL, sin capturas privadas en Git. Inspeccionar el uso actual de `location.origin` para retirarlo en tarea 1A. No modificar la cuenta, el toggle ni la BD real.
- [ ] Inspeccionar configuración e informes beta y `/squad/{teamId}`. Registrar anclajes sin nombres ni IDs reales en documentación compartible. Las capturas privadas permanecen en la ubicación local excluida de Git.
- [ ] Si falta acceso a una vista, mantenerla explícitamente pendiente; las tareas de persistencia y transporte pueden continuar independientemente. La prueba autenticada del broker se realiza en tarea 7: comprueba el transporte y la sesión, no reabre el contrato confirmado.

**Aceptación:** Cada vista declarada compatible tiene evidencia propia; la futura URL bajo el dominio principal se prueba después con fixtures. Esta tarea no autoriza operaciones de escritura en Sokker.

## Task 1: Repositorio común, protocolo tipado y artefactos MV3 válidos

**Files:** Crear `src/core/storageTypes.ts`, `src/core/storageClient.ts`, `src/core/transferProtocol.ts`, `src/background/transferService.ts`, `src/background/messageOwner.ts`, `src/background/storageService.ts`, `src/background/main.ts`, sus pruebas y `src/core/storageFixtures.ts`. Modificar `src/core/repository.ts`, `src/core/juniorRepository.ts`, `manifest.json`, `vite.config.js`, `package.json`, `package-lock.json`. Crear `vite.content.config.js` y `scripts/build.mjs`.

**Interfaces:**

- `StorageState = { epoch: string; revision: number; migration: MigrationStatus }`; `WriteContext = { teamId: number; epoch: string }`; `MigrationBase = { epoch: string; revision: number }`. Definir `MigrationStatus = Record<string, { state: 'unchecked' | 'copying' | 'staged' | 'verified' | 'absent' | 'migrated' | 'blocked' | 'error'; message?: string }>`; la clave es el origen.
- `ensureStorageReady(): Promise<StorageState>` y `getWriteContext(teamId: number): Promise<WriteContext>`.
- `requestStorage<K extends keyof StorageOperations>(operation: K, input: StorageOperations[K]['input']): Promise<StorageOperations[K]['output']>`. Definir un mapa cerrado para lecturas/escrituras siguientes, no un invocador arbitrario de funciones.
- Lecturas: `getPlayerHistory(id)`, `getAllPlayers()`, `getJuniorRecord(teamId,id)`, `getJuniorRecords(teamId,ids)`, `getJuniorRosterSnapshot(teamId)`, `getLastSyncWeek(teamId)`, `isWeekSynced(teamId,week)`, `getAllData()`. Mantener los tipos de resultado actuales; transportar el Map juvenil como pares y reconstruirlo en el cliente.
- Escrituras: `saveWeekData(ctx,week,players)`, `markWeekEmpty(ctx,week)`, `savePlayerCarryOverEntry(ctx,id,name,entry)`, `saveJuniorRosterSnapshot(ctx,snapshot,entries)`, `saveJuniorGraph(ctx,id,week,points)`, `saveJuniorResolution(ctx,id,week,resolution)`. `ctx` es `WriteContext`; los demás tipos se reutilizan del código actual. Todas comprueban epoch y coherencia de equipo en la transacción.
- Canal `sokker++:storage:v1`; respuesta `{ ok: true, value } | { ok: false, code, message }`. Errores cerrados: `INVALID_REQUEST`, `STALE_EPOCH`, `STALE_REVISION`, `STORAGE_ERROR`, `MIGRATION_BLOCKED`, `UNKNOWN_TRANSFER`. No reintentar automáticamente una mutación cuyo resultado sea incierto.
- `TransferManifest = { transferId: string; totalFrames: number; totalBytes: number; digest: string }`; límite `MAX_MESSAGE_BYTES = 262144` sobre `TextEncoder().encode(JSON.stringify(message)).byteLength`, tanto solicitudes como respuestas. Canal cerrado `sokker++:transfer:v1` con inicio, escritura/lectura de fragmento, finalización y cancelación. Propietario, tipo de operación, estado y huellas se guardan autoritativamente en el worker/staging. La fachada de las operaciones anteriores fragmenta cualquier entrada o salida que exceda el límite, incluidas lecturas masivas; nunca cambia a una llamada monolítica para `getAllData`, `getAllPlayers` o un historial grande.
- `messageOwner` identifica el contexto por `sender.documentId` junto con extensión/tab/frame disponibles; si falta, utiliza un puerto dedicado cuya identidad asigna el worker. No permite que otro documento, aunque tenga el mismo `sender.id`, hostname o requestId, lea/cancele una transferencia ajena.

- [ ] Escribir pruebas que demuestren lectura común con dos clientes, serialización JSON del Map, rechazo de entradas inválidas y de remitentes ajenos, semanas independientes para equipos sintéticos `42` y `43`, y confirmación solo tras commit. Añadir prueba de rechazo de escritura cuando el epoch persistido cambia entre captura y transacción, y una prueba de aborto real de transacción. Los flujos completos de borrado/restauración se prueban al incorporarlos en tareas 2–3.
- [ ] Incorporar `fake-indexeddb` como dependencia de desarrollo para estas pruebas, con entorno Node por archivo. Reutilizar fixtures sintéticos para no depender de `structuredClone` de JSDOM. Ejecutar los casos nuevos y observar su fallo inicial.
- [ ] Implementar el transporte común con límite por bytes serializados, huella final y propiedad de contexto. Probar texto multibyte/escapes, fragmentos faltantes/contradictorios, identidad de dos documentos y rechazo de solicitudes/respuestas que excedan el límite. Las capturas masivas se fijan consistentemente antes de fragmentarlas; una transferencia incompleta no confirma mutaciones. Falta de capacidad/cuota produce error explícito, sin recortar el conjunto.
- [ ] Implementar el esquema del diseño y un handler con operaciones explícitas. Cada mutación activa actualiza también su revisión en la misma transacción; incluir `control` en su alcance transaccional. Usar el mismo ID de extensión para autorizar al popup y la familia de host Sokker para scripts de contenido. Registrar listeners al cargar el worker; usar `return true` con `sendResponse` para respuestas asíncronas.
- [ ] Separar los builds: `content.js` clásico autocontenido desde `vite.content.config.js`; worker módulo y popup desde `vite.config.js`. `scripts/build.mjs` ejecuta las compilaciones sin que una borre la salida de la otra y copia manifiesto/locales; `--watch` conserva ambas compilaciones. Mantener `npm run build` y `npm run dev` como comandos públicos y los iconos actuales.
- [ ] Ejecutar `npx vitest run src/core/storageClient.test.ts src/core/transferProtocol.test.ts src/background/transferService.test.ts src/background/messageOwner.test.ts src/background/storageService.test.ts src/core/repository.test.ts src/core/juniorRepository.test.ts`, `npx tsc --noEmit` y `npm run build`. Comprobar que el manifiesto referencia el worker existente y que `dist/content.js` no contiene imports/exports ESM ni imports dinámicos externos.

**Aceptación:** Dos clientes ven la misma escritura, los errores no se ocultan, un reinicio del módulo del worker conserva el epoch y los artefactos son cargables. Aún no se migra ni se cambia el camino de lectura de las páginas en esta tarea.

## Task 1A: Transportar las mismas API desde cualquier host admitido

**Files:** Crear `src/core/apiTypes.ts`, `src/core/apiClient.ts`, `src/background/apiService.ts` y sus pruebas. Modificar `src/core/api.ts`, `src/background/main.ts` y `manifest.json` si necesita concretar el permiso canónico.

**Interfaces:** Mantener firmas y resultados de los seis fetchers actuales: `fetchTodayInfo`, `fetchCurrentWeek`, `fetchTrainingData`, `fetchRoster`, `fetchJuniorRoster`, `fetchJuniorGraph`. Sus consumidores importarán `apiClient`; el worker utilizará `api.ts`, sin acceso a `location`. Mover `TodayInfo` a `apiTypes.ts` y mantener exportación de tipo compatible. Canal `sokker++:api:v1` con operaciones cerradas y `requestId`. `api.cancel({requestId})` solo cancela una petición del mismo documento/contexto, según `messageOwner` de tarea 1; `AbortSignal` se queda en el cliente y `AbortController` en el worker. Mantener una cancelación anticipada por propietario/requestId para impedir su inicio posterior; el cliente comprueba su señal antes de enviar y antes de resolver el resultado. Las respuestas grandes reutilizan el transporte de tarea 1.

- [ ] Escribir pruebas de cliente/servicio que demuestren URL canónica para páginas de `sokker.org`, `app.sokker.org` y un subdominio sintético. Verificar `credentials: 'include'`, GET, parámetros numéricos válidos, rechazo de URL arbitraria y ausencia de permisos/lectura manual de cookies.
- [ ] Implementar el broker y adaptar los fetchers existentes al host constante `https://sokker.org/api`. Mantener endpoints y respuestas normalizadas; no añadir lógica de entrenamiento a los componentes UI. Validar el JSON consumido sin convertir HTML, un error HTTP o un esquema inválido en arrays vacíos que marquen semanas como resueltas.
- [ ] Probar señal ya cancelada, cancelación anterior al registro de fetch, cancelación durante fetch, IDs iguales desde dos documentos, navegación que reemplaza el documento, petición ajena que intenta cancelar, sesión vencida y worker reiniciado. Un error de transporte no confirma escrituras ni resucita trabajo cancelado; la ausencia de controlador no autoriza aceptar una respuesta cancelada y el epoch de persistencia sigue decidiendo qué guardar.
- [ ] Ejecutar `npx vitest run src/core/apiClient.test.ts src/background/apiService.test.ts src/core/api.test.ts` y `npm run build`. Crear `src/core/api.test.ts` en esta tarea. El ensayo autenticado real queda en tarea 7.

**Aceptación:** Todas las páginas consultan los mismos endpoints en el dominio principal a través del worker; ninguna depende de que el script de contenido beta tenga acceso CORS directo.

## Task 2: Migración y backups sin pérdida de semanas

**Files:** Crear `src/core/legacyStorage.ts`, `src/core/legacyCodec.ts`, `src/core/storageMigration.ts`, `src/core/storageMerge.ts`, sus pruebas y `src/core/backupTransfer.test.ts`. Modificar `src/core/storageTypes.ts`, `src/background/storageService.ts`, `src/core/repository.ts` y `src/core/juniorRepository.ts`.

**Interfaces:**

- `readLegacySnapshot(): Promise<LegacySnapshot | null>`: solo la BD del origen actual, sin crearla, actualizarla ni borrarla; no invoca `initDB`. `LegacySnapshot = { origin: string; databaseName: string; databaseVersion: number; encodedStores: string; digest: string; inventory: Array<{ store: string; records: number; digest: string }> }`.
- `encodeLegacyStores` y `decodeLegacyStores` codifican reversiblemente el esquema visible de todos los stores, índices, claves y valores. Distinguir campo ausente y `undefined`; conservar campos desconocidos. Ordenar canónicamente el inventario/esquema y codificar claves con su tipo para calcular huellas. Los tipos sin soporte explícito producen error antes de activar nada. Comprobar igualdad lógica después de decodificar, no solo igualdad del JSON de un DTO normalizado. Leer todos los valores en la transacción readonly; codificar/hash después de cerrarla, sobre la captura consistente.
- `mergePlayerHistory(existing: PlayerData | undefined, incoming: PlayerData): { player: PlayerData; conflicts: MigrationConflict[] }`. `MigrationConflict` conserva origen, entidad, semana/coordenada, variante descartada y motivo.
- `prepareLegacyMigration(snapshot: LegacySnapshot, base: MigrationBase): Promise<PreparedMigration>` guarda archivo íntegro, lo lee y verifica y prepara el candidato en staging, conservando una copia previa del destino. `PreparedMigration = { stageId: string; origin: string; sourceDigest: string; candidateDigest: string; base: MigrationBase }`. Nunca modifica el conjunto activo.
- `publishLegacyMigration(stageId: string): Promise<MigrationReceipt>` lee del staging autoritativo base, propietario, huellas y verificación; no admite sustituirlos por un `PreparedMigration` del cliente. Compara epoch/revisión dentro de la transacción que publica conjunto y marcador. `MigrationReceipt = { origin: string; state: 'absent' | 'migrated' | 'already-migrated' | 'blocked'; sourceDigest: string | null; archiveDigest: string | null; players: number; juniors: number; conflicts: number }`. Los conteos incluyen únicamente registros confirmados; no reemplazan la comprobación de contenido. El recibo queda persistido junto al commit y puede consultarse mediante `getPublicationReceipt(stageId)` tras una respuesta perdida.
- `migrateCurrentOrigin(): Promise<MigrationReceipt>`: lector y cliente de transferencia. La identidad de origen recibida por el worker debe coincidir con `sender.url`.
- Protocolo: `migration.begin({ digest, totalFrames, totalBytes }) → { transferId }`, fragmentos a través del transporte común, `migration.prepare({ transferId }) → PreparedMigration`, `migration.confirmSource({ stageId, sourceDigest }) → ack`, `migration.publish({ stageId }) → MigrationReceipt`. La página vuelve a leer la fuente y confirma el mismo digest antes de publicar. Si cambió, repite la captura; con revisión distinta pero el mismo epoch recalcula/verifica el candidato; con epoch distinto aborta sin adoptar el nuevo. La base se captura consistentemente con el destino y se vincula al intento en el worker. Usar segmentos de hasta 65536 caracteres reducidos para respetar `MAX_MESSAGE_BYTES`; validar orden, conjunto y SHA-256. Tras perder fragmentos no persistidos, responder `UNKNOWN_TRANSFER` y retransmitir. Archivo, staging, verificación y controles autoritativos se conservan en IndexedDB. Comprobar tombstone global tanto al comenzar como al publicar.
- Backup nuevo: `formatVersion: 2` y campos antiguos más `migrationConflicts`, `legacyArchives` y `legacyMetadata` opcionales. No exportar ni importar epochs, marcadores de migración automática ni permisos de esta instalación. `exportBackup(): Promise<BackupData>` e `importBackup(data: unknown): Promise<void>` son fachadas sobre transferencias fragmentadas, nunca un único mensaje de datos. `backup.export.begin` fija una captura consistente con su base; `backup.export.read` entrega frames de esa captura; `backup.export.finish` comprueba conjunto/huella. `backup.import.begin` registra el epoch de intención y abre transferencia; `backup.import.prepare` valida el archivo completo y lee destino/base consistentemente; `backup.import.publish({stageId})` usa el mismo publicador protegido que la migración. Cada candidato conserva propietario, tipo, entrada inmutable, base y huellas verificadas en staging. Revisión distinta con igual epoch exige rebase y nueva verificación; epoch distinto aborta el intento antiguo, incluida una segunda importación que comenzó antes de publicarse la primera. Solo el commit exitoso de importación rota epoch, incrementa revisión y sustituye datos. Un fallo no cambia datos ni controles activos; la copia previa corresponde al destino realmente sustituido. La exportación de una captura fijada no mezcla escrituras posteriores. Cerrar el popup antes de publicar abandona la transferencia; tras aceptar una publicación, reconectar consulta el recibo persistido en vez de repetirla.

- [ ] Escribir pruebas de unión de semanas sintéticas `1000`, `1001` y `1200`; prioridad de informe sobre arrastre; conflicto entre informes; fecha inválida; `latest`; puntos juveniles y frescura; metadatos antiguos que no bloquean semanas de otro equipo. Probar que archivos íntegros, conflictos y campos de recuperación sobreviven a exportación/importación.
- [ ] Añadir prueba de captura/restauración con todos los stores actuales, uno adicional y campos desconocidos; verificar claves, valores y esquema. El lector no ejecuta `put`, `clear`, `delete`, transacciones readwrite, upgrade ni `deleteDatabase` en la fuente. Un tipo no soportado bloquea la migración y no reduce silenciosamente el inventario.
- [ ] Añadir pruebas transaccionales: origen ausente sin creación de BD, copia repetida, fragmento faltante/duplicado contradictorio, digest inválido, falta de cuota, diferencia de readback, interrupción antes de verificar y antes de publicar, aborto durante publicación y reinicio antes/después del marcador. Una escritura de otra pestaña entre preparación y publicación obliga a rebasar el candidato, conservando la nueva semana del destino.
- [ ] Probar el publicador común también con importaciones: pausa tras preparar, confirmar semana nueva desde otra pestaña y publicar preservándola; dos importaciones concurrentes; borrado durante preparación; cuota/aborto del commit; respuesta perdida antes/después de reinicio. Comparar claves/valores, epoch y revisión. Exigir rebase con el mismo epoch, aborto con epoch diferente y ausencia de rotación/control activo en fallos. Probar que un cliente no puede sustituir la base de un stage y que un recibo persistido evita duplicar una publicación incierta.
- [ ] En `backupTransfer.test.ts`, generar un backup total superior a 64 MiB con archivos íntegros y conflictos, sin fixture gigante versionado. Verificar round-trip completo con cada solicitud/respuesta de hasta 262144 bytes serializados. Escribir concurrentemente durante exportación y comprobar que el archivo corresponde a una sola captura; probar bloque faltante, contradictorio y alterado, popup cerrado/reabierto y worker reiniciado. Ningún conjunto parcial se importa ni se anuncia como exportación completa. Conservar el caso de backup antiguo pequeño.
- [ ] Implementar archivo íntegro, staging y fusión. Probar recuperación del destino previo y de la fuente en bases aisladas. Ningún resultado `migrated` precede a la verificación y publicación atómica. No importar cachés antiguas como verificaciones actuales; preservar las reglas juveniles. La misma huella de origen ya confirmada es idempotente; una huella nueva requiere verificación/fusión adicional, salvo que un borrado explícito haya bloqueado la migración automática.
- [ ] Implementar `clearSharedData(): Promise<void>`: rotar epoch, borrar los datos internos comunes y conservar solo control mínimo que bloquee cualquier reimportación automática posterior. Nunca borrar o escribir la fuente ni eliminar la copia independiente. Probar el borrado durante una transferencia y la apertura posterior de un origen no inspeccionado. La importación explícita de un backup sigue disponible.
- [ ] Ejecutar `npx vitest run src/core/legacyStorage.test.ts src/core/legacyCodec.test.ts src/core/storageMigration.test.ts src/core/storageMerge.test.ts src/core/backupTransfer.test.ts src/core/transferProtocol.test.ts src/background/transferService.test.ts src/background/storageService.test.ts src/core/repository.test.ts src/core/juniorRepository.test.ts`.

**Aceptación:** La fuente conserva versión, claves y valores; existe copia íntegra recuperable y verificada antes de activar. Ningún registro se pierde por normalización o validación silenciosa. El marcador no precede a verificación/commit; repetir o reiniciar no duplica datos; borrar no resucita el legado. Copias antiguas siguen siendo importables y los controles locales no viajan con el backup.

## Task 3: Activar el repositorio común en las páginas antiguas y el popup

**Files:** Modificar `src/content/main.ts`, `src/content/ui.ts`, `src/content/tooltip.ts`, `src/content/juniorCard.ts`, `src/content/juniorPage.ts`, `src/core/sync.ts`, `src/core/juniorSync.ts`, `src/core/gapDetector.ts`, `popup/popup.ts`, `popup/index.html` y sus pruebas. Completar `src/core/storageClient.ts` y avisos desde `src/background/storageService.ts`.

**Interfaces:** Consumir las operaciones de tareas 1, 1A y 2. Añadir `subscribeStorageChanges(listener: (state: StorageState) => void): () => void`. La notificación `sokker++:storage-changed:v1` invalida tarjetas/cachés; no sustituye la comprobación transaccional de epoch.

- [ ] Escribir pruebas de bootstrap: `migrateCurrentOrigin` termina antes de `syncData`; un fallo de migración queda visible y no usa silenciosamente la fuente como repositorio activo. En beta, la inspección del origen actual no se confunde con la del dominio principal.
- [ ] Sustituir todos los imports de IO de repositorios por `storageClient` y los imports de fetchers por `apiClient` en los consumidores enumerados, incluidos `juniorPage.ts` y las colas. Ajustar `syncData` para obtener equipo y semana desde `/current` y conservar un `WriteContext` por ejecución. En `reconcileGaps`, capturar ese contexto en las dependencias de producción sin perder los tests puros de `reconcileGapsWithDeps`.
- [ ] Integrar la protección juvenil con el epoch común. Probar dos contextos de página con una gráfica y un informe pendientes mientras el otro restaura o borra. Verificar el rechazo de ambas escrituras antiguas y la invalidación de tarjetas al recibir el aviso.
- [ ] Conectar exportar/importar/borrar del popup con las fachadas de transferencia verificada; no enviar ni recibir el backup completo mediante un solo `sendMessage`. Conservar sincronizar/reparar coordinados desde la pestaña y transportados por el broker canónico. Sin pestaña, permitir los primeros y explicar por qué los segundos requieren abrir Sokker. Mostrar, cuando corresponda, «Para recuperar el historial anterior, abre una página clásica en sokker.org». No abrir pestañas ni tocar el toggle automáticamente. Mantener la confirmación de borrado actual. Si se cierra el popup después de aceptar una publicación, al reabrir consultar recibo y estado actual; antes de esa aceptación, descartar la transferencia incompleta.
- [ ] Ejecutar `npx vitest run src/content/main.test.ts src/content/uiTalent.test.ts src/content/tooltip.test.ts src/content/juniorCard.test.ts src/core/sync.test.ts src/core/juniorSync.test.ts src/core/gapDetector.test.ts popup/popup.test.ts src/background/storageService.test.ts`. Crear `popup/popup.test.ts` para los flujos sin pestaña y errores de transferencia.

**Aceptación:** Las páginas antiguas conservan resumen, gráficas y sincronización usando el repositorio común; el popup funciona para datos locales sin pestaña. Las copias antiguas retenidas no reciben nuevas escrituras del código actualizado.

## Task 4: Rutas independientes del host y navegación SPA

**Files:** Crear `src/content/pageContext.ts` y `src/content/pageContext.test.ts`. Modificar `src/content/observer.ts`, `src/content/main.ts`, `src/content/juniorPage.ts`, `src/content/trainingPlayerPage.ts`, `manifest.json`; crear `src/content/observer.test.ts` y ajustar `src/content/trainingRoutes.test.ts`.

**Interfaces:** `resolvePageContext(url: URL): PageContext | null`, donde `PageContext` es una unión de `squad` con `teamId: number | null`, `player` con `playerId`, `academy` con `teamId`, `training-setup` y `training-report` con `reportId`. Todos incluyen `pathname` y `layout: 'legacy' | 'beta'`. Validar el host antes de interpretar rutas; el layout se deriva del formato y se confirma con DOM en las tareas siguientes.

- [ ] Escribir tabla de casos antiguos/nuevos × dominio principal/app/subdominio sintético, barra final, query/hash, IDs inválidos, `/player/{id}/transfers`, `/squad-extra`, host ajeno y `sokker.org.example.test`. Incluir fichas antiguas tanto en `/player/PID/{id}` como bajo `/app/player/PID/{id}` y `/{idioma}/app/player/PID/{id}`, también con `ID_player`. Incluir rutas de entrenamiento solo tras la evidencia de tarea 0. Los subapartados de ficha no se tratan como la ficha principal sin estructura verificada.
- [ ] Implementar la clasificación y conectar los escáneres con ella, conservando formatos localizados antiguos. Activar el contenido en la familia de hosts, limitando el procesamiento al tipo de vista admitido y su estructura.
- [ ] Probar con timers y mutaciones: DOM tardío dentro del cooldown, cambio de ruta, atrás/adelante, sustitución de nodos y mutaciones propias. Garantizar una pasada final del trabajo aplazado y cancelación de referencias a la vista anterior, sin sondeo continuo ni ciclos causados por la propia extensión.
- [ ] Ejecutar `npx vitest run src/content/pageContext.test.ts src/content/observer.test.ts src/content/trainingRoutes.test.ts src/content/juniorPage.test.ts src/content/trainingPlayerPage.test.ts`.

**Aceptación:** La misma ruta nueva selecciona el mismo layout bajo cualquier host admitido; las rutas antiguas continúan separadas. La navegación no pierde el render final ni mantiene interacciones de otra vista.

## Task 5: Plantilla y ficha beta con las gráficas existentes

**Files:** Crear `src/content/playerBindings.ts`, `src/content/betaPlayerPage.ts`, sus pruebas y fixtures sintéticos `src/content/fixtures/betaSquad.html`, `betaPlayer.html`, `betaPlayerColors.html`. Modificar `src/content/ui.ts`, `src/content/main.ts`, `src/content/observer.ts`.

**Interfaces:** `PlayerAnchors = { playerId: number; names: HTMLElement[]; skills: Array<{ key: PlayerSkillKey; anchor: HTMLElement }> }`; `PlayerSkillKey` enumera las ocho habilidades. `scanBetaPlayers(context: PageContext, root: Document): PlayerAnchors[]`; `bindPlayerAnchors(anchors: readonly PlayerAnchors[]): void`; `leavePlayerBindings(): void`.

- [ ] Crear fixtures pequeños con IDs `12345`/`12346`, bandera antes del nombre, tabla y tarjeta del mismo jugador, ocho habilidades, copias de medición y ambas variantes de colores. No copiar nombres, valores reales ni la captura completa.
- [ ] Escribir pruebas de identidad al cambiar de jugador reutilizando el mismo nodo, un solo hover por evento tras varias pasadas, una lectura compartida por jugador durante un escaneo, y los ocho mapeos sin depender del color. Comprobar que forma/experiencia no se convierten en curvas adicionales.
- [ ] Implementar descubrimiento acotado de tabla/tarjetas y cabecera sin enlace en ficha. Reutilizar normalización, comparación de semanas y tarjetas existentes; mantener la integración antigua. Las flechas de cambio deben tener una ubicación estable que no altere la barra nativa ni duplique el indicador al reescanear.
- [ ] Conectar bindings de hover/foco y un control propio para fijar la gráfica cuando el clic nativo esté ocupado. La prueba debe demostrar que un clic en el botón nativo conserva su handler/default y que el control propio abre la gráfica. Ninguna de las interacciones hace fetch.
- [ ] Ejecutar `npx vitest run src/content/playerBindings.test.ts src/content/betaPlayerPage.test.ts src/content/ui.test.ts src/content/uiTalent.test.ts src/content/tooltip.test.ts src/content/playerCard.test.ts`.

**Aceptación:** Plantilla y fichas beta muestran resumen, curvas y cambios usando el mismo historial que las antiguas; funcionan con sus URL bajo `sokker.org`, sin depender del subdominio ni del tema visual.

## Task 6: Cantera y entrenamiento beta

**Files:** Modificar `src/content/juniorPage.ts`, `src/content/trainingPlayerPage.ts`, sus pruebas y `src/content/trainingRoutes.test.ts`. Ampliar `src/core/apiClient.test.ts` y `src/core/api.test.ts` de tarea 1A solo si aparece una regresión de integración. Crear fixtures `src/content/fixtures/betaAcademy.html`, `betaTrainingSetup.html`, `betaTrainingReport.html` una vez inspeccionadas las vistas correspondientes.

**Interfaces:** Mantener los tipos de vista actuales y sus Map de IDs/anclajes. `scanJuniorPage` y `scanTrainingPlayerPage` consumen el contexto común de tarea 4; sus handlers y la cola juvenil mantienen las reglas actuales y usan el cliente común de tarea 3. No añadir una segunda cola para beta.

- [ ] Probar cantera mediante `data-row-id`, `table__cell--surname button` y `junior-row-{id}` coherentes. Un ID mal formado o contradictorio no recibe gráfica. Probar equipo propio/ajeno, llegada incremental de filas y sustitución del nombre.
- [ ] Probar configuración e informe con sus estructuras observadas y datos sintéticos, incluyendo filas mixtas de primer equipo/juveniles. Rechazar una respuesta `/current` de HTML o mal formada sin guardarla como historial vacío.
- [ ] Implementar los anclajes y rutas beta manteniendo las comprobaciones de equipo, cancelación, caché semanal y límite de concurrencia actuales. Conservar las acciones nativas del nombre juvenil y acceso por teclado. Usar el contrato API confirmado y el transporte de tarea 1A, sin condicionales de datos dispersos por las tarjetas.
- [ ] Ejecutar `npx vitest run src/content/juniorPage.test.ts src/content/trainingPlayerPage.test.ts src/content/trainingRoutes.test.ts src/core/api.test.ts src/core/juniorSync.test.ts src/content/juniorCard.test.ts`.

**Aceptación:** Se muestra el historial correcto de cada categoría en ambas versiones. Una vista sin evidencia o sin acceso sigue pendiente y no se declara compatible.

## Task 7: Verificación completa, documentación y revisión

**Files:** Actualizar `docs/research/2026-10-23-new-sokker-beta-verification.es.md`, `documentation/INSTALL-en.md`, `documentation/INSTALL-es.md`, `documentation/TALENT_SUMMARY.md`, `documentation/TALENT_SUMMARY.es.md`, `documentation/JUNIOR_TALENT.md`, `documentation/JUNIOR_TALENT.es.md`, `documentation/LOGIC_EXPLANATION.md`, `PRIVACY.md` y `PRIVACY.es.md`. Preservar sus cambios previos e incorporar solo el comportamiento finalmente implementado.

- [ ] Ejecutar, después de las pruebas focalizadas, `npx vitest run`, `npx tsc --noEmit` y `npm run build`. Registrar resultados reales y fallos previos por separado. No publicar ZIP ni incrementar una versión de distribución sin que el propietario solicite preparar una entrega.
- [ ] Cargar el artefacto `dist/` y comprobar worker, ausencia de imports inválidos en contenido, popup sin pestaña y lectura común desde pestañas del dominio principal y beta. Reiniciar el worker y repetir una lectura y escritura para comprobar persistencia.
- [ ] Comprobar con la sesión autorizada que el broker consulta la API de `https://sokker.org/api` desde ambas páginas, con cancelación y errores de sesión manejados. Esta comprobación es de solo lectura y transporte, sin cambios al contrato ni pruebas de borrado sobre datos reales.
- [ ] Verificar con datos sintéticos migración interrumpida/repetida, fuente intacta, dos pestañas con escrituras tardías, importaciones concurrentes, borrado sin resurrección y backup antiguo/nuevo. En Chrome, comprobar también exportación/importación superior a 64 MiB con mensajes dentro del límite. Verificar manualmente navegación, ordenación, tabla/tarjetas, teclado, botones nativos, pantallas estrechas y PNG/CSV. No borrar datos reales para una prueba: usar un perfil de prueba y fuentes sintéticas.
- [ ] Probar el escenario futuro sirviendo las fixtures nuevas con URL de `sokker.org` en el harness y contrastar la navegación real de la beta. Registrar qué parte usa fixtures y qué parte está observada en vivo.
- [ ] **Condición para cualquier piloto con la BD real:** tener una copia independiente completa en ubicación local excluida de Git; demostrar su restauración en un entorno aislado y cotejar inventario/huellas; recargar las pestañas para retirar escritores antiguos. Solo entonces ensayar la copia no destructiva. Comprobar fuente antes/después y archivo de destino leído de vuelta; cualquier diferencia inesperada bloquea la activación. No basta con que pasen pruebas sintéticas. Conservar ambas vías de retorno y documentar el resultado sin datos privados.
- [ ] Documentar y ensayar un retorno con datos sintéticos posteriores a la activación: suspender nuevas escrituras, conservar/exportar todo el repositorio común con sus observaciones nuevas y no sobrescribirlo durante el retorno. La fuente anterior es la referencia previa al cambio, no un reemplazo completo de las semanas adquiridas después. Si no puede conservarse el destino, detener el retorno y mantener ambas BDs para recuperación.
- [ ] Documentar almacenamiento por extensión/perfil, recuperación del legado al abrir una página clásica, límites de cuentas/backup, permisos de subdominios y vistas efectivamente comprobadas. Mantener toda evidencia privada fuera de los archivos versionables.
- [ ] Aplicar `code-review-and-quality` y `verification-before-completion`; inspeccionar el diff completo contra el diseño y reparar los hallazgos. Cerrar con evidencia, límites y cualquier vista pendiente. No ejecutar commit, push o publicación.

**Aceptación:** Las verificaciones disponibles pasan, la evidencia distingue pruebas sintéticas de observaciones reales y ninguna vista pendiente se presenta como terminada.

## Revisión del plan antes de ejecutarlo

La secuencia cubre almacenamiento (1), transporte de la API canónica (1A), migración y backup (2), integración antigua/popup (3), rutas/navegación (4), primer equipo beta (5), juveniles/entrenamiento beta (6) y validación completa/piloto condicionado (7). La tarea 0 registra el contrato confirmado y obtiene la evidencia de vistas pendiente. Los riesgos enumerados en Review Focus tienen pruebas asignadas. La ejecución propuesta es secuencial, con comprobaciones por entrega. El propietario solicitó una revisión independiente Astra del diseño y este plan antes de considerarlos listos; esa revisión no autoriza ni sustituye la implementación o la verificación de datos reales.
