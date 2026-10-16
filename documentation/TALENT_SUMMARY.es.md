# Progreso de las habilidades del primer equipo en General Skills ++

[English](TALENT_SUMMARY.md) · **Español**

General Skills ++ lee el historial del primer equipo ya guardado en IndexedDB. Al pasar el cursor o enfocar el nombre se abre el resumen en dos columnas con la tabla semanal. Al pasar por una habilidad o enfocarla aparece su curva nativa en Canvas; un clic fija la tarjeta. Estas acciones no sincronizan ni consultan la API.

## Significado de las dos cifras

Las ocho habilidades siguen el orden de la ficha: Resistencia, Ritmo, Técnica y Pases a la izquierda; Portería, Defensa, Creación y Anotación a la derecha. Cada fila muestra en grande los **avanzados** y en pequeño los entrenos de **formación**. Al pasar o enfocar una cifra aparece su explicación.

- Un avanzado cuenta si el informe guardado tiene `training.kind === 'individual'`, la `training.skill` coincide con la habilidad y `training.intensity > 0`.
- Formación sigue las mismas reglas de habilidad asignada e intensidad positiva con `training.kind === 'formation'`.
- No se asigna a la habilidad un entreno `general` ni uno de otra habilidad. Una subida observada pudo recibir entrenamiento indirecto; el informe no permite cuantificarlo por habilidad.
- El contador empieza **después** del informe donde se observa la última subida de esa habilidad. Si no se ha observado ninguna subida o falta algún informe o semana en el tramo, `≥` indica un mínimo conocido. `≥0` no demuestra que el jugador no entrenó.
- Cada semana de informe suma como máximo una unidad al contador de la habilidad y clase asignadas. El porcentaje de efectividad permanece en la tabla.

## Significado de la curva

La tarjeta de cada habilidad dibuja niveles guardados sobre el eje X de semanas del juego y adapta el eje Y a su rango real (0–18). No inventa puntos en semanas ausentes. Los registros de arrastre y los procedentes solo de plantilla pueden verse como referencias tenues, pero solo los informes reales intervienen en la tendencia y en la detección de subidas.

Para cualquier habilidad salvo Resistencia, el **ritmo observado** es el inverso de la pendiente de una recta de mínimos cuadrados ajustada a `(semana observada, nivel)`. Se muestra en **semanas por nivel**. Exige al menos cuatro semanas reales distintas y una pendiente positiva. Si baja el nivel, solo se ajusta el tramo iniciado en el valor inferior. Una serie plana o descendente muestra «Sin progreso medible»; si el tramo es demasiado corto, «Datos insuficientes». La tendencia discontinua acaba en la última observación ajustada y no predice niveles futuros. Resistencia conserva su gráfica real, sin tendencia ni cifra de ritmo, porque fluctúa.

El ritmo observado **no es el talento oculto de Sokker**. Influyen edad, nivel, entrenadores, minutos, interrupciones y tipo de entrenamiento. Tampoco equivale a la antigua media de avanzados entre subidas. Ya no se muestran la cifra global, las barras de caracteres ni el marcador de próxima subida.

## Semanas, procedencia y exportación

La tabla semanal conserva una fila por informe y sus columnas originales. La tarjeta se ensancha hasta aproximadamente el 80 % de la ventana cuando hay espacio; en pantallas estrechas, la tabla conserva su desplazamiento horizontal. Una lesión aparece como icono con explicación accesible. Si el informe marca lesión y efectividad `0`, el registro muestra solo la lesión; el CSV conserva el tipo de entrenamiento original.

La tabla semanal sigue abierta bajo el resumen. El campo `Semana` de la tabla y del CSV conserva la **semana del informe** almacenada. En la curva, una captura de jueves o viernes queda en esa semana; una de sábado a miércoles se ubica en la **semana observada** anterior. El día se interpreta sin depender de la zona horaria del ordenador. Una fecha inválida usa la semana guardada, marcada con `?` en la tabla y explicada en la tarjeta y el PNG; si dos entradas caen en la misma semana observada, se prefiere el informe real y después la captura más reciente. Los ecos históricos fechados el mismo día que la captura reciente se excluyen del análisis, pero siguen visibles en la tabla. El listado desplegable de niveles identifica los valores de arrastre y plantilla como referencias.

La columna localizada **Registro** sustituye a la bandera y a `Kind`:

| Registro | Significado |
| --- | --- |
| Avanzado / Formación | Informe real con ese tipo de entrenamiento. |
| Sin informe | Valores arrastrados desde una semana anterior, sin detalle de entrenamiento conocido. |
| Solo plantilla | Captura de la plantilla actual sin informe histórico. |
| Informe sin detalle | Informe real antiguo sin metadatos `training`. |

El icono de lesión no afirma que esta haya causado la ausencia del informe. La tabla conserva `Pos / Skill`, efectividad, niveles y exportación CSV. El CSV mantiene los campos de procedencia, tipo, habilidad, posición, intensidad, minutos, semana del informe y niveles. El PNG de la habilidad reutiliza el compositor Canvas compartido, con pie inglés `Skill · N.N weeks/level` cuando hay cifra y `by manuel.team`.

Los textos nuevos admiten inglés, español, polaco, portugués, italiano, alemán, rumano y turco, con inglés de respaldo. El pie del PNG permanece en inglés.

## Código y límites

- Línea temporal: `src/core/playerTimeline.ts`.
- Contadores y ritmo: `src/core/talent.ts` y `src/core/levelTrend.ts`.
- Gráfica y PNG nativos: `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/playerSkillExport.ts` y el compositor `chartExport.ts`.
- Tarjetas, traducciones y ciclo de hover: `src/content/playerCard.ts`, `src/content/playerLocale.ts`, `src/content/tooltip.ts` y `src/content/ui.ts`.

El historial antiguo puede contener niveles sin detalle de entrenamiento. Los informes y las semanas ausentes convierten los contadores en mínimos. Una subida entre dos observaciones reales se atribuye al informe posterior solo para definir el tramo del contador; se desconoce el día exacto y su causa. Esta función no necesita capturas privadas de la API.
