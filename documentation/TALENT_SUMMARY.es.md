# Progreso de las habilidades del primer equipo en General Skills ++

[English](TALENT_SUMMARY.md) · **Español**

General Skills ++ lee el historial del primer equipo ya guardado en IndexedDB. Al pasar el cursor o enfocar el nombre en la plantilla, la ficha del jugador, la configuración de entrenamiento o el detalle de un informe, se abre el mismo resumen en dos columnas con la tabla semanal. En los informes se conserva el hover juvenil separado para los nombres de juveniles. Al pasar por una habilidad del primer equipo o enfocarla aparece su curva nativa en Canvas; un clic fija la tarjeta. Estas acciones no sincronizan ni consultan la API.

El hover del nombre y de las habilidades espera 400 ms antes de abrir una tarjeta. Salir antes cancela la apertura, al igual que cambiar de página o reutilizar la fila para otra identidad. El foco de teclado, los controles `+` y los clics que fijan una tarjeta mantienen su apertura inmediata. Los clics nativos de Sokker se conservan.

Las páginas beta admitidas de plantilla y jugador usan el mismo historial y los mismos cálculos que las clásicas. El formato se reconoce por la ruta y estructura, también si una ruta beta se sirve desde el dominio principal. Tabla y tarjetas comparten la lectura del historial de cada jugador. En los botones de habilidades beta se conserva el clic nativo de Sokker; pasar el cursor o enfocarlos abre la gráfica de la extensión. La configuración y los informes beta tienen sus propios adaptadores de filas. El [registro de verificación](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) distingue estructuras observadas y pruebas de ejecución.

La página **Main team progress**, tanto `/training/main-team-progress` como `/{idioma}/app/training/main-team-progress/`, también ofrece hover, foco y controles `+` en el nombre para abrir el resumen, hover y foco en las ocho habilidades para ver sus gráficas y los mismos colores de cambios observados que la tabla de plantilla. Conserva los enlaces nativos al desarrollo del jugador. La configuración de entrenamiento admite tanto el HTML anterior como la tabla observada el 29 de octubre de 2026. Los IDs de fila deben coincidir con sus enlaces; se ignoran las filas ocultas o con identidades distintas. Estos adaptadores se comprobaron con las páginas guardadas localmente por el propietario; las pruebas versionadas usan datos sintéticos.

Los controles `+` se ofrecen junto al nombre del jugador tanto en las vistas clásicas como en las beta: fijan el resumen y conservan un borde discreto. Las habilidades no muestran botones `+`; pasar el cursor o enfocarlas con el teclado sigue abriendo su gráfica. Se mantienen las acciones nativas de Sokker.

El popup incluye **Mostrar botones + de historial**, activado por defecto. La preferencia se guarda por instalación y perfil de la extensión y se aplica entre los hosts admitidos, también en pestañas abiertas. Ocultar los controles conserva el hover y el foco de los nombres y habilidades. Esta opción se almacena separada del histórico y no modifica los datos ni las copias JSON.

La [galería de capturas](SCREENSHOTS.md#general-skills-summary) muestra un ejemplo del resumen y la tabla semanal.

Los indicadores de cambio de plantilla y ficha conservan el resultado del último entrenamiento completado hasta la siguiente ventana de entrenamiento, aunque Sokker ya haya cambiado de semana. Cuando `/api/current` está disponible, antes del entrenamiento (`day < 5`) se excluye la semana de informe actual, incluso si sus entradas tienen fechas válidas. Si falta esa entrada, no se descarta el último informe completado. Desde `day >= 5`, la semana actual ya puede compararse; un informe completado sin cambios elimina los indicadores anteriores. Son los valores del día del juego de Sokker, no el día local del ordenador.

Las observaciones elegibles usan la normalización por semana observada y la prioridad de fuentes de la gráfica. Las capturas repetidas de una semana se agrupan. Una referencia de arrastre o de plantilla no establece por sí sola una subida o bajada. Los huecos permiten observar un cambio neto entre informes reales, sin atribuirle una semana exacta. Las fechas inválidas usan la semana guardada del informe. Este cálculo no modifica el historial ni el CSV. Los colores se mantienen mientras un repintado o una actualización normal del historial lee el mismo jugador y habilidad. Cuando el cambio deja de corresponder, o el valor nativo se reutiliza para otro jugador o habilidad, se recupera su estilo original. Las fichas clásica y beta muestran los cambios mediante colores, sin flechas. Ambas colorean el número y el texto del nivel en verde para las subidas y en rojo para las bajadas, también en las tarjetas beta de solo texto. El texto sigue resaltado cuando se omiten los números. Las fichas beta también colorean el nombre de la habilidad; las barras conservan sus colores nativos. El resaltado se mantiene aunque Sokker actualice el color de sus textos. Las tablas de plantilla y progreso también muestran los cambios solo mediante colores; no se generan indicadores triangulares.

## Significado de las dos cifras

Las ocho habilidades siguen el orden de la ficha: Resistencia, Ritmo, Técnica y Pases a la izquierda; Portería, Defensa, Creación y Anotación a la derecha. Cada fila muestra en grande los **avanzados** y en pequeño los entrenos de **formación**. Al pasar o enfocar una cifra aparece su explicación.

- Un avanzado cuenta si el informe guardado tiene `training.kind === 'individual'`, la `training.skill` coincide con la habilidad y `training.intensity > 0`.
- Para cada una de las demás habilidades mostradas, esa semana con intensidad positiva suma formación. Por eso un informe `training.kind === 'formation'` suma formación a las ocho habilidades, incluida la asignada. Un informe `general` con intensidad positiva también suma formación a las ocho.
- Las semanas con intensidad cero o sin informe real no suman ninguno. Formación cuenta semanas sin foco directo en esa habilidad; no mide cuánto progresó indirectamente ni garantiza una subida.
- El contador empieza **después** del informe donde se observa la última subida de esa habilidad. Si no se ha observado ninguna subida o falta algún informe o semana en el tramo, `≥` indica un mínimo conocido. `≥0` no demuestra que el jugador no entrenó.
- Cada semana de informe suma como máximo una unidad por habilidad. La tabla conserva el tipo real de informe y su efectividad, que pueden diferir de la categoría del contador por habilidad.

## Significado de la curva

La tarjeta de cada habilidad dibuja todas las observaciones guardadas en una gráfica de 680 × 400 px que abarca el historial completo; en pantallas estrechas se reduce sin desplazamiento horizontal. El eje Y permanece entre 0 y 18, con una línea por nivel y números en los niveles pares. El eje X solo enumera la primera semana, la última y las semanas con subidas observadas en informes reales. Esas subidas llevan puntos verdes; los informes reales consecutivos se unen con una línea azul continua. Los tramos sin semanas intermedias y las referencias usan trazos discontinuos, sin inventar puntos. Los valores arrastrados durante una lesión aparecen en naranja y las capturas solo de plantilla en cuadrados violetas. La gráfica juvenil conserva su propia escala.

La tarjeta de habilidad y el PNG muestran niveles y subidas observados, sin línea de promedio ajustado ni estimación de semanas por nivel. Si hay un hueco, la subida se atribuye al informe real posterior; se desconoce la semana exacta del cambio dentro del hueco. Resistencia muestra sus valores guardados en la misma escala fija.

Las subidas observadas **no son el talento oculto de Sokker**. Influyen edad, nivel, entrenadores, minutos, interrupciones y tipo de entrenamiento. Ya no se muestran la cifra global, las barras de caracteres ni el marcador de próxima subida.

## Semanas, procedencia y exportación

El modal de resumen mide el 80 % del alto de la ventana.

La tabla semanal conserva una fila por informe y sus columnas originales. El modal de resumen mide como máximo 640 px de ancho, independientemente del resumen en dos columnas; la tarjeta de habilidad conserva 720 px para su gráfica. La tabla ocupa el alto disponible dentro del modal y mantiene el pie visible. En pantallas estrechas, la tabla conserva su desplazamiento horizontal. `Registro` tiene un ancho fijo y acorta los textos largos visualmente, con su texto completo al pasar el cursor. `Pos / Skill` empieza en la misma posición en todas las filas. Una lesión aparece como icono con explicación accesible. Si el informe marca lesión y efectividad `0`, el registro muestra solo la lesión; el CSV conserva el tipo de entrenamiento original.

La tabla semanal sigue abierta bajo el resumen. El campo `Semana` de la tabla y del CSV conserva la **semana del informe** almacenada. En la curva, una captura de jueves o viernes queda en esa semana; una de sábado a miércoles se ubica en la **semana observada** anterior. El día se interpreta sin depender de la zona horaria del ordenador. Una fecha inválida usa la semana guardada, marcada con `?` en la tabla y explicada en la tarjeta y el PNG; si dos entradas caen en la misma semana observada, se prefiere el informe real y después la captura más reciente. Los ecos históricos fechados el mismo día que la captura reciente se excluyen del análisis, pero siguen visibles en la tabla. El listado desplegable de niveles identifica los valores de arrastre y plantilla como referencias.

La celda de efectividad tiene fondo amarillo y texto oscuro solo en informes reales de Avanzado o Formación con efectividad estrictamente mayor del 49 % y menor del 80 %, excluyendo las filas marcadas con lesión. Los valores de 49 % o menos, 80 % o más, los desconocidos y las filas de referencia conservan el fondo normal. Una fila con lesión y efectividad cero muestra `—`; si tiene un valor positivo registrado, se conserva visible sin amarillo. Esta regla solo cambia la presentación: los datos guardados y el CSV mantienen la efectividad original.

La columna localizada **Registro** sustituye a la bandera y a `Kind`:

| Registro | Significado |
| --- | --- |
| Avanzado / Formación | Informe real con ese tipo de entrenamiento. |
| Sin informe | Valores arrastrados desde una semana anterior, sin detalle de entrenamiento conocido. |
| Solo plantilla | Captura de la plantilla actual sin informe histórico. |
| Informe sin detalle | Informe real antiguo sin metadatos `training`. |

El icono de lesión no afirma que esta haya causado la ausencia del informe. La tabla conserva `Pos / Skill`, efectividad, niveles y exportación CSV. El CSV mantiene los campos de procedencia, tipo, habilidad, posición, intensidad, minutos, semana del informe y niveles. El PNG de la habilidad reutiliza el compositor Canvas compartido, con pie inglés `Skill · weeks primera–última` y `by manuel.team`.

Los textos nuevos admiten inglés, español, polaco, portugués, italiano, alemán, rumano, turco, eslovaco y francés, con inglés de respaldo. El pie del PNG permanece en inglés.

## Código y límites

- Línea temporal: `src/core/playerTimeline.ts`.
- Contadores desde la última subida: `src/core/talent.ts`.
- Gráfica y PNG nativos: `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/playerSkillExport.ts` y el compositor `chartExport.ts`.
- Tarjetas, traducciones y ciclo de hover: `src/content/playerCard.ts`, `src/content/playerLocale.ts`, `src/content/tooltip.ts` y `src/content/ui.ts`.

El historial antiguo puede contener niveles sin detalle de entrenamiento. Los informes y las semanas ausentes convierten los contadores en mínimos. Una subida entre dos observaciones reales se atribuye al informe posterior solo para definir el tramo del contador; se desconoce el día exacto y su causa. Esta función no necesita capturas privadas de la API.
