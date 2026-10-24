# Verificación de almacenamiento con IndexedDB nativo

Este harness ejecuta los módulos reales `StorageService`, `PublicationService`, `TransferService`, `storageDatabase`, `storageRecovery`, `legacyStorage`, `legacyCodec` y `transferProtocol` en el navegador. Usa datos sintéticos y el IndexedDB nativo del origen HTTP local, sin `fake-indexeddb` y sin dependencias nuevas.

## Ejecutar

Desde la raíz del worktree:

```powershell
node scripts/storage-browser-check/server.mjs
```

Abrir `http://127.0.0.1:4175/` en el navegador integrado y pulsar **Run storage checks**. El estado, cada resultado y la evidencia JSON aparecen en el DOM. La última comprobación de volumen genera más de 64 MiB en memoria; no se versiona ninguna fixture gigante ni se envían datos por red.

El servidor solo escucha en `127.0.0.1:4175`, verifica Host y limita los archivos servidos a su directorio compilado. El resultado del build queda en `node_modules/.cache/sokker-storage-browser-check/`, ya ignorado por Git. Puede compilarse sin dejar un servidor activo:

```powershell
node scripts/storage-browser-check/server.mjs --build-only
npx tsc --project scripts/storage-browser-check/tsconfig.json --noEmit
```

## Aislamiento y repetición

El código del navegador rechaza cualquier protocolo distinto de HTTP, puerto distinto de 4175 o hostname distinto de `127.0.0.1`/`localhost`, antes de abrir una base. Nunca debe copiarse ni ejecutarse en un origen de Sokker. `localhost` y `127.0.0.1` son orígenes distintos y mantienen inventarios independientes.

Antes de crear bases, enumera **todas** las bases del origen. Si alguna no figura en el catálogo local de propiedad de este harness, falla y no la abre, escribe ni elimina. No intenta reconocer o apropiarse de bases desconocidas por su nombre. El catálogo se guarda en localStorage antes de cada creación. Un catálogo ausente o alterado con bases existentes bloquea la ejecución; usar un origen/perfil de prueba nuevo conserva esas bases intactas.

Una segunda ejecución elimina solamente las bases sintéticas que el propio catálogo identifica, tras volver a validar el origen y cada nombre. No hay borrado general de IndexedDB. Las bases creadas son `SokkerTalentTrackerDB`, `SokkerPlusPlusDB` y nombres `SokkerRecovery-{runId}-…`, exclusivamente en este origen aislado. Si otra pestaña del harness mantiene una conexión, la limpieza se detiene con error.

Una CSP `connect-src 'none'` y un `fetch` que siempre falla bloquean solicitudes de datos. El objeto `chrome` local solo contiene los no-op necesarios para avisos de almacenamiento (`runtime.sendMessage`, `tabs.query`, `tabs.sendMessage`); no implementa brokers, cookies, sesión ni mensajería de extensión.

## Escenarios y evidencia

1. Crear la fuente con sus cuatro stores conocidos y uno desconocido con índices, claves externas, `undefined`, fecha, Map, Set, array disperso y bytes. Capturar con el lector y codec reales y guardar inventario/huellas.
2. Restaurar el archivo mediante `restoreLegacyArchive` en una base fresca y cotejar independientemente esquema, índices, claves, valores y versión con el IndexedDB nativo.
3. Preparar una migración sin confirmar la fuente y verificar que no publica datos activos. Cerrar/reabrir la conexión, reemplazar las instancias, confirmar el readback, publicar y consultar el recibo. Repetir la consulta real `migration.lookup` sin crear candidatos ni cambiar datos, controles, staging o archivos; un digest de fuente distinto devuelve `null`. Comparar la fuente antes/después.
4. Preparar una importación, guardar observaciones concurrentes y publicar con rebase. Probar dos importaciones simultáneas sobre el mismo epoch: una publica y la otra se rechaza; reintentar explícitamente la perdedora con el nuevo epoch conserva las semanas de ambas. Rechazar escrituras con un contexto anterior a la importación.
5. Ejecutar doce importaciones repetidas y rehidratar criptográficamente el destino íntegro anterior de cada una mediante `rehydrateRecoveryArchive`. Exigir cuerpos planos, un solo cuerpo inline por digest y referencias recuperables, sin duplicación recursiva; registrar los bytes antes/después y verificar todos los archivos con `verifyRecoveryArchives`.
6. Ensayar el retorno conservando una exportación íntegra del destino con observaciones posteriores a la activación, restaurando la fuente en otra base y comprobando que el destino y sus controles no se reemplazan. Abortar una escritura real con `guardedWrite` y cotejar datos/epoch/revisión.
7. Borrar los datos sintéticos con el servicio real, rechazar un contexto antiguo y bloquear la migración de un origen sintético aún no inspeccionado. Comprobar que la fuente sigue intacta y que la importación explícita permanece disponible.
8. Generar un backup de más de 64 MiB con conflicto grande y archivo íntegro válido; importarlo mediante solicitudes fragmentadas reales y publicarlo en IndexedDB nativo. Exportar mediante el servicio real, escribir una semana nueva durante la transferencia y comprobar que la exportación corresponde a la captura anterior. Cotejar digest de payload, archivo y exportación completa, inventario relevante y máximos de bytes de todos los sobres JSON UTF-8, con límite 262144 en ambos sentidos.
9. Rechazar una transferencia tras reemplazar su instancia y un frame alterado sin anunciar integridad ni cambiar los controles activos.

El transporte local cruza `JSON.stringify`/`JSON.parse` para cada solicitud/respuesta y usa el fragmentador y descargador del producto. El tamaño de un backup completo no se presenta como tamaño de un solo mensaje. La generación, importación y exportación conservan el archivo/conflicto; no se recorta contenido para conseguir un resultado verde.

## Límites

- No carga `dist/` como extensión ni prueba permisos, CORS, cookies, sesión Sokker, service worker de Chrome, puertos de extensión o entrega de avisos entre pestañas.
- Reiniciar significa reemplazar instancias de los servicios y, en la prueba de migración, cerrar/reabrir la conexión a la misma base persistida. No equivale a terminar el proceso del navegador o un worker real.
- Los importadores concurrentes son contextos lógicos que compiten sobre transacciones IndexedDB nativas en este documento; no son dos pestañas independientes.
- El ensayo de retorno conserva el destino y recupera la fuente sintética en otra base. No cambia versiones de extensión ni demuestra un retorno con los datos reales del propietario.
- No simula agotamiento físico de cuota, cierres forzados del sistema ni errores de disco. Los fallos reales de memoria/cuota se muestran como fallos; no se omite el caso grande ni se anuncia un resultado parcial como completo.
- La evidencia sintética no autoriza ni sustituye el piloto de la BD real. La copia independiente y su restauración verificada siguen siendo requisitos previos de ese piloto.
