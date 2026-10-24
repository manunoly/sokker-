# Auditorías de código New Sokker beta

Revisión solicitada por el propietario con **Astra en high**, sobre la implementación de subagentes **GPT-6.1-Sol** en `codex/new-sokker-beta`. Este informe es distinto de la revisión documental del plan. La base comparada es `2f6a51507c4d790074c9404115410316e15a7f2f`.

## API, integración y vistas

Astra examinó API, broker, clientes, sincronizadores, popup, rutas, observador y bindings. Ejecutó 75 pruebas correctas en nueve archivos en la primera pasada y reproducciones adicionales sobre código real con fronteras sintéticas.

| ID | Defecto reproducido | Estado |
| --- | --- | --- |
| A1 | El listener de una celda clásica cancelaba enlaces nativos descendientes al fijar una gráfica. | Corregido por Sol y revalidado por Astra high |
| A2 | Navegar mientras la migración inicial seguía pendiente podía marcar la sincronización como iniciada sin ejecutarla. | Corregido por Sol y revalidado por Astra high |
| A3 | Reutilizar un enlace de tarjeta para otro jugador antes del reescaneo podía mostrar el historial del ID anterior. | Corregido por Sol y revalidado por Astra high |

Astra repitió las tres reproducciones: el enlace nativo conserva `defaultPrevented: false`; navegar durante la migración ejecuta exactamente una sincronización; cambiar el enlace de jugador antes de reescanear no abre el historial anterior. Ejecutó 35 pruebas correctas en seis suites y no confirmó otro P1/P2 en ese alcance. El coordinador ejecutó por separado 38 pruebas correctas en seis archivos.

## Persistencia y recuperación

Astra revisó conservación íntegra, publicación, transacciones, transferencias, backups y empaquetado. Identificó los siguientes P2; no confirmó pérdida P0/P1 en el alcance revisado.

| ID | Defecto reproducido | Estado |
| --- | --- | --- |
| S1 | Las capturas del destino anterior anidaban los archivos previos, produciendo crecimiento exponencial en importaciones repetidas. | Corregido por Sol y revalidado por Astra high |
| S2 | Una fuente idéntica ya migrada requería staging; falta de cuota allí bloqueaba el bootstrap pese al marcador correcto. | Corregido por Sol y revalidado por Astra high |
| S3 | Al fusionar archivos con IDs coincidentes, un alias histórico se añadía como registro físico al recuperar un destino futuro y rompía su digest. | Corregido por Sol y revalidado por Astra high |

Para S1, Astra repitió doce importaciones idénticas: el tamaño pasó de 667 a 7837 bytes, con un único cuerpo y once destinos anteriores recuperables; antes llegaba a 1715029 bytes. Para S2, la fachada de producción devuelve `already-migrated` bajo cuota simulada con cero escrituras en staging. Una huella nueva exige migración completa y el borrado sigue bloqueándola.

La pasada que descubrió S3 ejecutó 69 pruebas correctas en 14 archivos. También detectó una incoherencia de validación: campos llamados `archiveRefs` dentro de un archivo `kind: 'legacy'` se ignoraban al verificarlo pero se interpretaban al recuperar un destino posterior. Se incluyó en la corrección de S3. Las reproducciones muestran que una batería verde no sustituye la revisión independiente.

## Evidencia y límites

El grafo `sokkerAI-new-sokker-beta`, generación `2026-10-23T23:53:49Z`, orientó la revisión. La metadata marcaba fuentes cambiadas y se leyó el código exacto. Pruebas, fixtures y archivos nuevos excluidos o ausentes del índice se consultaron directamente. La ausencia de huecos registrados no se presenta como prueba de exhaustividad.

No se accedió a la BD real ni se realizó el piloto de migración. Las reproducciones y pruebas usan datos sintéticos. La auditoría de código no equivale a comprobar una extensión MV3 cargada con sesión de Sokker. Los hallazgos de código A1–A3 y S1–S3 quedan cerrados. La aceptación de ejecución MV3 sigue pendiente y se registra por separado.

## Revalidación final S3 y regresiones

Astra repitió independientemente la colisión original, una segunda colisión sucesiva y los campos legacy con autorreferencias. Comprobó publicación → exportación JSON → importación en otra BD aislada → nueva publicación, recuperando tres capturas con JSON canónico exacto y verificando SHA-256 de siete archivos anteriores. Los alias opcionales conservan el nombre propio de cada captura y los campos desconocidos del legado permanecen íntegros sin adquirir semántica de referencias.

La batería propia de Astra pasó **73 pruebas en 14 archivos**, incluidos crecimiento lineal, bootstrap bajo cuota, backups v2 anidados y transferencia superior a 64 MiB. `git diff --check` terminó con salida 0 y avisos de CRLF. No confirmó nuevos problemas materiales en ese alcance. La batería global del coordinador pasó después de S3: **407 pruebas en 47 archivos**, tipos y build con salida 0. La repetición del harness nativo pasó sus nueve escenarios.

El veredicto de código es favorable dentro de los alcances revisados. No certifica mensajería, permisos, cookies o reinicio de un service worker real; tampoco autoriza el piloto de la BD real sin copia independiente y restauración verificada.

## Herramientas para preparar el ensayo MV3

Astra high revisó por separado `scripts/mv3-browser-check/cli.ts`, `run.mjs`, `tsconfig.json` y `README.md`. El P2 encontrado permitía aceptar cambios de procedencia juvenil al cotejar archivos. Sol lo reprodujo en rojo y añadió comparación de los campos omitidos. Astra revalidó cada alteración individual, sin reportes de éxito, y los casos positivos de archivo válido y unión de puntos.

La revisión final de esos cuatro archivos fue favorable, sin hallazgos accionables. Las salidas son nuevas y exclusivas, sin borrado/sobrescritura; los reportes explicitan que el CLI no establece ejecución del popup. La inspección usó fuente directa porque `scripts/` está excluido del grafo. No hubo cambios de producto, navegador ni datos reales en esta revisión.

## Revalidación del refresco tras commits: 24 de octubre de 2026

Después del reporte manual del propietario, el coordinador detectó que la migración y las escrituras ordinarias no enviaban avisos a las páginas. Sol reprodujo siete fallos por ausencia de avisos y añadió `afterCommit` en `storageService.ts`, con regresiones en `storageService.test.ts`. El alcance no cambia esquema ni políticas de persistencia.

Astra high revisó ese diff contra `ddb4393` y sus consumidores. Veredicto favorable, sin hallazgos accionables P0–P3: los avisos esperan al commit; abortos, epoch inválido y lecturas no notifican; recibos, identidades y CAS se conservan. El observador agrupa refrescos, la reconciliación comparte trabajo en curso y no vuelve a rellenar semanas ya cubiertas; la cola juvenil mantiene sus protecciones ante revisiones ordinarias.

La batería propia de Astra pasó **80 pruebas en seis archivos**, incluido servicio 17/17; diff check correcto. Se usó fuente exacta por metadata desactualizada del grafo y exclusión de tests. El test root/app utiliza consumidores simulados sobre fake IndexedDB y coteja la fuente sintética antes/después; no acredita una nueva ejecución MV3 ni integridad registro a registro de los datos reales del propietario.
