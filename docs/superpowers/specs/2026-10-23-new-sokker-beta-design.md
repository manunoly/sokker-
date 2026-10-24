# Compatibilidad con New Sokker y continuidad del historial

Fecha: 23 de octubre de 2026. Estado: propuesta revisada con la API canónica confirmada por el propietario y conservación íntegra del legado como requisito no negociable. El veredicto independiente y las versiones examinadas constan en el [informe Astra](../../research/2026-10-23-new-sokker-beta-astra-review.es.md). Sin código de producto implementado.

## Objetivo y decisiones del propietario

Las gráficas y datos de Sokker++ deben funcionar en las páginas antiguas y nuevas. Las nuevas deben funcionar tanto en `app.sokker.org` como en el dominio principal si Sokker las traslada allí. La versión de página se reconoce por su ruta y DOM, sin asociar «beta» con un hostname. El historial debe ser común en el mismo perfil del navegador.

El propietario aceptó la dirección propuesta: mantener ambas integraciones, conservar IndexedDB, gestionar la persistencia desde la extensión y migrar los datos existentes. Una futura mudanza de Sokker al dominio principal es un escenario que soportar, no un anuncio confirmado.

El propietario confirmó que las API no cambian y siguen en `https://sokker.org/api`; aportó como evidencia la solicitud de entrenamiento con `filter[week]`. Se conserva ese contrato. La URL de la API no se deriva del host donde se esté mostrando la página.

**Requisito no negociable: no perder ningún dato de la BD actual del propietario.** La migración no borra, actualiza, vacía ni cambia el esquema de la fuente. Antes de activar el repositorio común exige una copia completa recuperable y verificación de contenido, no solo conteos o un mensaje de éxito. La certificación de este diseño no sustituye la comprobación posterior de su implementación.

Referencia de evidencia: [evaluación de las capturas y del código](../../research/2026-10-23-new-sokker-beta-compatibility.es.md). Las guías actuales [del primer equipo](../../../documentation/TALENT_SUMMARY.es.md) y [de juveniles](../../../documentation/JUNIOR_TALENT.es.md) siguen definiendo cálculos, procedencia, interacción y exportación.

## Alcance y límites

Incluye almacenamiento común, migración, popup, rutas, navegación SPA, plantilla beta en tabla y tarjetas, fichas beta y cantera propia beta. Incluye adaptar configuración e informes de entrenamiento después de comprobar sus páginas reales; todavía no se dispone de sus capturas beta. No se declarará completa la compatibilidad de esas vistas a partir de enlaces del menú.

Se mantienen las fórmulas, las ocho curvas del primer equipo, Canvas y las exportaciones. Se conservan la ventana de 30 semanas del primer equipo y el máximo de tres solicitudes juveniles simultáneas. No se añade un servidor, una cuenta, sincronización entre dispositivos ni una biblioteca de gráficas. No se cambia automáticamente el toggle de Sokker ni se navegan las pestañas del usuario para migrar.

## Arquitectura propuesta

```text
Página antigua o nueva, en un host admitido
  ├─ Ruta + adaptador DOM → interacciones y Canvas existentes
  ├─ Sincronización en la página → cliente API → worker → https://sokker.org/api
  └─ Cliente de persistencia → mensajes → service worker → IndexedDB común
Popup ────────────────────────────────→ mensajes → mismo repositorio
```

Las API web de almacenamiento utilizadas desde scripts de contenido pertenecen al origen de la página. IndexedDB en el origen de la extensión permite compartir el repositorio entre sus contextos: [Chrome: almacenamiento](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies). Se utilizarán mensajes breves y serializables; el worker puede terminar y volver a arrancar, por lo que las decisiones persistentes no dependerán de sus variables globales: [mensajería](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [ciclo de vida](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Las consultas desde un script de contenido siguen sujetas a CORS. Para consultar la API canónica desde la beta se usará el worker, con permiso explícito para `https://sokker.org/*` y `credentials: 'include'`. No se leerán ni copiarán cookies manualmente. El broker solo admitirá las operaciones GET ya utilizadas, con parámetros validados, y nunca una URL arbitraria aportada por la página: [Chrome: solicitudes entre orígenes](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests). Se comprobará el transporte con sesión durante la implementación; eso no reabre el contrato confirmado por el propietario.

Las decisiones concretas de arquitectura siguientes son propuestas del implementador, derivadas de estos requisitos.

### 1. Hosts, rutas y adaptadores

- Cargar el script en `https://sokker.org/*` y `https://*.sokker.org/*`. La familia de hosts autoriza la integración; no decide el adaptador. No activar sincronización en vistas desconocidas por el mero hecho de pertenecer a esa familia.
- Interpretar el pathname con patrones completos, IDs enteros positivos seguros y barra final opcional. Los prefijos localizados antiguos se conservan. Query y hash no se usan como identidad del jugador.
- Mantener diferenciados los formatos antiguos (`/app/squad`, `/player/PID/{id}`, `/player/ID_player/{id}`, `/juniors/teamID/{id}`) y nuevos (`/squad`, `/squad/{teamId}`, `/player/{id}`, `/juniors/{teamId}`). Las fichas antiguas admiten también `/app/player/PID/{id}` y `/{idioma}/app/player/PID/{id}`, con la variante `ID_player` equivalente. No eliminar `/app` antes de reconocerlos.
- Para una ruta admitida, esperar una estructura compatible. La falta temporal de DOM durante una navegación no implica que la página esté vacía ni que deba ejecutarse otro adaptador sobre todo el documento.
- Un jugador puede tener varios anclajes de nombre y habilidades en la misma vista. Los datos se leen por ID y se reutilizan entre tabla y tarjetas; cada anclaje recibe un solo conjunto de interacciones.
- En fichas, obtener el ID de la ruta; en tablas, comprobar el ID estructural y el enlace correspondiente. No seleccionar el primer enlace de una tarjeta: puede ser una bandera.
- En cantera, comprobar el equipo de la ruta frente a `/current` antes de habilitar interacción o sincronización. Las filas de juveniles no se procesan como primer equipo.
- Las barras y sus colores no identifican habilidades. Se usan columnas semánticas y el normalizador de etiquetas existente. Se excluyen las copias de medición marcadas `aria-hidden`.
- Mantener hover y foco sin consultas a la API. Conservar clics, menús y botones nativos; fijar la gráfica desde un control propio cuando el botón de Sokker ya tenga una acción.

### 2. Repositorio común

El worker será el único escritor del nuevo repositorio `SokkerPlusPlusDB`, versión inicial `1`. Los repositorios actuales conservarán sus reglas de datos, pero quedarán como implementaciones usadas por el worker. Los scripts de página utilizarán un cliente tipado. La lectura del legado se implementará aparte, sin abrir ni actualizar su esquema por accidente.

El nuevo esquema contiene `players`, `juniors`, `metadata`, `weeks`, `control`, `migrationConflicts`, `legacyArchives` y `migrationStaging`. Se conservan identidades globales del primer equipo por `playerId` y juveniles por `[teamId, juniorId]`. Los marcadores de semanas y sincronización del primer equipo se acotan por `teamId`; no se atribuirán los marcadores antiguos, que carecen de ese contexto, al equipo que esté conectado en ese momento.

Cada ejecución de sincronización recibe un contexto `{ teamId, epoch }`. Toda escritura comprueba el epoch persistido dentro de su transacción. Borrar o restaurar datos cambia ese epoch, de modo que una respuesta antigua de otra pestaña no pueda repoblar el historial. La generación juvenil actual se integra con esta protección, manteniendo sus pruebas de comportamiento.

Toda mutación del conjunto activo también incrementa una revisión persistida. La publicación de una migración compara epoch y revisión con los usados al preparar su candidato; si otra pestaña escribió entretanto, recalcula sobre el estado nuevo en lugar de sustituirlo por una copia anterior.

Los mensajes tienen canal propio, operaciones enumeradas y validación en ejecución. No se envían conexiones, transacciones, funciones, `Map` ni errores nativos. El cliente reconstruye el `Map` de juveniles a partir de pares serializables. Una respuesta de éxito solo se envía tras confirmar la transacción. Los fallos de escritura no se convierten en respuestas vacías o exitosas.

Toda operación de volumen no acotado, incluidos `getAllData`, `getAllPlayers`, archivos de migración y backups en ambos sentidos, utiliza transferencia fragmentada. Se limita cada mensaje completo a **262144 bytes de JSON serializado en UTF-8**, incluido el sobre; el fragmentador reduce el texto hasta respetar ese límite. No se presupone que una Promise transporte su resultado en un único mensaje. Cada transferencia y captura pertenece a un documento/contexto, lleva inventario y huella, y solo termina con éxito tras verificar el conjunto completo. Cerrar el popup, perder la conexión o reiniciar el worker antes de publicar cancela o reinicia la transferencia sin modificar datos activos; si ya se aceptó una publicación, se consulta su recibo persistido al reconectar, sin afirmar que el cierre deshizo un commit. No se omiten archivos/conflictos para reducir tamaño. La capacidad insuficiente de memoria o cuota produce error, sin una copia truncada presentada como válida.

El popup exporta, importa y borra mediante el worker, incluso sin una pestaña Sokker abierta. Sincronizar o reparar sigue coordinándose desde una página Sokker; sus consultas se transportan por el broker del worker a la API canónica. El borrado continúa usando la confirmación existente y nunca borra la BD fuente.

### 3. Migración del legado

La fuente es `SokkerTalentTrackerDB` en cada origen donde exista. La lectura es local y de solo lectura, sin pasar por `initDB`, que puede actualizar esquemas. Antes de iniciar nuevas sincronizaciones en una página de origen se intenta inspeccionar y migrar su legado. La ausencia de BD se registra sin crear una base vacía en ese sitio.

El worker no puede leer por sí solo IndexedDB de `sokker.org`. La recuperación automática se realiza al abrir una página que permanezca en ese origen. Si la beta redirige antes de que pueda ejecutarse el script, será necesario acceder una vez a una página clásica; el usuario puede necesitar desactivar temporalmente el toggle. El popup debe explicar el paso cuando una actualización deje pendiente la inspección del dominio principal. Exportar/importar una copia previa sigue siendo una alternativa. No se afirmará que se recuperó el historial antes de completar la inspección y copia.

Protocolo obligatorio de conservación:

1. Antes del primer ensayo con la BD real del propietario, guardar una copia independiente fuera del repositorio versionado y verificar que se puede restaurar en un perfil/base de prueba aislado. No se realizan estos pasos sobre datos reales durante la preparación de este plan.
2. Obtener una captura consistente de **todos** los stores, claves y valores de la fuente, con versión y metadatos de esquema, en una transacción de solo lectura. La comprobación cubre contenido lógico y esquema accesibles por la API de IndexedDB. No limitarse a los cuatro arrays reconocidos por el exportador actual. Conservar campos desconocidos y valores opcionales mediante una codificación reversible; ante un tipo no soportado, bloquear la migración sin descartar el dato. Terminar la lectura de valores dentro de la transacción; codificar y calcular huellas después sobre la captura cerrada, sin mantener abierta una transacción mientras se esperan operaciones ajenas.
3. Guardar esa captura completa, sin normalizarla, en `legacyArchives`. Volver a leerla, decodificarla y comprobar inventario, claves y huellas de contenido por store y global. Conservarla también en el backup exportable. La vista normalizada no reemplaza esta copia íntegra.
4. Preparar la fusión en `migrationStaging`. Comprobar por lectura posterior que toda observación del origen tiene representación en el candidato, en los conflictos o en el archivo íntegro; ningún registro reconocido puede desaparecer silenciosamente por un filtro. Un error de esquema, cuota, transferencia o verificación impide activar la migración.
5. Publicar el candidato y su marcador de origen en una transacción, únicamente si siguen vigentes epoch y revisión. Hasta entonces se conserva el último conjunto activo; no se publican estados parciales. Conservar una captura previa recuperable del destino cuando este ya contenga datos.
6. En el ensayo real se recargan primero todas las pestañas para retirar los escritores de la versión anterior. Antes de dar la migración por finalizada se vuelve a comparar la fuente con la captura. Si cambió, se repite la captura/fusión; no se declara conservado un estado que ya no coincide. La fuente queda intacta como vía de retorno, sin borrado posterior automático. Un retorno posterior también conserva/exporta previamente el destino común con todas sus observaciones nuevas: la fuente antigua por sí sola no contiene lo adquirido tras la activación.

Reglas de fusión de la vista activa, adicionales a la copia íntegra:

- Conservar todas las semanas exclusivas de cada historial y recomputar `latest` desde el resultado ordenado.
- Un informe real prevalece sobre una referencia; un registro antiguo sin `source` conserva su interpretación actual de informe real. Entre referencias del mismo rango se mantiene el destino.
- Entre informes reales distintos de la misma semana, preferir una fecha válida posterior; con igualdad o fecha no comparable, mantener el destino. Conservar las variantes descartadas en `migrationConflicts`, con origen y motivo, para no perder la evidencia.
- Fusionar coordenadas juveniles distintas. Para colisiones, aplicar frescura de la gráfica; a igualdad mantener destino y conservar conflicto. Talento nativo y semanas restantes conservan sus semanas de procedencia. No reactivar capturas de cantera ni resoluciones semanales antiguas como si acabaran de verificarse.
- Conservar metadatos del legado para recuperación cuando no puedan incorporarse con significado seguro; los marcadores sin equipo no impiden futuras consultas del equipo actual.
- El conjunto final y el marcador de migración se confirman atómicamente después de verificar staging y archivo. Una interrupción permite reintentar desde la fuente sin duplicados ni marcadores falsos. Transferir una captura grande por partes no puede dejarla marcada como completa tras recibir solo algunas partes; si se pierde la transferencia se reinicia. La publicación no elimina el archivo íntegro ni la captura previa del destino.

La fuente original no se borra automáticamente en esta entrega, incluso tras una migración correcta. No se vuelve a utilizar como repositorio activo del nuevo código. La migración repetida de un origen ya confirmado no cambia el resultado.

La acción explícita «Borrar datos», tras su confirmación, elimina el historial común, los conflictos, staging y las copias de recuperación internas que contengan datos. Nunca actúa sobre la BD fuente ni sobre la copia independiente del ensayo. Conserva únicamente los marcadores mínimos de control necesarios para no importar de nuevo las BD antiguas retenidas. También bloquea migraciones automáticas de orígenes todavía no inspeccionados. Una restauración explícita posterior sí puede incorporar una copia elegida por el usuario. Ningún paso de actualización o migración invoca esta acción.

### 4. Backups y concurrencia

Aceptar los JSON actuales y exportar un formato aditivo con `formatVersion: 2`. Conservar `players`, `metadata`, `weeks` y `juniors`; los registros nuevos de semanas llevan `teamId`. Añadir `migrationConflicts`, `legacyArchives` y los metadatos históricos de recuperación cuando existan. Un archivo íntegro del legado debe poder reconstruirse en una base aislada con las mismas claves y valores. Los epochs, permisos para migrar y otros controles de esta instalación no se restauran desde una copia.

Exportar fija una captura consistente de todos los datos exportables y su `{epoch, revision}` en una transacción readonly antes de codificar o fragmentar; la transferencia no mezcla lecturas de revisiones distintas. Importar recibe el archivo por partes, comprueba integridad y valida todo el contenido antes de preparar un candidato. Un backup superior a 64 MiB debe poder recorrer ambos sentidos con mensajes individuales inferiores al límite anterior. Las pruebas usan datos generados, sin añadir archivos gigantes al repositorio.

Importar una copia antigua fusiona las semanas y conserva las reglas anteriores; no sustituye ciegamente un jugador completo ni reactiva cachés de otro equipo. Dos pestañas pueden guardar observaciones válidas concurrentemente, mediante transacciones y fusión. No se promete una única solicitud HTTP entre todas las pestañas; sí se evita duplicarla por tabla y tarjetas dentro de una vista.

**Preparación y publicación comparten un único contrato para migrar e importar.** Cada intento guarda su epoch de intención. La lectura del destino usado para fusionar y su `{epoch, revision}` es consistente. El staging conserva autoritativamente propietario, tipo, base, archivos, candidato y verificaciones; una petición del cliente no puede cambiar su base. La publicación comprueba epoch y revisión dentro de la transacción de escritura. Con igual epoch y revisión distinta, recalcula sobre el destino nuevo y vuelve a verificar. Con epoch distinto, aborta el intento antiguo sin adoptar el nuevo. Solo una importación publicada con éxito rota epoch e incrementa revisión junto a sus datos. Un fallo conserva datos y controles activos. La captura previa recuperable corresponde al destino realmente sustituido, después de cualquier rebase. Esta regla impide que un backup preparado antes de una escritura, un borrado u otra importación suprima ese cambio confirmado.

Cada publicación persiste su recibo en la misma transacción. Tras perder una respuesta o reiniciar, el cliente consulta el recibo del intento y el estado actual; no repite a ciegas una mutación incierta. El tombstone de borrado se comprueba al comenzar y al publicar migraciones. Un staging antiguo no elude esa prohibición.

Al borrar o restaurar, el worker avisa a las pestañas con el nuevo epoch para ocultar tarjetas y descartar datos cacheados. La validación transaccional sigue siendo la garantía si una pestaña no recibe el aviso. Una versión anterior de la extensión aún abierta puede escribir su BD antigua: se conservará la fuente y se indicará recargar las páginas tras actualizar; no se promete coordinar código de versiones previas.

### 5. Navegación, empaquetado y API

Cambios de ruta, sustitución o reutilización de nodos, ordenación y cambio de presentación no deben conservar identidades antiguas. El observador necesita una pasada final cuando el cooldown haya aplazado trabajo; las mutaciones que añade la extensión no deben producir un ciclo de procesamiento.

El build debe producir `content.js` autocontenido, válido como script clásico del manifiesto, y una entrada separada para el worker. Añadir una entrada al build actual sin comprobar los chunks compartidos podría dejar imports ESM en el script de contenido. No se considerará suficiente que Vite termine sin errores: se verificará también el artefacto cargado.

El origen canónico de todas las consultas sigue siendo `https://sokker.org/api`, con los endpoints y formatos actuales. Se elimina la dependencia de `location.origin`. El broker del worker valida operaciones/parámetros y transporta solo GET con la sesión existente; las colas y decisiones de sincronización permanecen en los coordinadores actuales. `AbortSignal` no viaja en mensajes: cada petición tiene ID y la cancelación se remite al worker, que conserva su `AbortController`. Cancelar solo afecta a la petición del mismo documento/contexto, identificado por `sender.documentId` y su extensión/pestaña/frame cuando existan; si falta documentId, usar la identidad de un puerto dedicado, no un hostname o requestId declarados por la página. Una cancelación anticipada impide iniciar ese requestId para ese propietario; el cliente también descarta la respuesta si su señal ya fue cancelada. Un worker reiniciado o una sesión vencida produce error visible/reintentable, nunca un roster vacío ni una semana falsamente sincronizada. Un `200` con HTML no cuenta como JSON válido. Las pruebas autenticadas deben confirmar este transporte y la cancelación, sin conservar respuestas privadas en Git.

## Verificación exigida

1. Probar los formatos nuevos en dominio principal, `app` y un subdominio sintético; probar formatos antiguos en ambos hosts. Rechazar hosts ajenos y rutas parecidas no admitidas.
2. Migrar historiales sintéticos con semanas antiguas, huecos, referencias, conflictos, juveniles, campos desconocidos y stores adicionales. Verificar restauración íntegra del archivo y copia previa del destino; reintentar y reiniciar el worker. Interrumpir transferencia, verificación y publicación antes del marcador; simular falta de cuota y escritura concurrente. La fuente debe mantener las mismas claves, valores y versión.
3. Borrar o restaurar mientras dos pestañas tienen consultas pendientes; ninguna respuesta obsoleta repuebla la BD ni se reimporta automáticamente el legado tras borrar.
4. Exportar e importar sin pestaña un backup sintético de más de 64 MiB, mediante mensajes de hasta 262144 bytes serializados; aceptar copias antiguas y conservar archivos íntegros, puntos, procedencia, conflictos y semanas con contexto seguro. Cubrir escritura durante exportación, bloques incompletos/alterados y cierre del popup. Pausar una importación después de preparar y probar escritura concurrente, otra importación, borrado y fallo de commit: comparar contenido, epoch y revisión, con rebase o aborto conforme al contrato.
5. Verificar tabla, tarjetas, ambas fichas, cantera propia/ajena e informes mixtos mediante fixtures sintéticos. Comprobar que hover/foco no llama a la API ni duplica listeners.
6. Cargar `dist/` en navegador y comprobar worker, mensajes, navegación, teclado, acciones nativas, anchuras estrechas y PNG/CSV. Simular el futuro host principal con fixtures; no hace falta esperar a una migración real de Sokker.
7. Probar que los dos hosts solicitan exactamente la misma API canónica mediante el worker, con credenciales incluidas; cubrir rechazo de URLs arbitrarias, sesión vencida, cancelación y reinicio del broker. Confirmar la sesión en un ensayo autenticado de solo lectura.
8. Ejecutar las pruebas pertinentes, después `npx vitest run`, `npx tsc --noEmit` y `npm run build`, sin debilitar checks. Antes del ensayo real, demostrar la recuperación del backup y la prohibición de escrituras a la fuente; revisar código material antes de cualquier solicitud posterior de commit o publicación.

## Dependencias todavía por comprobar

El contenido beta de configuración e informes; el comportamiento de `/squad/{teamId}` para otro equipo; la accesibilidad de una página clásica para leer el legado cuando el toggle esté activo; el ensayo autenticado del nuevo transporte. El contrato y origen de la API ya están confirmados por el propietario. El piloto con la BD real requiere copia independiente verificada y la implementación probada previamente con datos sintéticos. La revisión Astra debe emitir un veredicto sobre la preparación del diseño/plan, sin presentarlo como una certificación de datos todavía no migrados.
