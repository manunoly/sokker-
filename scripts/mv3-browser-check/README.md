# Archivos sintéticos para el ensayo del popup MV3

Este script prepara archivos, manifiestos y cotejos de exportaciones. No abre Chrome, controla el navegador, conecta con Sokker, lee cookies, llama API ni abre IndexedDB. Usa los fixtures y validadores reales del producto: `playerFixture`, `juniorFixture`, `snapshotFromStores`, `validateBackup`, `verifyLegacySnapshot` y `verifyRecoveryArchives`.

**Generar y cotejar archivos no demuestra que el popup haya funcionado.** El manifiesto registra `chromePopupExecution: "pending"`; el verificador distingue una entrada generada de una exportación externa y siempre limita sus conclusiones a archivos/validadores. La ejecución real de Chrome se documenta por separado.

## Generar un conjunto nuevo

Desde la raíz del worktree:

```powershell
node scripts/mv3-browser-check/run.mjs generate
```

La salida muestra las rutas absolutas. Cada ejecución crea `node_modules/.cache/sokker-mv3-check/{runId}/` exclusivamente nuevo y escribe con `flag: 'wx'`; no borra ni sobrescribe archivos. La compilación de la herramienta también ocupa un directorio nuevo `tool-{UUID}`. Todo queda bajo `node_modules/`, ya ignorado por Git.

El conjunto contiene:

| Archivo              | Contenido esperado                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legacy-small.json`  | Formato antiguo sin `formatVersion`; jugador 12345 con semanas 1000 y 1001; juvenil 42/555 con punto x=10; metadatos/semanas históricos sin equipo.                                             |
| `v2-small.json`      | Formato 2; mismo jugador con semanas 1002 y 1003, mismo juvenil y archivo íntegro válido de cinco stores, incluido un store desconocido con `undefined` y bytes.                                |
| `v2-over-64mib.json` | Formato 2; semana 1200, juvenil con x=10 y x=11, el mismo archivo íntegro y un conflicto cuyo payload generado ocupa 65 MiB más un sufijo con comillas y emoji. El JSON completo supera 64 MiB. |
| `manifest.json`      | Bytes y SHA-256 de cada archivo; inventario esperado de jugador/semanas/juvenil; huellas de cada observación, archivo íntegro y payload; estado explícito del ensayo Chrome pendiente.          |

La generación valida cada JSON con los módulos reales, vuelve a leerlo y comprueba su huella antes de emitir el manifiesto. No hay fixtures gigantes versionadas ni datos de una cuenta.

## Ensayo manual del popup en Chrome

1. Usar **un perfil de prueba vacío**, sin la sesión ni las bases del perfil habitual. No usar el perfil habitual para ninguna importación o borrado. No iniciar sesión en Sokker ni activar sincronización del navegador para este ensayo.
2. En ese perfil, cargar el `dist/` del worktree como extensión descomprimida desde `chrome://extensions` y abrir su popup. Mantener cerradas las páginas de Sokker; exportar/importar/borrar deben funcionar sin una pestaña del juego.
3. Importar `legacy-small.json`, esperar el éxito, exportar desde **Export JSON Backup** y conservar el archivo descargado con un nombre identificable. Cotejarlo con el escenario `legacy` indicado abajo.
4. Importar `v2-small.json`, esperar, volver a exportar y cotejar con `v2`. Las observaciones anteriores se conservan; no se exige que la copia completa sea idéntica al archivo importado.
5. Importar `v2-over-64mib.json` y dejar abierto el popup hasta la confirmación. Exportar de nuevo y ejecutar el escenario `all`, que exige las cinco semanas 1000, 1001, 1002, 1003 y 1200, ambos puntos juveniles, el archivo íntegro y el payload largo completo.
6. Cerrar/reabrir el popup y repetir la exportación. Para un ensayo de persistencia tras reinicialización, desactivar/reactivar únicamente esta extensión del perfil de prueba desde la UI y volver a exportar/cotejar. Registrar estas acciones como evidencia Chrome, separada de los reportes CLI.
7. Solo después de conservar una exportación verificada, ensayar **Clear All Data** con su confirmación, exclusivamente en el perfil de prueba. Inspeccionar la exportación vacía y comprobar que se puede importar de nuevo el archivo de prueba. Este generador no borra bases ni perfiles.

La conexión con Chrome y las acciones UI corresponden al operador autorizado. Estos scripts no sustituyen ni evitan esa conexión.

## Cotejar una exportación

Sustituir ambas rutas por el manifiesto de esta ejecución y el archivo que guardó Chrome:

```powershell
node scripts/mv3-browser-check/run.mjs verify --manifest "C:\ruta\al\runId\manifest.json" --export "C:\ruta\a\export-legacy.json" --scenario legacy
node scripts/mv3-browser-check/run.mjs verify --manifest "C:\ruta\al\runId\manifest.json" --export "C:\ruta\a\export-v2.json" --scenario v2
node scripts/mv3-browser-check/run.mjs verify --manifest "C:\ruta\al\runId\manifest.json" --export "C:\ruta\a\export-final.json" --scenario all
```

`large` permite cotejar el archivo grande si se importó de forma aislada. `all` exige la unión de las tres importaciones. Cada escenario exige sus observaciones y permite observaciones adicionales de los otros archivos sintéticos; rechaza identidades ajenas al conjunto.

El cotejo verifica cada observación por contenido, la coherencia de `latest`, coordenadas juveniles sin duplicados, `nativeTalent`, `nativeTalentWeek`, `weeksLeft`, `graphWeek`, `resolvedWeek` y `resolution`, archivo íntegro e inventario, y longitud/bytes/SHA-256 del payload largo. Valida criptográficamente todos los archivos de recuperación presentes, incluidos los que la importación añadió legítimamente. Por eso no compara el backup completo con el archivo de entrada. Rechaza controles de instalación en la raíz de la exportación.

Para estas tres fixtures y su unión secuencial, exige `weeksLeft = 5`, `graphWeek = 1200`, `resolvedWeek = 1200` y `resolution = "graph"`; estos valores no son una regla general para otros backups. Los puntos se cotejan como observaciones requeridas dentro de la unión, sin exigir que el array sea idéntico al de una sola entrada.

Un cotejo correcto crea un reporte **nuevo** `verify-{escenario}-{UUID}.json` junto al manifiesto. No escribe reportes de éxito ante un error ni modifica la exportación recibida. Cotejar los propios archivos generados sirve como comprobación del verificador; el reporte lo marca y no lo convierte en evidencia del popup.

`inputIsGeneratedFixture` solo indica si la ruta coincide con uno de los tres archivos del manifiesto. Un valor `false` no acredita procedencia de Chrome: una copia renombrada también es un archivo externo sin procedencia demostrada. El reporte añade `inputClassification` y mantiene `chromePopupExecution: "not-established-by-cli"` en todos los casos.

## Comprobaciones locales y límites

```powershell
npx tsc --project scripts/mv3-browser-check/tsconfig.json --noEmit
node scripts/mv3-browser-check/run.mjs --build-only
```

No requiere dependencias nuevas ni fake IndexedDB. Quedan pendientes hasta ejecutar Chrome: carga MV3 y permisos, importación/exportación real del popup, cancelación al cerrarlo, recuperación de recibos tras pérdida de respuesta, reinicios reales del worker y límites observados de los mensajes runtime. Los tamaños de archivos y un cotejo CLI no prueban por sí solos el tamaño de cada mensaje de extensión.

Este ensayo sintético no autoriza el piloto sobre datos reales. La copia independiente completa de la BD real y su restauración verificada siguen siendo requisitos previos de ese piloto.
