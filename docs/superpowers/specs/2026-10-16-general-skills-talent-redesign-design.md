# Talento y progreso del primer equipo en General Skills ++

Estado: implementación completada en la rama de trabajo y verificada con pruebas, tipos, compilación y una vista local sintética. Pendiente de validación manual con la extensión cargada en Sokker. El comportamiento juvenil conserva sus pruebas.

## Intención

El panel actual reúne una tabla histórica extensa y un bloque de talento de barras de caracteres. Es difícil distinguir qué se observó de lo que se infirió. El propietario quiere la misma claridad visual de la tarjeta juvenil, una gráfica nativa por skill y un resumen general de entrenos avanzados y de formación. Las habilidades del primer equipo tienen niveles de 0 a 18 y ritmos distintos; una cifra global que mezcla skills no debe dominar la vista.

## Datos y significado

- Leer el historial del jugador ya guardado en IndexedDB. Abrir o pasar el cursor por una skill o por el nombre no inicia consultas nuevas. Conservar la sincronización existente.
- Para cada semana con informe válido, `training.kind` distingue `individual` (avanzado) de `formation` (formación), `training.skill` identifica la habilidad asignada y `training.intensity` indica la efectividad reportada. Una semana con `skill: general` no se reparte entre habilidades concretas.
- **Avanzados de una skill:** semanas con `kind: individual`, `skill` igual a la habilidad y efectividad positiva. **Formación de una skill:** semanas con `kind: formation`, `skill` igual y efectividad positiva. Cada semana aporta como máximo una unidad al contador de su clase; la efectividad queda visible en el historial. No suponer que un entreno de formación equivale a uno avanzado.
- Otros entrenos pueden contribuir de forma indirecta al progreso de una habilidad. Los datos no cuantifican ese aporte por skill. Una subida observada se dibuja aunque el entrenamiento asignado de esa semana sea de otra skill, pero no se atribuye causalmente a él.
- Las semanas anteriores al almacenamiento de informes, los registros de arrastre y los huecos no cuentan como entrenos conocidos. No mostrar un cero que parezca confirmar ausencia de entrenamiento cuando el dato es desconocido.
- Para la curva y la tendencia, usar como puntos reales solo informes de entrenamiento (`source: training`, incluido el legado sin `source`). `carried-over` y `roster-fallback` se pueden dibujar como referencias tenues, pero no se ajustan ni se consideran subidas reales. No usar la constancia de `form` como prueba de historia falsa. Conservar la protección existente contra capturas históricas con fecha repetida que parecen copias de una sincronización posterior.
- Conservar `entry.week` como **semana del informe** en la tabla y en el CSV. Calcular por separado una **semana de observación** para la gráfica y la detección de subidas: una captura fechada de jueves o viernes queda en su semana; una de sábado a miércoles corresponde al nivel previo al siguiente entrenamiento y se ubica en la anterior, como hace la gráfica actual. Derivar el día del calendario de manera independiente de la zona horaria; si la fecha no es válida, usar la semana guardada y señalar la incertidumbre. Deduplicar por semana de observación, con prioridad al informe real y, después, a la captura más reciente. La ayuda contextual debe llamar «semana del informe» a la semana de la tabla y «semana observada» a la del eje cuando difieran.

## Tarjeta General Skills ++

- Al pasar por el nombre del jugador, mostrar una tarjeta cercana con fondo azul oscuro, bordes, espaciado y jerarquía semejantes a la tarjeta juvenil. Debe caber en la ventana, permitir cruzar el puntero desde el nombre y no tapar innecesariamente los demás nombres. El foco de teclado también permite abrirla y Escape la cierra.
- Cabecera: nombre del jugador y periodo del historial observado. Debajo, dos columnas que reproducen el orden de la ficha: izquierda Resistencia, Ritmo, Técnica y Pases; derecha Portería, Defensa, Creación y Anotación. Mostrar las ocho habilidades aunque la cifra de Portería sea cero. Resistencia participa en los contadores, pero no en una estimación de talento por su comportamiento fluctuante.
- Cada habilidad muestra solo dos cifras: grande para entrenos avanzados enfocados y pequeña para entrenos de formación enfocados. Sin las palabras «avanzados» ni «formación» en las filas. El color y tamaño distinguen ambas cifras; pasar el cursor o enfocar cada cifra con el teclado abre una explicación localizada que incluye tipo de entrenamiento, habilidad, periodo y límites de los datos. No añadir el nivel actual ni la semana de subida a la fila compacta; la ficha original ya muestra los niveles y el detalle puede ir en la ayuda contextual.
- Mostrar los contadores desde la última subida observada de cada skill, como eligió el propietario. Una subida detectada entre dos observaciones se atribuye al informe posterior, sin afirmar la semana exacta en que ocurrió. Los contadores empiezan **después** de ese informe. Si no se vio una subida o faltan informes en el tramo, mostrar `≥` delante de la cifra y explicar que es un mínimo conocido; cero no debe significar «se confirmó que no entrenó». No añadir una segunda vista de totales al resumen inicial.
- Quitar la barra `■□`, el aviso `▲?` y la cifra global `overallTalent` de la vista principal. Son fáciles de interpretar como una predicción precisa de la siguiente subida y mezclan skills con condiciones de entrenamiento diferentes.
- Mantener **visible debajo** la tabla semanal existente con `Pos / Skill`, `Eff`, `Week`, niveles y exportación CSV. Sustituir las dos columnas `⚑` y `Kind` por una sola columna localizada, «Registro», con insignias de texto más icono/color: «Avanzado», «Formación», «Sin informe» (`carried-over`) y «Solo plantilla» (`roster-fallback`). Un registro real antiguo `source: training` sin metadatos `training` se etiqueta «Informe sin detalle»: no equivale a ausencia de informe ni se cuenta como entrenamiento conocido. Una lesión indicada en un registro sin informe aparece como detalle secundario, sin atribuirle la causa de la ausencia. La tabla tiene desplazamiento propio cuando no cabe en la tarjeta. El CSV conserva sus campos y valores originales.

Refinamiento tras la primera vista y corrección del propietario: la tabla conserva una fila por informe y sus columnas originales. La tarjeta se amplía hasta aproximadamente el 80 % del ancho de la ventana cuando cabe, sin alterar la estructura del historial. Una lesión usa un icono breve con nombre accesible. Si un informe indica lesión y efectividad `0`, el registro visible muestra solo la lesión; el CSV conserva el tipo de entrenamiento original.

## Gráfica al pasar por una skill

- Sustituir el pequeño gráfico verde y el zoom gris por una tarjeta del estilo juvenil: nombre de la habilidad y nivel actual, gráfico Canvas nativo de niveles reales y tendencia discontinua, leyenda breve y datos observados accesibles en texto desplegable. No añadir Chart.js ni otras bibliotecas.
- Eje X: semanas observadas del juego, con distancia proporcional y sin rellenar huecos como observaciones. Eje Y: mínimo y máximo nivel observado de esa skill, con margen cuando la serie es plana; no forzar de 0 a 18. Marcar los aumentos detectados entre observaciones. Los registros inferidos por arrastre se distinguen de las observaciones reales.
- El número principal de la tarjeta es **ritmo observado**, en semanas por nivel, estimado por una recta de mínimos cuadrados sobre puntos reales `(semana observada, nivel)`, como en la cantera. Requiere al menos cuatro semanas reales distintas y pendiente positiva. Si hay una bajada de nivel, ajustar solo el tramo posterior a la última bajada; si ese tramo no alcanza cuatro observaciones, indicar datos insuficientes. Si la pendiente es plana o negativa, indicar progreso no medible. Dibujar la recta solo dentro del tramo ajustado, sin predicción futura. No aplicar a este primer equipo los límites de visualización juvenil de 3 y 12 semanas por nivel.
- Resistencia se muestra en la vista de dos columnas y tiene gráfica de niveles reales, pero no cifra de ritmo ni recta de tendencia: su variación no se interpreta como talento. Portería se muestra siempre; cuando es plana se usa el estado de progreso no medible.
- Ese ritmo no es la habilidad oculta «talento» de Sokker: también depende de edad, nivel, entrenadores, minutos, interrupciones y tipo de entrenamiento. Etiquetarlo así en la interfaz y mostrar cuántas semanas sustentan la estimación. No presentar el promedio actual de entrenos avanzados por subida como equivalente a semanas por nivel.
- La tarjeta muestra, aparte, ambos contadores enfocados desde la última subida con el mismo tratamiento visual de cifra grande y pequeña, y ayuda contextual para explicar cada una. Si el periodo es incompleto, `≥` delante de un contador indica un mínimo conocido. Un botón PNG usa el compositor Canvas compartido que ya emplea la cantera; el gráfico exportado conserva la escala y un pie breve en inglés del tipo `Pace · 7.5 weeks/level`, con la atribución `by manuel.team`.

## Idiomas y estructura

- Localizar los textos nuevos en los ocho idiomas ya cubiertos por la tarjeta juvenil, con inglés de respaldo. Números de la interfaz según el idioma activo; pie de PNG fijo en inglés. Distinguir visual y textualmente «avanzado», «formación», «sin informe», «solo plantilla», «subida observada» y «ritmo observado». Las dos cifras compactas tienen nombre accesible y ayuda al cursor y al foco de teclado.
- Mantener el cálculo en funciones puras, la lectura de IndexedDB separada del render y la tarjeta del primer equipo separada de la lógica juvenil. Reutilizar utilidades comunes de idioma y exportación cuando encaje, sin acoplar la semántica de ambas fuentes de datos.
- La implementación deberá actualizar `documentation/TALENT_SUMMARY.md`, su versión española y el README con la fórmula y los límites efectivamente adoptados. Los ejemplos versionados serán sintéticos.

## Comprobaciones de aceptación

1. El nombre abre un resumen de dos columnas en el orden de la ficha; cada habilidad muestra las dos cifras con ayuda al cursor y teclado, y la tabla histórica con `Registro` y `Pos / Skill` permanece visible debajo.
2. Cada skill abre su gráfica real con escala ajustada; las no fluctuantes añaden tendencia y ritmo solo cuando hay datos suficientes, en el estilo juvenil.
3. Los contadores avanzados y de formación se calculan por habilidad asignada y no convierten entrenos indirectos en datos inventados.
4. Historial corto, plano, con huecos, arrastre o informes antiguos incompletos muestra sus límites sin una cifra engañosa.
5. El gráfico y el PNG usan solo datos locales, funcionan con teclado y los ocho idiomas admitidos, y no cambian la cantera.

## Verificación antes de implementar

- Contrastar con datos sintéticos y la documentación local el ajuste jueves/viernes frente a sábado/miércoles, especialmente cuando fecha de informe y semana almacenada difieren. Nunca incluir respuestas privadas en pruebas versionadas.
- Probar la tabla combinada en los ocho idiomas y en una ventana estrecha. El texto de «Registro» debe seguir legible sin ocultar `Pos / Skill`.
