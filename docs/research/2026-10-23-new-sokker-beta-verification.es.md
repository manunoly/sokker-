# Verificación de compatibilidad New Sokker beta

Registro de ejecución del plan aprobado el 23 de octubre de 2026. Se distinguen pruebas sintéticas, observaciones autenticadas y comprobaciones del artefacto MV3. El diseño y el plan históricos mantienen su contenido revisado por Astra.

## Entorno y aislamiento

- Rama: `codex/new-sokker-beta` en el worktree administrado `new-sokker-beta`.
- Base: `2f6a51507c4d790074c9404115410316e15a7f2f`; registro del plan: `0047c54`.
- El checkout original y sus modificaciones ajenas a esta tarea permanecen separados.
- No se ha leído, migrado ni modificado la BD real del propietario. Las pruebas de persistencia usan datos sintéticos aislados.
- El propietario confirmó que la API permanece en `https://sokker.org/api`, también para la beta.

## Base antes de implementar

| Comando | Resultado |
| --- | --- |
| `npm ci --offline` | Correcto; 136 paquetes, cero vulnerabilidades informadas por esa ejecución offline |
| `npx vitest run` | 27 archivos, 268 pruebas correctas |
| `npx tsc --noEmit` | Salida 0 |
| `npm run build` | Salida 0 |

## Progreso

| Unidad del plan | Estado |
| --- | --- |
| 0: API y evidencia de vistas | Contrato confirmado por el propietario; DOM de las vistas previstas inspeccionado |
| 1 y 2: persistencia común, transferencias y migración | Implementadas por GPT-6.1-Sol; S1–S3 revalidados por Astra high |
| 1A: broker API canónico | Implementado por GPT-6.1-Sol; revisión Astra high de código cerrada |
| 3: coordinadores y popup | Implementados; pruebas integradas finales correctas |
| 4: rutas y navegación SPA | Implementadas; revisión Astra high de API/UI cerrada |
| 5 y 6: primer equipo, cantera y entrenamiento beta | Implementados y comprobados con fixtures sintéticas y DOM observado |
| 7: verificación y documentación | Pruebas integradas, visuales y de IndexedDB ejecutadas; código revalidado por Astra high; ensayo MV3 real pendiente |

## Observaciones autenticadas de vistas

Las capturas privadas suministradas se usaron como evidencia de plantilla, ficha y cantera; no se versionaron sus nombres, IDs ni valores. El propietario preparó una sesión en el navegador integrado, que permitió completar las inspecciones de lectura sin cambiar el toggle ni opciones de entrenamiento.

| Vista | Estructura observada |
| --- | --- |
| Beta `/squad` y `/squad/{teamId}` | Tabla con `tr.table-row[data-row-id]`, enlace de nombre `/player/{id}` y columnas semánticas; tarjetas `@container/player` simultáneas. Plantilla propia y ajena comparten estructura. |
| Beta `/player/{id}` y `/player/{id}/development` | Nombre sin enlace identificado por la ruta; ocho botones con etiquetas semánticas de habilidades y variantes visuales. Se excluyen copias invisibles de medición. |
| Beta `/juniors/{teamId}` | Filas con `data-row-id`, `td.table__cell--surname button` y `junior-row-{id}` coherentes; se conserva la comprobación de equipo propio. |
| Beta `/training/training-setup` | `.players-table` con `tr.table-row[data-row-id]`; nombre en `td.table__cell--player a.players-table__player .playerInfo__name`; enlace `/player/{id}/development?from=training`. Controles nativos independientes. |
| Beta `/training/reports/details/{id}` | Secciones `.boxes-training__main-team` y `.boxes-training__junior-team`; nombre sin enlace en `td.table__cell--player .rich-text`. Primer equipo con ocho columnas semánticas; juveniles con `--exp` y `--weeks`. |
| Clásica `/{locale}/app/squad/` | Accesible directamente en el dominio principal; conserva `.view-squad`, `.player-box` y `.skill-list__item`. |

Estas lecturas demuestran la estructura observada. No prueban la extensión cargada ni el broker autenticado de su worker. La compatibilidad de rutas beta bajo el dominio principal y un subdominio futuro se ensayó con fixtures y URL virtuales, porque ese despliegue futuro no está disponible.

## Pruebas integradas y fallos corregidos

La primera integración produjo 378 pruebas correctas y una fallida en 45 archivos. El fallo de cleanup de entrenamiento se debió al bootstrap que ahora espera la migración y se corrigió conservando la garantía de cierre. Se corrigió también el cleanup de transferencias por puerto: cerrar uno libera sus transferencias sin cancelar otras lecturas ni el broker de ese documento. Se reforzaron los recibos ante respuestas perdidas y la verificación autoritativa de staging.

La batería global anterior a S3 produjo 403 pruebas correctas en 47 archivos. Tras la corrección final, la repetición produjo **407 pruebas correctas en 47 archivos**, `npx tsc --noEmit` con salida 0, `npm run build` con salida 0 y `git diff --check` sin errores. El typecheck separado del harness de almacenamiento también terminó con salida 0. El build genera worker módulo, popup y contenido IIFE separados, con manifiesto común. No se incrementó la versión ni se generó un ZIP de distribución.

Astra high reprodujo y revalidó A1–A3 de API/UI y S1–S3 de almacenamiento. El veredicto favorable de código y los límites MV3 están en el [registro de auditoría](2026-10-23-new-sokker-beta-code-audit.es.md).

## Ensayo visual aislado

El harness `scripts/browser-check/` ejecuta los módulos reales de vistas, bindings y Canvas sobre fixtures sintéticas; simula el transporte de extensión con historial sintético y bloquea solicitudes. Se ejecutaron **54 comprobaciones por host**, para `sokker.org`, `app.sokker.org` y un subdominio sintético: **162 comprobaciones correctas**. Cubren plantilla propia/ajena, ficha, variante de colores, cantera, configuración e informe.

Se comprobaron además diez condiciones en una ficha con colores a 390 × 844: teclado, control propio para fijar, Canvas y tarjeta dentro del viewport. Se verificaron la producción de PNG y CSV sintéticos y el respeto de acciones nativas. No se presenta este harness como una extensión MV3 ni como una reproducción completa del CSS de Sokker.

## Ensayo con IndexedDB nativo

El harness `scripts/storage-browser-check/` ejecuta servicios, codec, publicador y fragmentador reales en `http://127.0.0.1:4175`, sin `fake-indexeddb`. Antes de abrir una base, valida el origen y rechaza bases preexistentes ajenas a su catálogo de propiedad; solo limpia sus propias bases sintéticas. La CSP y el fetch bloqueado impiden solicitudes de datos.

La ejecución anterior a S3 y la repetición con la fuente final pasaron **los nueve escenarios**:

1. Captura íntegra de una fuente sintética con cinco stores, un esquema desconocido, índices y tipos reversibles.
2. Restauración aislada con comparación de versión, esquema, claves y valores.
3. Migración interrumpida/repetida, confirmación de fuente, recibo y reemplazo de instancias de servicio.
4. Rebase con observaciones concurrentes, importaciones competidoras y rechazo de contextos antiguos.
5. Doce importaciones con recuperación criptográfica de cada destino anterior, cuerpos planos y únicos.
6. Retorno ensayado conservando observaciones posteriores, sin sustituir el destino; aborto transaccional real.
7. Borrado sintético con tombstone, rechazo de escritores anteriores y bloqueo de un origen no inspeccionado.
8. Importación/exportación superior a 64 MiB, límites de sobres y captura de exportación consistente.
9. Transferencia interrumpida o alterada rechazada sin anunciar integridad ni cambiar controles.

La huella de la fuente antes y después fue idéntica: `091483d693f26c8839b147f14fc783a033c328e3de7305fceae51a54ac71e133`. En el caso de volumen se importaron 68162762 bytes y se exportaron 68164058, usando 1041 frames de descarga y 2097 mensajes. Los máximos medidos de sobres JSON UTF-8 fueron 66894 bytes para solicitudes y 75568 para respuestas, inferiores a 262144. Una observación confirmada durante la exportación apareció en el conjunto activo pero quedó fuera de la captura fijada.

Este ensayo usa transacciones nativas, pero el reinicio sustituye instancias y conexiones locales, no un service worker real. Los contextos concurrentes son lógicos dentro del documento. No comprueba permisos, cookies, CORS ni entrega de avisos entre pestañas de una extensión cargada. La repetición final con S3 mantuvo todos los escenarios correctos.

## Chrome y condición del piloto real

El propietario eligió preparar un **Chrome de prueba conectado**, con perfil vacío, para comprobar `dist/` como extensión MV3. El inventario disponible solo muestra el navegador integrado y MCP Apps; Chrome todavía no está disponible. No se lanzó Chrome por terminal ni se usó el perfil habitual del propietario.

Permanecen pendientes: cargar el artefacto, comprobar popup sin pestaña, worker real y su reinicio, lectura común entre pestañas, transporte autenticado desde páginas clásica y beta y backup grande a través de mensajería de extensión. Los ensayos anteriores no sustituyen estas verificaciones.

Antes de cualquier piloto con el historial real: obtener una copia independiente íntegra fuera de Git, demostrar restauración aislada y cotejar inventarios/huellas, y recargar las pestañas para retirar escritores antiguos. Las pruebas sintéticas no satisfacen por sí solas esta condición. El piloto real no se ha ejecutado.

## Dependencia de pruebas y auditoría npm

Se añadió únicamente `fake-indexeddb` 6.2.6 como dependencia de desarrollo. La instalación requirió `NODE_OPTIONS=--use-system-ca` para usar el almacén de confianza de Windows; TLS permaneció activo. El lockfile no cambia versiones de paquetes anteriores.

La auditoría online posterior informó 12 entradas en herramientas de desarrollo preexistentes (`@vitest/mocker`, `brace-expansion`, `esbuild`, `minimatch`, `nanoid`, `picomatch`, `postcss`, `rollup`, `source-map-js`, `undici`, `vite`, `vitest`), ninguna atribuida a `fake-indexeddb`. El cero de la instalación offline no era una comprobación online de avisos actuales. No se ejecutó una actualización masiva ajena al plan.

## Inspección estática del artefacto final

Se confirmó que el manifiesto MV3 apunta a `background.js` como módulo y que existen worker, popup y contenido. El AST de `dist/content.js` no contiene declaraciones import/export ni import dinámico. Los permisos son `https://sokker.org/*` y `https://*.sokker.org/*`.

| Archivo | Bytes | SHA-256 |
| --- | --- | --- |
| `background.js` | 50070 | `d2d29702a594c7511bf631265ed202131acbc6066c636ed44adbea8d6587861f` |
| `content.js` | 101943 | `1a0889469d5acd3d3e52a4d69193c0fe169f41739ee5ad764c9df39ba49ca0a8` |
| `popup.js` | 6042 | `50bf7d9e4336a0d7ed5f7a2cd390abe9aade339410df293b31d041b74877e2ff` |

La inspección de código modificado no encontró tests omitidos/focalizados ni nuevas supresiones de tipos/lint. Una búsqueda acotada de los identificadores privados observados no encontró coincidencias en los cambios. No se presenta esta búsqueda como auditoría exhaustiva de secretos.

## Commits de progreso

- `6f4aabe`: compatibilidad clásica/beta, almacenamiento compartido, recuperación y broker, con pruebas de regresión.
- `d7aed1b`: harnesses aislados de vistas e IndexedDB nativo.

Los cambios permanecen en `codex/new-sokker-beta`. No se ha hecho push, merge, publicación ni piloto de datos reales. El artefacto local para el Chrome de prueba es `dist/` de este worktree.

## Preparación del ensayo de popup MV3

Se añadieron [generador, cotejador y pasos de Chrome](../../scripts/mv3-browser-check/README.md) para la comprobación pendiente del popup. No abren navegador, IndexedDB ni red. Cada ejecución usa un directorio nuevo bajo `node_modules/.cache/sokker-mv3-check/`, con escrituras exclusivas y sin borrados. Los JSON y reportes generados están ignorados por Git.

El conjunto `430df988-b352-4dfc-a594-a166ca2f88af` contiene un backup antiguo de 2044 bytes, uno v2 de 6486 bytes y otro v2 de 68163691 bytes, con manifiesto e inventarios/huellas. Usa exclusivamente identidades sintéticas y un archivo íntegro con stores desconocidos. Se cotejaron los tres archivos con validadores reales y el payload truncado fue rechazado. El coordinador repitió el CLI sobre el grande y el typecheck del script: salida 0. SHA-256 del JSON grande: `f6eafdad87386aa4928d837e0d9194c986f072e570752918f96eadb5d8bdf43f`.

Astra high revisó los cuatro archivos auxiliares. Detectó un falso positivo al cotejar metadatos juveniles y revalidó su corrección: alteraciones individuales de `weeksLeft`, `graphWeek`, `resolvedWeek` y `resolution` se rechazan sin escribir reportes; una unión válida de puntos se acepta. El cotejador comprueba seis campos juveniles contra estas fixtures, observaciones del jugador, coherencia de `latest`, archivos íntegros y payload. La revisión acotada terminó sin hallazgos accionables pendientes.

Los reportes declaran `chromePopupExecution: not-established-by-cli`. Cotejar el propio archivo generado verifica la herramienta; no acredita una exportación del popup. La fuente del producto y el artefacto MV3 no cambiaron desde los resultados de 407 pruebas/tipos/build y las auditorías registradas. Los servidores de los harnesses terminados se cerraron. La carga y ejecución real de Chrome sigue pendiente de la conexión elegida por el propietario.
