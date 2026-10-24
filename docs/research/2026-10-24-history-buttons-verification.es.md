# Verificación de los controles +: 24 de octubre de 2026

## Entrega

La compilación anterior a este cambio aún tenía los botones con borde porque solo se había construido una maqueta. Esta entrega incorpora la propuesta al producto en `codex/new-sokker-beta`: habilidades sin borde/fondo en reposo, nombres con borde discreto, controles clásicos y beta, preferencia global activada por defecto y fijado juvenil con cierre visible y Escape.

Dos trabajadores GPT-6.1-Sol implementaron preferencias/popup y controles/tarjetas. La preferencia usa `chrome.storage.local`, separada del histórico y de sus copias JSON. El único permiso nuevo es `storage`. No se cambiaron API, esquema, migraciones ni código del servicio de almacenamiento histórico. No se accedió a la BD real del propietario.

## Pruebas y auditoría

| Comprobación | Resultado |
| --- | --- |
| `npx vitest run --maxWorkers=2` final | 454/454 pruebas, 49 archivos, salida 0 |
| `npx tsc --noEmit` final | Salida 0 |
| `npm run build` final | Salida 0 |
| `git diff --check` | Salida 0 |
| Astra high, cuatro archivos focalizados | 48/48 pruebas y revisión favorable tras correcciones |
| Harness Chromium con fuentes lógicas root y app | 83 comprobaciones por fuente, 166 correctas |

La primera batería global, previa a dos correcciones de auditoría, pasó 447 pruebas. No se rebajaron timeouts, assertions ni umbrales. Las comprobaciones de mutación temporales de los trabajadores detectaron una preferencia forzada a true y la retirada del guard de tarjeta juvenil fijada; ambas mutaciones fueron restauradas y las fuentes finales se volvieron a verificar.

Astra detectó dos P2 y revalidó sus correcciones:

1. Los adaptadores de nombres del primer equipo en configuración e informes de entrenamiento aún no creaban `+`. Ahora lo hacen en rutas clásicas y beta, con cleanup y guardas de identidad/lectura tardía.
2. Flecha abajo desde el nuevo `+` juvenil no entraba a la tarjeta. Ahora acepta ese control como origen y mantiene/limpia sus referencias ARIA sin sustituir las nativas.

La revisión terminó sin hallazgos accionables pendientes en ese alcance. El índice del grafo estaba desactualizado y excluía pruebas/scripts; se usó fuente exacta para verificar los archivos relevantes.

## Evidencia de navegador y límites

`scripts/browser-check/` ejecutó las siete vistas sintéticas con `https://sokker.org` y `https://app.sokker.org` como fuentes lógicas. El origen real siguió siendo localhost. Se comprobó el CSS calculado sin borde/fondo de las habilidades, la ocultación/restauración inmediata, hover/foco con controles ocultos, clics nativos, Canvas/PNG/CSV y permanencia/cierre de la tarjeta juvenil fijada. El stub de preferencias fue solo memoria; no guardó opciones en Chrome.

El ensayo no certifica una extensión MV3 cargada, la entrega real de eventos de storage entre pestañas ni toda la distribución con el CSS nativo de Sokker. La inserción de hermanos en grids beta ya existía antes de este cambio y puede depender del contenedor nativo; el harness no reproduce ese CSS completo. La comprobación final en el navegador del propietario sigue siendo necesaria. No se automatizó Chrome por terminal ni se usó su perfil.

## Artefacto generado

Se verificaron en `dist/content.js` el CSS de ambas variantes, la regla de ocultación y la clave de preferencias; en `dist/popup.js`, el texto español del control; y en `dist/manifest.json`, el permiso `storage`. El worker conserva exactamente el hash anterior.

| Archivo | SHA-256 |
| --- | --- |
| `background.js` | `26cb660344389738a74f22f2b9dafc99303412e6e7e2f770de797df4a434224a` |
| `content.js` | `b47810d6f773ec10036e70055bf215bbb38cb302b77e7f0497f687a0c94e28fe` |
| `popup.js` | `19e41af83d7104a4808781d949455b15d9d4beb38ba06e1078660deaa3cf1525` |

La carpeta para cargar o recargar es el `dist` del worktree `new-sokker-beta`. El propietario debe recargar después las páginas de Sokker para retirar los controles inyectados por la compilación anterior. No se incrementó la versión ni se publicó una extensión.
