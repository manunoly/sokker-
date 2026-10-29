# Talento juvenil en Sokker++

[English](JUNIOR_TALENT.md) · **Español**

La tarjeta aparece al pasar el cursor o enfocar el nombre de un juvenil en el detalle de un informe de entrenamiento (`/{idioma}/app/training/reports/details/{semana}/`) o en la página de **tu propia cantera** `/juniors/teamID/{teamId}/`. Se sitúa a la izquierda del nombre en el informe y a la derecha en la cantera. La extensión verifica el ID del equipo antes de activar la tarjeta en la cantera. El hover lee IndexedDB; no solicita la gráfica a la API.

El hover espera 400 ms antes de abrir la tarjeta y se cancela al retirar el puntero, cambiar de página o reutilizar una fila. El foco de teclado y el control `+` abren la tarjeta al instante. Esta espera no añade consultas de red.

La cantera beta `/juniors/{teamId}` y el informe beta `/training/reports/details/{id}` usan el mismo coordinador de sincronización y la misma gráfica. La cantera sigue exigiendo que sea tu equipo. Las rutas se reconocen con independencia del subdominio. Se conservan las acciones nativas de los nombres beta. El [registro de verificación](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) detalla el alcance probado anteriormente.

Un control `+` con borde discreto junto al nombre abre y fija la tarjeta juvenil en las páginas clásicas y beta admitidas. La tarjeta fijada permanece abierta al retirar el cursor; se cierra con su botón visible o Escape. Los controles respetan la misma comprobación de equipo propio y las acciones nativas de los nombres.

La opción del popup **Mostrar botones + de historial**, activada por defecto, también controla estos accesos. Se guarda por instalación y perfil y se comparte entre los hosts admitidos. Ocultarlos conserva el hover y el foco existentes; la preferencia no modifica el historial ni las copias JSON.

La [galería de capturas](SCREENSHOTS.md#junior-talent-card) muestra la tarjeta y el PNG exportado.

## Datos y sincronización

En una página admitida, la extensión consulta la semana actual y el equipo en `/api/current`. Lee los IDs juveniles visibles, usa `/api/junior?filter[limit]=100` para la cantera actual, el `talent` de Sokker y `weeksLeft`, y solicita `/api/junior/{id}/graph` cuando hacen falta los niveles observados. Ejecuta hasta tres consultas de gráfica a la vez. Guarda el resultado en una tabla juvenil de `SokkerPlusPlusDB`, local a la extensión y compartida con el primer equipo entre los hosts admitidos de Sokker en el mismo perfil.

Cada entrada en una página admitida actualiza la cantera y las gráficas de los juveniles visibles, aunque ya estén guardadas en la misma semana: el entrenamiento puede cambiar los niveles antes del cambio de semana. Los repintados de esa visita reutilizan los IDs ya intentados; un ID nuevo puede añadir trabajo. Recargar o volver a entrar inicia otra comprobación. El hover sigue leyendo solo el historial local. Si la lista completa no contiene a un juvenil, registra su ausencia para esa semana; la tarjeta todavía puede mostrar el historial guardado. Si se alcanza el límite de 100 juveniles, la ausencia queda como desconocida. Al salir de la página se cancela el trabajo en cola. La copia JSON puede incluir el historial juvenil; al restaurarla no se considera vigente una antigua captura de la cantera.

El botón **Sincronizar** del popup actualiza primero los informes del primer equipo y después la cantera propia actual y sus gráficas, también desde una página admitida del primer equipo. Espera a ambos procesos e informa de los errores juveniles. Un reintento puede actualizar otra vez la misma semana. Los puntos nuevos de la API sustituyen los guardados con la misma coordenada y conservan el historial anterior; no se deducen niveles de capturas de pantalla. Si la página permanece abierta durante el entrenamiento, este botón o una recarga permiten actualizarla.

## Gráfica y estimación

Canvas dibuja únicamente los niveles observados. Las semanas consecutivas se unen con línea continua; los huecos no se conectan. El eje Y va del menor al mayor nivel observado, con un nivel de margen si todos coinciden. El eje X muestra las semanas restantes hasta salir de la cantera si se conoce `weeksLeft`, y termina en la última observación sin reservar semanas futuras vacías. Sin ese dato, muestra las semanas transcurridas desde la primera observación. La tendencia discontinua solo abarca el periodo observado.

La tarjeta separa **talento de Sokker**, obtenido de la cantera, y **talento estimado**, calculado desde la curva. La estimación ajusta una recta por mínimos cuadrados a las coordenadas semanales distintas. Con pendiente positiva, `talento estimado = 1 / pendiente`, en semanas por nivel. Exige al menos cuatro observaciones distintas. Una recta plana o descendente muestra «sin progreso medible» en vez de una cifra. Es una tendencia descriptiva, no el talento oculto de Sokker; no inventa semanas ni corrige bajadas. La tarjeta muestra como rangos las estimaciones menores de 3 o mayores de 12.

La tarjeta exporta PNG mediante el compositor Canvas compartido. El pie en inglés muestra semanas restantes, talento estimado y `by manuel.team`. Los textos de la tarjeta admiten inglés, español, polaco, portugués, italiano, alemán, rumano, turco, eslovaco y francés, con inglés de respaldo.

## Implementación

- Rutas y hover: `src/content/juniorPage.ts`, `src/content/juniorCard.ts`.
- Consultas y actualización por visita: `src/core/api.ts`, `src/core/juniorSync.ts`, `src/core/juniorRepository.ts`.
- Estimación y gráfica: `src/core/levelTrend.ts`, `src/core/juniorTalent.ts`, `src/ui-components/juniorCanvas.ts`, `src/ui-components/juniorExport.ts`.

Los ejemplos de respuestas reales de la API, cuando hagan falta, permanecen en el documento local excluido de Git `docs/documentacion-talent/API-SOKKER.md`. La [spec fechada](../docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md) explica las decisiones iniciales.
