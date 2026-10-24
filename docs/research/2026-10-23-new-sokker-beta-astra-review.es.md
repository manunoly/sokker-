# Revisión independiente Astra: diseño y plan de New Sokker

**Estado vigente — Revisión 2, 23 de octubre de 2026: APTO PARA IMPLEMENTAR a nivel documental**, exclusivamente para los hashes de diseño y plan registrados al final de este informe. R1 y R2 están resueltos en esos documentos; no quedan bloqueos documentales identificados en el alcance revisado. La implementación, sus pruebas y el piloto con datos reales siguen pendientes. Esta certificación de preparación no autoriza ejecutar el plan ni certifica una migración real. La Revisión 1 se conserva a continuación como historia y su rechazo queda superado por la Revisión 2.

Fecha: 23 de octubre de 2026. Revisión 1. Alcance: preparación para implementar; sin implementación ni acceso a datos reales.

## Veredicto

**NO APTO PARA IMPLEMENTAR en esta revisión.** La arquitectura principal es viable y las garantías de migración mejoran sustancialmente la propuesta, pero quedan dos huecos de contrato que deben cerrarse antes de ejecutar el plan: publicación concurrente de una importación y transporte de backups completos. El primero permite una implementación que pierde escrituras ya confirmadas; el segundo puede dejar una migración válida sin la exportación/importación recuperable prometida.

Este veredicto no invalida el uso de IndexedDB común, los adaptadores por ruta/DOM ni el broker canónico. Se puede resolver mediante precisiones acotadas en diseño, interfaces y pruebas. Una futura aprobación documental tampoco certificará una migración real ni autorizará implementarla.

## Documentos examinados y evidencia

Hashes SHA-256 comprobados directamente al comenzar la revisión:

| Documento | SHA-256 |
| --- | --- |
| `docs/superpowers/specs/2026-10-23-new-sokker-beta-design.md` | `C689B514F994A1450EAB41FBE8491E4EAD0AB5B4FF16EE375FE8CDDE8D9C6309` |
| `docs/superpowers/plans/2026-10-23-new-sokker-beta.md` | `E729351AFF07D7A13EBAC41B470E60F4E723CBF36AACA6D23CF1BF649EED8818` |

Las referencias de líneas siguientes corresponden exclusivamente a esas versiones. Se leyeron ambos documentos completos, las reglas de trabajo, el perfil operativo de la skill `code-review-and-quality` y las guías vigentes de primer equipo y juveniles. Se contrastaron las partes pertinentes de `src/core/api.ts`, `repository.ts`, `juniorRepository.ts`, `juniorSync.ts`, `sync.ts`, `src/content/main.ts`, `observer.ts`, `juniorPage.ts`, `trainingPlayerPage.ts`, `popup/popup.ts`, `manifest.json`, `vite.config.js` y `package.json`.

Nivel de evidencia: **Verify, acotado**, no auditoría exhaustiva del repositorio. Se recibió el descubrimiento y trazas del agente principal; esta revisión confirmó mediante MCP `index_status` el proyecto `C-Users-manue-Documents-projects-sokkerAI`, raíz `C:/Users/manue/Documents/projects/sokkerAI`, estado `ready`. `check_index_coverage` confirmó generación `2026-10-23T22:41:21Z` para los documentos y las fuentes citadas: sin incidencias registradas en esos paths, pero **todos con `freshness=metadata_changed`**. Por ello las conclusiones materiales se basan en lectura directa, no en supuesta exactitud del índice. No se hicieron búsquedas estructurales nuevas fuera de los paths proporcionados. La lista general de proyectos no se agotó; `index_status` confirmó directamente el proyecto requerido. No se afirma cobertura completa del código ni de las pruebas.

Se consultó documentación pública oficial de Chrome para comprobar origen de almacenamiento, transporte y límites de mensajería. No se abrió la cuenta, BD real, cookies ni capturas privadas, ni se hicieron solicitudes autenticadas. No se ejecutaron tests de producto: la implementación propuesta todavía no existe. Solo se escribe este informe; diseño, plan y producto permanecen a cargo del agente principal.

## Hallazgos que requieren corrección

### R1 — P1: extender la publicación protegida a las importaciones

**Referencias:** diseño, líneas 57–59 y 93–99; plan, líneas 108–112 y 116–118.

El diseño exige comparar epoch y revisión al publicar una **migración**. El plan especifica `MigrationBase`, `PreparedMigration` y esa comparación para `publishLegacyMigration`. Sin embargo, para `importBackup(data)` solo exige preparar/verificar un candidato y confirmar atómicamente el nuevo epoch y los datos. No exige comparar la revisión usada al preparar ese candidato ni define qué ocurre si un borrado u otra restauración cambia el epoch durante su preparación. Incrementar la revisión de todas las mutaciones no evita por sí solo este problema.

Escenario concreto: una importación lee el destino en revisión 10 y prepara su fusión; otra pestaña confirma una nueva semana y avanza a 11; la importación publica su candidato basado en 10 y rota el epoch. La transacción puede ser perfectamente atómica y rechazar las respuestas posteriores, pero ya habrá eliminado la semana confirmada antes del commit. La copia del legado tampoco contiene necesariamente esa semana nueva. Un borrado que ocurre mientras se prepara una importación presenta otro caso que debe tener una decisión explícita, evitando que una operación anterior se publique después usando un epoch recién obtenido.

La fuente actual refuerza la necesidad de especificarlo: `src/core/repository.ts:450–453` restaura jugadores mediante `put` completo. El plan acierta al sustituir ese comportamiento por fusión, pero al mover la preparación fuera de la transacción necesita proteger también su base de lectura.

**Corrección exigida:** aplicar un único contrato de preparación/publicación a migraciones e importaciones. Capturar destino y `{epoch, revision}` consistentemente; vincular el candidato verificado a esa base persistida; comparar ambos dentro de la transacción que publica. Ante cambio de revisión con igual epoch, recalcular sobre el destino actual y volver a verificar. Ante cambio de epoch, abortar el intento anterior con error explícito; no adoptar silenciosamente el epoch nuevo. Rotar epoch e incrementar revisión únicamente en el commit exitoso de la importación. Una publicación fallida no cambia datos ni controles activos. Incluir una copia recuperable del destino previo coherente con la versión realmente sustituida.

**Pruebas exigidas:** importación pausada después de preparar, escritura concurrente de una semana exclusiva y posterior publicación; dos importaciones simultáneas; borrado entre preparación y publicación; fallo de cuota/aborto durante el commit; reinicio antes y después del commit con respuesta perdida. Deben comprobar contenido, revisión y epoch, no solo conteos. La escritura concurrente se conserva; las operaciones con base invalidada no se publican y el fallo no rota el epoch.

### R2 — P2: hacer transportables los backups que contienen archivos íntegros

**Referencias:** diseño, líneas 61, 75 y 95; plan, líneas 74, 111–112 y 132–133.

El plan fragmenta el traslado del legado en bloques de 65536 caracteres, pero describe `exportBackup(): Promise<BackupData>` e `importBackup(data)` mediante operaciones de mensajes sin definir fragmentación equivalente. El formato nuevo incluye historial normalizado, conflictos y archivos íntegros de uno o varios orígenes. Por tanto, una captura que sí puede migrarse por fragmentos puede producir un backup que no cabe en una respuesta o solicitud monolítica. No se ha medido ni se presupone el tamaño de los datos del propietario.

Chrome documenta un máximo de **64 MiB por mensaje**, incluidas las respuestas, y serialización JSON: [Message passing, Serialization y Message size limits](https://developer.chrome.com/docs/extensions/develop/concepts/messaging). La estrategia actual del popup ya convierte el conjunto recibido a un JSON completo (`popup/popup.ts:78–95`) y envía el importado completo (`popup/popup.ts:123–150`); cambiar su destinatario al worker no resuelve el límite.

**Corrección exigida:** definir un transporte fragmentado también para exportar/importar backups, reutilizando infraestructura de transferencia cuando sea posible. Puede conservarse una fachada Promise, pero no debe implicar un único mensaje de datos. La exportación debe fijar una captura consistente antes de fragmentarla para no combinar revisiones; la importación debe verificar conjunto completo y digest antes de preparar/publicar. Vincular transferencia y captura al remitente, definir reinicio/cierre del popup y descartar transferencias incompletas sin tocar el activo. Establecer límites por mensaje en bytes serializados y comportamiento explícito ante cuotas/límites de capacidad. No reducir el backup omitiendo archivos íntegros o conflictos para hacerlo caber.

**Pruebas exigidas:** round-trip sintético cuyo backup total supere 64 MiB, con mensajes individuales bajo el límite; escritura concurrente durante la exportación; bloque faltante, duplicado contradictorio y alterado; cierre/reapertura del popup y reinicio del worker. Un backup pequeño antiguo sigue funcionando. Comprobar que exportar/importar conserva archivos, conflictos y claves/valores recuperables, y que no se emite éxito para una copia parcial.

## Precisiones recomendadas para la implementación y el piloto

Estas observaciones no añaden otros bloqueos independientes; concretan garantías ya exigidas por el diseño.

- **Staging y reinicios:** el worker debe conservar de forma autoritativa la vinculación entre `stageId`, origen, huellas, base y verificación. No aceptar una base nueva suministrada por el cliente para un candidato viejo. La publicación repetida después de perderse la respuesta debe poder consultarse mediante recibo persistido; no volver a ejecutar a ciegas una mutación incierta. Probarlo junto con los casos de reinicio ya exigidos en tarea 2.
- **Epoch frente a revisión:** un cambio de revisión admite recalcular la fusión; un cambio de epoch invalida la intención anterior. El tombstone global de borrado debe comprobarse en el worker tanto al comenzar como al publicar una migración. Tras borrar, ni staging retenido por una carrera ni un origen recién descubierto puede reactivar el legado.
- **Codec y completitud:** `encodedStores` debe incluir esquema, claves y valores, orden canónico para las huellas y distinción entre ausencia y `undefined`. Incluir tipos estructurados admitidos en fixtures y rechazar los demás explícitamente. La lectura de valores ha de terminar dentro de la transacción readonly; la codificación/hash asíncronos pueden realizarse sobre la captura cerrada. El readback verificado no sustituye una prueba de restauración en otra base. No afirmar conservación de propiedades internas de IndexedDB que el codec no pueda representar.
- **Retirada de escritores antiguos:** conservar la fuente evita destrucción, pero una segunda huella no bloquea escritores antiguos. Mantener la condición operativa de recargar todas las pestañas antes del piloto y contrastar fuente antes/después. Si hay cambios, recapturar o detenerse. No anunciar una vuelta a la fuente antigua como rollback completo de observaciones nuevas adquiridas posteriormente en el repositorio común: conservar/exportar también ese destino antes de cualquier retorno.
- **Broker y cancelación:** definir remitente con identidad de documento/contexto, no solo `sender.id` ni solo hostname. Dos pestañas de la misma extensión no deben poder cancelar peticiones entre sí. Probar IDs repetidos entre pestañas, navegación que reemplaza el documento, cancelación que llega antes de registrar el fetch y reinicio. La ausencia de controlador en memoria no autoriza guardar una respuesta que el cliente ya canceló.

## Aspectos suficientemente resueltos en el diseño

1. **Origen común y API canónica.** El worker como único escritor y el broker GET de operaciones cerradas son coherentes con Chrome: IndexedDB se comparte entre contextos de la extensión, mientras el content script usa almacenamiento del sitio; las solicitudes del worker usan permisos de host. [Storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies), [Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests). El cambio corrige la dependencia actual de `location.origin` (`src/core/api.ts:7`). La sesión real sigue siendo una verificación posterior, no un contrato alternativo por descubrir.
2. **Separación de fuente y destino.** Es correcto prohibir `initDB`, `restoreData` y `clearDatabase` como herramientas de migración del origen: el código actual abre versión 3 y puede actualizar esquema (`repository.ts:194–221`), reemplaza jugadores completos al restaurar y vacía los cuatro stores al borrar (`484–495`). El archivo íntegro más staging evita confiar en el exportador actual de solo cuatro secciones (`399–438`).
3. **Conflictos y contexto.** La unión de semanas, prioridad de informes, conservación de variantes y ausencia de atribución inventada de metadatos antiguos a un equipo están expresadas. La protección juvenil transaccional existente (`juniorRepository.ts:19–35`) proporciona una base concreta para generalizar epoch, sin confiar únicamente en notificaciones de UI.
4. **Rutas y SPA.** El plan separa la autorización del host de la elección del adaptador, conserva variantes antiguas, exige DOM compatible y cubre reutilización de nodos. También aborda el cooldown que actualmente puede descartar la última pasada (`observer.ts:43–45`). No da por observadas las páginas de entrenamiento pendientes.
5. **Artefactos MV3 y comprobaciones.** La separación del bundle clásico de contenido y el worker módulo, con inspección del artefacto cargado, responde al build multiinput actual. Los comandos finales propuestos existen o son compatibles con el tooling de `package.json`. Las pruebas con `fake-indexeddb` son útiles, pero no sustituyen la comprobación en Chrome de mensajería, límites, credenciales y reinicios.
6. **Pilotaje real condicionado.** El backup independiente restaurado en entorno aislado, la conservación de la fuente y la prohibición de pruebas de borrado sobre datos reales están explícitos en diseño y tarea 7. Deben seguir siendo requisitos de ejecución comprobables. Esta revisión no los da por realizados.

## Cierre de esta revisión

Solicito corregir R1 y R2 en ambos documentos y revalidar sus nuevos hashes antes de declarar el plan listo. Las precisiones de implementación se verificarán contra código y pruebas cuando exista autorización para implementar. La validación de transporte autenticado, las vistas beta pendientes y la restauración de la copia real pertenecen a la implementación/piloto; su ausencia hoy no es por sí sola un bloqueo de diseño.

Verificación de esta entrega documental: hashes de entrada comprobados, lectura directa de fuentes críticas, cobertura MCP contrastada y revisión del diff/archivo del informe. No se ejecutaron tests ni build, no se instalaron dependencias y no se modificaron datos del usuario.

## Revisión 2 — Revalidación y certificación documental

Fecha: 23 de octubre de 2026. **Veredicto: APTO PARA IMPLEMENTAR a nivel documental.** Se certifica la preparación del diseño y plan identificados abajo: los dos hallazgos requeridos de la Revisión 1 quedan cerrados y no se identificaron nuevos bloqueos de diseño dentro del alcance revisado. Este veredicto sustituye al rechazo inicial para estas versiones concretas, conservando aquel rechazo como registro de los problemas corregidos.

### Versiones revalidadas

| Documento | SHA-256 |
| --- | --- |
| `docs/superpowers/specs/2026-10-23-new-sokker-beta-design.md` | `0445A021CD34D7A0769E2106D882DA53C414709B872B2B737E57EBFC4FF4DEDF` |
| `docs/superpowers/plans/2026-10-23-new-sokker-beta.md` | `48A139EC2DF271C704E4DD45416FF29DB64BD17DAA8F5C69FFEC68CAD20E3CC1` |

Los hashes se comprobaron por lectura local. Se releyeron íntegramente las 130 líneas del diseño y las 201 del plan, incluyendo restricciones, interfaces, tareas, pruebas y criterios de aceptación; no se aprobó únicamente el resumen de correcciones recibido. Se reutilizó el contraste con código y documentación oficial de la Revisión 1, sin atribuir ejecución a las pruebas futuras. La revalidación MCP de ambos documentos informó generación `2026-10-23T23:20:50Z`, sin incidencia registrada y con `freshness=metadata_changed`; las conclusiones se apoyan en el texto local leído y sus hashes. Se mantiene el nivel Verify acotado y las limitaciones de cobertura de la revisión inicial.

### Cierre de hallazgos

| Hallazgo | Estado | Evidencia de cierre en las versiones revalidadas |
| --- | --- | --- |
| R1 · P1 · Importaciones concurrentes | **Cerrado documentalmente** | Diseño 99–105; plan 112–116 y 120–121: base capturada consistentemente, epoch de intención, staging autoritativo, comparación transaccional epoch/revisión, rebase y reverificación solo si cambia revisión, aborto si cambia epoch, rotación y revisión junto al commit exitoso, copia del destino realmente sustituido y recibos persistidos. Las pruebas nombran escritura entre preparación/publicación, dos importaciones, borrado, cuota/aborto, reinicios y respuesta perdida, comparando contenido y controles. |
| R2 · P2 · Backups completos transportables | **Cerrado documentalmente** | Diseño 63, 99 y 122; plan 78–83, 115–116, 122, 138 y 190: transporte común fragmentado, límite de 262144 bytes del JSON completo por solicitud/respuesta, captura consistente, validación de inventario/huella, propietario de contexto y tratamiento de cierre/reinicio. Se exige round-trip sintético superior a 64 MiB y comprobación en Chrome, sin omitir archivos/conflictos. Se aplica además a lecturas masivas y respuestas API grandes. |

La corrección de R1 cierra específicamente el caso de una semana confirmada mientras se prepara el candidato: publicar requiere rebasar y verificar contra la revisión vigente. Una importación anterior a un borrado u otra importación exitosa no puede actualizar su epoch para continuar silenciosamente. El contrato distingue este aborto de una colisión ordinaria de revisión y protege la copia del destino previo correspondiente al estado realmente sustituido.

La corrección de R2 no se limita a dividir el archivo fuente: también cubre la salida del worker y las fachadas del popup. El límite se mide después de serializar, incluidos sobre, escapes y caracteres multibyte, con pruebas explícitas. La exportación fija su captura antes de transferir; el cierre posterior a una publicación aceptada consulta el recibo sin prometer revertir un commit. Así quedan especificadas tanto la integridad como las diferencias entre transferencia incompleta y publicación incierta.

### Coherencia del conjunto y condiciones de ejecución

Las precisiones recomendadas en la Revisión 1 están incorporadas: codec sobre contenido y esquema visibles con lectura readonly terminada antes del hash (diseño 76, plan 110); staging y huellas autoritativos y tombstone en comienzo/publicación (diseño 103–105, plan 113–115); retorno que conserva las novedades del destino (diseño 80, plan 193); identidad de documento/contexto y cancelación anticipada con descarte de respuesta en el cliente (diseño 115, plan 79 y 94–98). Las interfaces y las pruebas mantienen estas obligaciones sin reabrir los contratos de API ni introducir escritura a la fuente.

El resto del plan conserva una secuencia coherente: persistencia y transporte antes de activar consumidores; migración antes de sincronización de ese origen; rutas y DOM independientes del host; separación entre primer equipo y juveniles; build clásico de contenido y worker módulo; verificación con datos sintéticos antes del piloto. Las vistas todavía no observadas siguen identificadas como pendientes, sin presentar sus fixtures futuras como evidencia real.

No quedan correcciones documentales requeridas adicionales. Siguen siendo obligatorias, cuando se autorice implementar, las pruebas asignadas de carreras, interrupciones, codec y restauración, transporte real de Chrome, artefactos MV3 y sesión del broker. Para cualquier piloto con la BD real se mantiene la condición expresa del plan 192: copia independiente completa, restauración demostrada en entorno aislado, retirada de escritores antiguos y cotejo antes/después. Esas son verificaciones futuras de implementación y ejecución; **no están realizadas ni certificadas por este informe**.

Solo se modificó este informe para añadir el veredicto vigente y conservar ambas revisiones. No se ejecutaron pruebas de producto ni build, no se accedió a datos reales ni se modificaron diseño, plan o código desde esta revisión. La comprobación final de hashes y del archivo documental no sustituye ninguna prueba de migración.
