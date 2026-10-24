# Accesos + de historial

El propietario pidió aplicar la propuesta visual para probarla en el navegador. La compilación anterior conservaba el código anterior; esta entrega debe incluir el cambio real y mantener el histórico existente.

## Comportamiento acordado

- Un control `+` junto al nombre abre y fija el resumen del jugador o la tarjeta juvenil correspondiente. Conserva un borde discreto.
- Los controles de habilidades abren y fijan su curva. No tienen borde ni fondo en reposo; conservan un área de al menos 24 × 24 px, un hover suave y foco visible con teclado.
- Se usa el mismo criterio en páginas clásicas y beta, incluidas plantilla, ficha y los adaptadores de entrenamiento admitidos. No se alteran las acciones nativas de Sokker.
- El popup añade «Mostrar botones + de historial», activado por defecto. Al desactivarlo desaparecen los controles; los accesos actuales por hover y foco siguen funcionando.
- La preferencia se conserva por instalación/perfil y se comparte entre los hosts de Sokker mediante almacenamiento de la extensión. Los cambios se reflejan en las pestañas abiertas.
- La tarjeta juvenil fijada tiene cierre visible y admite Escape. Un cambio de ruta o identidad invalida la selección; las respuestas tardías no muestran otro juvenil.

## Límites

La preferencia se guarda separada del histórico. No se cambian API, esquemas, migraciones, copias JSON, cálculos ni datos de la cuenta. Solo se añade el permiso `storage` para la preferencia. No se añaden dependencias. Las pruebas y ejemplos utilizan datos ficticios.

La maqueta se centra en la presentación de los controles. No autoriza rediseñar las páginas nativas. La prueba final de la extensión cargada en Chrome la realiza el propietario; se distingue de las pruebas automatizadas y de un ensayo de navegador con datos sintéticos.
