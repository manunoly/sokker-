# Verificación de compatibilidad New Sokker beta

Registro de ejecución del plan aprobado el 23 de octubre de 2026. Este documento distingue código y pruebas de observaciones autenticadas. El diseño y el plan históricos mantienen su contenido revisado por Astra.

## Entorno y aislamiento

- Rama: `codex/new-sokker-beta` en el worktree administrado `new-sokker-beta`.
- Base de código: `2f6a51507c4d790074c9404115410316e15a7f2f`.
- Registro del plan aprobado: `0047c54`.
- El checkout original y sus modificaciones ajenas a esta tarea permanecen separados.
- No se ha leído, migrado ni modificado la BD real del propietario. Las verificaciones de persistencia se realizan con datos sintéticos aislados.
- El propietario confirmó que la API se mantiene en `https://sokker.org/api`, también para la beta.

## Base antes de implementar

Ejecutado en el worktree el 23 de octubre de 2026:

| Comando | Resultado |
| --- | --- |
| `npm ci --offline` | Correcto; 136 paquetes, cero vulnerabilidades informadas |
| `npx vitest run` | 27 archivos, 268 pruebas correctas |
| `npx tsc --noEmit` | Código de salida 0 |
| `npm run build` | Código de salida 0 |

## Progreso

| Unidad | Estado |
| --- | --- |
| Persistencia común, transferencias y migración | Implementación delegada a GPT-6.1-Sol |
| Broker API canónico | Implementación delegada a GPT-6.1-Sol |
| Rutas, plantilla, ficha y cantera beta | Implementación delegada a GPT-6.1-Sol |
| Integración de coordinadores y popup | Pendiente de contratos comunes |
| Auditoría de código Astra high | Pendiente de implementación |

## Evidencia de vistas y límites actuales

Las capturas privadas suministradas permiten inspeccionar plantilla, ficha de jugador y cantera beta. Se derivarán fixtures sintéticos mínimos; no se versionan las capturas originales ni sus nombres, IDs o valores.

Inicialmente el navegador conectado redirigió de `/squad` a `/login`. El propietario preparó la sesión y fue posible cerrar la inspección DOM de configuración, informe y plantilla ajena, según la tabla de observaciones autenticadas de este documento. La comprobación del artefacto y del broker sigue pendiente.

## Condición del piloto real

Antes de probar con el historial del propietario: obtener una copia independiente íntegra fuera de Git, demostrar su restauración aislada y cotejar inventarios/huellas, y recargar las pestañas para retirar escritores antiguos. Las pruebas sintéticas no satisfacen por sí solas esta condición. El piloto real no se ha ejecutado.

## Observaciones autenticadas de vistas

La sesión preparada por el propietario permitió inspecciones de lectura el 23 de octubre de 2026, sin cambiar el toggle ni opciones de entrenamiento:

| Vista | Estructura observada |
| --- | --- |
| Beta `/training/training-setup` | `.players-table` con `tr.table-row[data-row-id]`; nombre en `td.table__cell--player a.players-table__player .playerInfo__name`; enlace `/player/{id}/development?from=training`. Controles de posición y acción nativos independientes. |
| Beta `/training/reports/details/{id}` | Secciones `.boxes-training__main-team` y `.boxes-training__junior-team`; filas `tr.table-row[data-row-id]`; nombre sin enlace en `td.table__cell--player .rich-text`. Primer equipo con las ocho columnas semánticas; juveniles con `--exp` y `--weeks`. |
| Beta `/squad/{teamId}` ajena | Tabla con `data-row-id`, enlace de nombre `/player/{id}`, columnas semánticas de habilidades y tarjetas `@container/player` simultáneas; coincide con la estructura de plantilla propia. |
| Clásica `/{locale}/app/squad/` | Accesible directamente en el dominio principal; conserva `.view-squad`, `.player-box` y `.skill-list__item`. La observación no lee ni migra IndexedDB. |

Los anclajes observados se comunicaron al implementador para elaborar fixtures sintéticos. Una lectura DOM real demuestra la estructura de la página; no certifica todavía el comportamiento del artefacto de la extensión ni el broker del worker.

## Dependencia de pruebas y auditoría npm

Se añadió únicamente `fake-indexeddb` 6.2.6 como dependencia de desarrollo. La instalación requirió `NODE_OPTIONS=--use-system-ca` para usar el almacén de confianza de Windows; la validación TLS permaneció activa. El diff del lockfile no cambia versiones de paquetes anteriores.

La auditoría online posterior informa 12 entradas en herramientas de desarrollo preexistentes (`@vitest/mocker`, `brace-expansion`, `esbuild`, `minimatch`, `nanoid`, `picomatch`, `postcss`, `rollup`, `source-map-js`, `undici`, `vite`, `vitest`), ninguna atribuida a `fake-indexeddb`. El cero de la instalación inicial offline no era una comprobación online de avisos actuales. No se ejecutó una actualización masiva de dependencias ajena al plan.
