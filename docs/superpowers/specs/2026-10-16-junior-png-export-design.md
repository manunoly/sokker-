# Exportación PNG de la gráfica juvenil

Estado: aprobado por el propietario el 16 de octubre de 2026. Complementa la [especificación de talento juvenil](2026-10-16-junior-talent-hover-design.md).

## Comportamiento

- Un botón discreto en el recuadro descarga la gráfica visible como PNG cuando hay al menos un punto observado. El clic usa solo datos locales y no pide datos a Sokker.
- La imagen contiene la gráfica nativa con puntos reales y tendencia. Debajo, alineado a la derecha en un pie compacto, muestra `12 weeks left · 5.2 talent` con los valores reales del juvenil y, cerca debajo en letra menor, `by manuel.team`. No incluye nombre, ID, talento nativo ni otros textos de la tarjeta. El texto de la imagen es fijo en inglés.
- `weeks left` representa `weeksLeft` de la última captura de `/api/junior`; `talent` es la estimación de la curva en semanas por nivel, redondeada a un decimal. Se conserva el criterio actual: menos de cuatro puntos o progreso no positivo no producen cifra. En ausencia de un valor se usa `—` en su lugar. Un juvenil confirmado fuera de cantera no presenta unas semanas restantes antiguas como actuales.
- El botón se traduce en los ocho idiomas existentes y recibe foco de teclado. Un módulo compartido compone y descarga PNG de cualquier dibujante Canvas nativo; el adaptador juvenil aporta `drawJuniorChart`, la estimación y el pie específico. El PNG se compone al doble de resolución y se descarga localmente con un nombre seguro basado en el ID. El gráfico del primer equipo puede usar el módulo compartido en el futuro. No se añaden bibliotecas ni permisos al manifiesto.

## Datos y compatibilidad

- Guardar `weeksLeft` junto al talento nativo en la misma captura semanal de plantilla. Aceptar `null` si la API no lo entrega. Los registros y copias anteriores sin el campo siguen siendo válidos; la restauración elige las semanas restantes de la misma captura que aporta el talento nativo.
- Para datos de la semana actual guardados antes de añadir el campo, una entrada posterior a una página juvenil puede hacer una sola recaptura de plantilla para completar `weeksLeft`. No repite las gráficas ni hace peticiones al pasar el cursor o exportar.
- Las pruebas usan datos sintéticos y cubren el formato del pie, el origen del talento, el guardado/restauración y la recaptura sin solicitudes de gráficas adicionales.
