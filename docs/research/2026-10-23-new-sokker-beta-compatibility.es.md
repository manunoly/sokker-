# Compatibilidad de Sokker++ con New Sokker beta

Evaluación del 23 de octubre de 2026. Estado: investigación y propuesta; sin cambios de implementación.

Seguimiento de la conversación: el propietario aceptó orientar la solución a rutas independientes del host y un historial común gestionado por la extensión, incluyendo el posible traslado de las páginas nuevas al dominio principal. El [diseño propuesto](../superpowers/specs/2026-10-23-new-sokker-beta-design.md) y su [plan de implementación](../superpowers/plans/2026-10-23-new-sokker-beta.md) desarrollan esa dirección; las recomendaciones siguientes conservan el contexto de la evaluación inicial.

Actualización del propietario: las API no cambian y siguen en `https://sokker.org/api`, también desde la beta; confirmó una Request URL de entrenamiento. La conservación íntegra de la BD actual es un requisito no negociable. El diseño y el plan ya incorporan el transporte canónico y una migración sin escrituras a la fuente, con archivo completo y verificación antes de activación. La incertidumbre de API descrita en la evaluación inicial queda sustituida por esa confirmación; todavía debe probarse el nuevo transporte de la extensión. El propietario solicitó revisión independiente Astra de ambos documentos.

## Resultado

La beta requiere adaptar cuatro capas: carga de la extensión, reconocimiento de rutas, integración con el DOM y continuidad del historial entre dominios. Ampliar selectores por sí solo no resuelve el problema.

Recomiendo mantener el adaptador actual y añadir uno para la beta, compartiendo las tarjetas, los cálculos y las exportaciones. Para conservar un mismo historial al alternar entre versiones, recomiendo estudiar un repositorio común en el origen de la extensión, con migración de los datos existentes. Esta última parte es una propuesta técnica, no una decisión ya aprobada.

La compatibilidad de las API desde el nuevo dominio sigue pendiente de comprobación autenticada. Las capturas HTML no demuestran qué endpoints responden ni el contrato de sus respuestas.

## Evidencia y límites

Se revisaron `url.txt` y las cuatro capturas HTML de `documentation/new-page-sokker/`: plantilla, cantera y dos variantes de la ficha de un jugador, una con colores por nivel. También se inspeccionó como texto el bundle de arranque guardado junto a la plantilla. No se ejecutaron sus scripts ni se hicieron consultas a la cuenta.

La inspección empleó JSDOM y los módulos actuales de rutas y observación, transpilados en memoria con TypeScript. Se sustituyeron las dependencias externas y el observador de mutaciones para comprobar la primera pasada sin red, persistencia ni ejecución del JavaScript de Sokker. Esto verifica la estructura y la selección inicial; no reproduce el renderizado visual, las interacciones de React ni toda la navegación SPA.

El grafo consultado fue `C-Users-manue-Documents-projects-sokkerAI`, generación `2026-10-23T22:10:33Z`, con nivel Verify. Las consultas relevantes se completaron sin paginación pendiente. La cobertura indicó metadatos cambiados para las fuentes utilizadas; se contrastaron las funciones y configuraciones determinantes con el código actual. El ámbito de contenido también registraba una limitación de parseo en la línea 14 de `juniorCard.test.ts`, que se leyó directamente. El grafo se usó como orientación, sin asumir exhaustividad.

Este documento conserva rutas y estructura, sin copiar nombres, identificadores reales, valores de habilidades, respuestas privadas ni capturas. Los identificadores de los ejemplos siguientes son sintéticos.

## Cambios confirmados

### Dominio y carga

[El manifiesto actual](../../manifest.json) declara únicamente `https://sokker.org/*` tanto en `content_scripts.matches` como en `host_permissions`. Las capturas proceden de `https://app.sokker.org/`. Por tanto, en una carga normal de la beta no se inyecta `content.js`, con independencia de los selectores.

La documentación de Chrome distingue el host exacto de un patrón que incluye subdominios: [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns). La propuesta es añadir explícitamente `https://app.sokker.org/*` y conservar el patrón actual.

[El popup](../../popup/popup.ts) envía mensajes a la pestaña activa; no contiene un filtro de dominio que explique este fallo. Necesita que el script esté presente y responda en ambos hosts.

### Rutas

| Vista | Formato reconocido actualmente | Formato beta observado | Alcance de la evidencia |
| --- | --- | --- | --- |
| Plantilla propia | `/{idioma}/app/squad/` o `/app/squad/` | `/squad` | Captura HTML y lista de URL. |
| Plantilla de un equipo | Ruta del formato anterior bajo `/app/squad` | `/squad/42` | Lista de URL; sin captura separada de esta variante. |
| Ficha de jugador | Rutas que contienen `/player/PID/12345` o `/player/ID_player/12345` | `/player/12345` | Dos capturas HTML. |
| Cantera | `/juniors/teamID/42/` | `/juniors/42` | Captura HTML y lista de URL. |
| Configuración de entrenamiento | `/{idioma}/app/training/training-setup/` | `/training/training-setup` | Enlaces del menú y bundle; sin HTML de su contenido. |
| Detalle de informe | `/{idioma}/app/training/reports/details/{semana}/` | `/training/reports/details/{id}` | Módulo de ruta en el bundle; sin HTML ni semántica del parámetro comprobados. |

[El observador](../../src/content/observer.ts) comprueba `/app/squad` y los formatos `PID`/`ID_player`. [La cantera](../../src/content/juniorPage.ts) y [los nombres en entrenamiento](../../src/content/trainingPlayerPage.ts) tienen sus propias expresiones de rutas. Todos estos puntos necesitan reconocer la variante correspondiente; cambiar solo el observador dejaría funciones sin activar.

En la reproducción, ninguna captura beta activó los callbacks de plantilla o ficha y la cantera beta devolvió `null`. Los controles sintéticos de plantilla, ficha y cantera antiguas sí fueron reconocidos. La ruta beta de configuración también fue rechazada, mientras que la antigua fue aceptada.

### Plantilla: tabla y tarjetas presentes a la vez

En la captura beta desaparecen `.view-squad`, `.player-box`, `.player-box--sm`, `.skill-list__item` y `.skill-list-item`, que usa [la integración actual](../../src/content/ui.ts).

La nueva tabla aporta puntos de unión útiles:

- Filas `tr.table-row[data-row-id]`, cuyo identificador coincide con el del enlace de jugador.
- Nombre en `td.table__cell--name a`, con ruta `/player/{id}`.
- Habilidades en las columnas `table__cell--stamina`, `--pace`, `--technique`, `--passing`, `--keeper`, `--defending`, `--playmaking` y `--striker`.

La misma captura contiene tarjetas de esos mismos jugadores. Se comprobó la coincidencia de los IDs entre ambas presentaciones. El adaptador debe admitir varios anclajes por jugador y compartir la lectura de su historial, evitando duplicar sincronizaciones o manejadores.

Las tarjetas utilizan clases de composición como `@container/player` y `[grid-area:name]`. Son candidatos de detección, no un contrato estable de Sokker. En la zona del nombre también aparecen enlaces de país antes del enlace del jugador: seleccionar el primer `a` produciría una identidad incorrecta. Hay que validar el pathname del enlace.

### Ficha: nombre y habilidades sin la tabla antigua

En ambas variantes de ficha faltan `.table-skills` y `.l-main__inner`. El nombre principal se representa mediante spans dentro de su zona de cabecera; no se puede depender del enlace `.h5.title-block-1 a` ni de `.navbar-brand`.

Las ocho habilidades del historial siguen presentes, con etiquetas en botones y elementos separados para el nivel y la barra. Los colores de las barras varían entre las capturas; no deben usarse para identificar habilidades ni para recuperar valores históricos.

[El normalizador existente](../../src/content/i18n.ts) ya admite las etiquetas inglesas `defender` y `playmaker`, convirtiéndolas en `defending` y `playmaking`. Se puede reutilizar. El adaptador debe limitar las curvas a las ocho habilidades admitidas por el historial: la ficha también contiene forma, disciplina táctica, experiencia y trabajo en equipo.

Los botones beta ya tienen una función nativa. Conviene conservar su clic y usar anclajes acotados para hover/foco y, donde sea necesario, un control propio para fijar la gráfica. El comportamiento concreto debe comprobarse en el navegador antes de cerrar el diseño de interacción.

### Cantera: IDs recuperables con otra estructura

La cantera beta no contiene `tr[id^="juniorRow"]`. Utiliza:

- `tr.table-row[data-row-id]` para el identificador juvenil.
- `td.table__cell--surname button` para el nombre.
- Un span con ID `junior-row-{id}`, que coincide con el identificador de la fila.
- Columnas `table__cell--weeksIn` y `table__cell--weeksLeft`.

Esto permite añadir un escáner beta sin confundir sus filas con las del primer equipo. Debe mantenerse la comprobación `routeTeamId === today.teamId` antes de sincronizar o habilitar la tarjeta de la cantera propia. La presencia de un ID de equipo en la URL no prueba que sea el del usuario.

### API: la base cambiaría automáticamente, su validez no está demostrada

[El cliente API](../../src/core/api.ts) construye su base con `location.origin + '/api'`. Al cargarlo en la beta intentaría consultar `https://app.sokker.org/api/...`.

Antes de reutilizarlo hay que verificar, con la sesión habitual, el estado HTTP, el tipo de contenido y los campos consumidos de `/current`, `/training?filter[week]=...`, `/player?filter[team]=...`, `/junior?filter[limit]=100` y `/junior/{id}/graph`. También hay que confirmar la identidad del equipo y la sesión en ambos dominios. Un `200` que contenga HTML de acceso no demostraría compatibilidad.

El bundle guardado permite observar rutas de páginas, pero no confirmó el contrato de estas API. No propongo fijar otro servidor ni introducir consultas entre orígenes sin esa evidencia. Los hallazgos privados de una comprobación posterior deben ir al documento local excluido de Git `docs/documentacion-talent/API-SOKKER.md`.

## Continuidad del historial

[El repositorio actual](../../src/core/repository.ts) abre `SokkerTalentTrackerDB` directamente desde el script de contenido; [el repositorio juvenil](../../src/core/juniorRepository.ts) utiliza esa misma conexión. Chrome explica que las API web de almacenamiento utilizadas desde un script de contenido acceden al almacenamiento de la página anfitriona: [Storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies).

De ese comportamiento y del código se deduce que `sokker.org` y `app.sokker.org` no comparten automáticamente esta base. El historial antiguo puede seguir guardado en el dominio anterior mientras la beta empieza con otro historial. La sincronización actual del primer equipo consulta una ventana de hasta 30 semanas; no garantiza reconstruir todo lo acumulado anteriormente.

| Alternativa | Resultado | Valoración |
| --- | --- | --- |
| Bases separadas con exportación/importación JSON | Permite trasladar una copia cuando la beta tenga el script, pero los historiales vuelven a divergir al usar ambos dominios. | Solución transitoria si se acepta la transferencia manual. |
| Repositorio común en el origen de la extensión | Ambas versiones consultan el mismo historial mediante mensajería. Requiere migración, gestión de concurrencia y actualización del popup. | Recomendada si se busca continuidad automática. |

Una migración automática debe ser repetible, conservar la base de origen hasta verificar la copia y resolver conflictos por jugador y semana. No basta con reutilizar ciegamente `restoreData`: actualmente escribe los registros completos del primer equipo por ID, mientras que los juveniles tienen una fusión específica. Deben preservarse la procedencia de los informes y las protecciones frente a escrituras juveniles pendientes. Las consultas autenticadas a Sokker pueden seguir en las páginas; centralizar persistencia no obliga a trasladar también la red.

## Ajuste propuesto

1. **Confirmar el contrato de datos beta.** Comprobar las API anteriores y recoger evidencia local de entrenamiento, informes y plantilla de otro equipo. Decidir si la primera entrega incluye historial compartido o una transferencia manual temporal.
2. **Normalizar rutas y añadir un adaptador beta.** Concentrar host, tipo de vista y parámetros; mantener el camino antiguo. Producir anclajes de nombre y habilidad para las interacciones compartidas. Usar las columnas semánticas de tabla y el normalizador existente; acotar los selectores de tarjetas y ficha.
3. **Completar ciclo SPA y almacenamiento elegido.** Actualizar identidades cuando el sitio reutilice nodos, descartar resultados de vistas abandonadas y evitar que el cooldown pierda el último renderizado. Deduplicar lecturas y consultas cuando tabla y tarjetas representen al mismo jugador. Mantener hover y foco como operaciones sobre datos locales.
4. **Verificar ambas versiones.** Añadir fixtures sintéticos pequeños con la estructura observada y pruebas de comportamiento. Después comprobar la extensión cargada en el navegador, incluyendo presentación y acciones nativas.

Los archivos principales afectados serían `manifest.json`, `src/content/observer.ts`, `src/content/ui.ts`, `src/content/juniorPage.ts` y `src/content/trainingPlayerPage.ts`. Una normalización compartida y los adaptadores pueden incorporarse en módulos nuevos. El almacenamiento común ampliaría el alcance a ambos repositorios, la sincronización, la mensajería, el popup y una nueva entrada de servicio en `vite.config.js` y el manifiesto. Las fórmulas y el renderizado Canvas se pueden conservar si se confirma el mismo contrato de datos.

## Criterios de aceptación para el futuro cambio

- La extensión responde al popup en ambos hosts y las rutas antiguas conservan su funcionamiento.
- La plantilla beta muestra resumen y curvas en tabla y tarjetas, con una identidad correcta por jugador y sin duplicar consultas por tener dos presentaciones.
- Las dos variantes de ficha permiten consultar el mismo historial sin depender del color de las barras ni bloquear acciones nativas.
- La cantera beta usa el ID juvenil correcto y conserva la restricción al equipo propio; los informes separan primer equipo y juveniles.
- Cambiar de jugador, ordenar o filtrar, reemplazar nodos, cambiar de vista y volver con el historial del navegador no deja tarjetas asociadas a otra identidad ni listeners duplicados.
- Hover/foco no consulta la API. Los cambios de semana y las sincronizaciones siguen las reglas actuales.
- El historial anterior se conserva conforme a la opción de almacenamiento acordada, incluidos informes antiguos, procedencia, exportación e importación.
- Se verifican teclado, anchuras estrechas, temas visuales y exportaciones en un navegador real. JSDOM no certifica estos puntos.

## Verificación realizada

La reproducción en memoria completó las cuatro capturas beta y los controles antiguos sin consultas de red ni escrituras de producto. Confirmó el rechazo de las rutas beta por el código actual, la ausencia de los selectores antiguos, la correspondencia de IDs entre tabla y tarjetas, las ocho habilidades principales por tarjeta y la correspondencia de IDs en la cantera.

Se ejecutó la comprobación existente:

```text
npx.cmd vitest run src/content/ui.test.ts src/content/uiTalent.test.ts src/content/juniorPage.test.ts src/content/trainingPlayerPage.test.ts src/content/trainingRoutes.test.ts src/content/main.test.ts
```

Resultado: **6 archivos y 48 pruebas aprobadas**. Es una comprobación de la base actual, no evidencia de soporte beta. El primer intento no arrancó por una restricción de lectura de esbuild en el sandbox; la ejecución fuera de esa restricción terminó correctamente. Un primer diagnóstico temporal también necesitó corregir la limpieza de temporizadores de JSDOM antes de la ejecución final satisfactoria.

No se ejecutaron build ni comprobación de tipos porque no se modificó código de aplicación. La verificación de esta entrega documental incluye inspección directa y comprobación del diff. Permanecen pendientes la API autenticada, las vistas sin captura y la validación visual y de navegación en un navegador real.
