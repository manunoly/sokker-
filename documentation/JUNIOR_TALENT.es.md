# Talento juvenil en Sokker++

[English](JUNIOR_TALENT.md) · **Español**

La tarjeta aparece al pasar el cursor o enfocar el nombre de un juvenil en el detalle de un informe de entrenamiento (`/{idioma}/app/training/reports/details/{semana}/`) o en la página de **tu propia cantera** `/juniors/teamID/{teamId}/`. Se sitúa a la izquierda del nombre en el informe y a la derecha en la cantera. La extensión verifica el ID del equipo antes de activar la tarjeta en la cantera. El hover lee IndexedDB; no solicita la gráfica a la API.

La [galería de capturas](SCREENSHOTS.md#junior-talent-card) muestra la tarjeta y el PNG exportado.

## Datos y sincronización semanal

En una página admitida, la extensión consulta la semana actual y el equipo en `/api/current`. Lee los IDs juveniles visibles, usa `/api/junior?filter[limit]=100` para la cantera actual, el `talent` de Sokker y `weeksLeft`, y solicita `/api/junior/{id}/graph` cuando hacen falta los niveles observados. Ejecuta hasta tres consultas de gráfica a la vez. Guarda el resultado en una tabla juvenil de la misma `SokkerTalentTrackerDB` del primer equipo.

Si un juvenil ya está resuelto en la semana actual, reutiliza su gráfica. Un ID nuevo en la página o un cambio de semana puede requerir otra consulta. Si la lista completa no contiene a un juvenil, registra su ausencia para esa semana; la tarjeta todavía puede mostrar el historial guardado. Si se alcanza el límite de 100 juveniles, la ausencia queda como desconocida. Al salir de la página se cancela el trabajo en cola. La copia JSON puede incluir el historial juvenil; al restaurarla no se considera vigente una antigua captura de la cantera.

## Gráfica y estimación

Canvas dibuja únicamente los niveles observados. Las semanas consecutivas se unen con línea continua; los huecos no se conectan. El eje Y va del menor al mayor nivel observado, con un nivel de margen si todos coinciden. El eje X muestra las semanas restantes hasta salir de la cantera si se conoce `weeksLeft`, y termina en la última observación sin reservar semanas futuras vacías. Sin ese dato, muestra las semanas transcurridas desde la primera observación. La tendencia discontinua solo abarca el periodo observado.

La tarjeta separa **talento de Sokker**, obtenido de la cantera, y **talento estimado**, calculado desde la curva. La estimación ajusta una recta por mínimos cuadrados a las coordenadas semanales distintas. Con pendiente positiva, `talento estimado = 1 / pendiente`, en semanas por nivel. Exige al menos cuatro observaciones distintas. Una recta plana o descendente muestra «sin progreso medible» en vez de una cifra. Es una tendencia descriptiva, no el talento oculto de Sokker; no inventa semanas ni corrige bajadas. La tarjeta muestra como rangos las estimaciones menores de 3 o mayores de 12.

La tarjeta exporta PNG mediante el compositor Canvas compartido. El pie en inglés muestra semanas restantes, talento estimado y `by manuel.team`. Los textos de la tarjeta admiten inglés, español, polaco, portugués, italiano, alemán, rumano, turco, eslovaco y francés, con inglés de respaldo.

## Implementación

- Rutas y hover: `src/content/juniorPage.ts`, `src/content/juniorCard.ts`.
- Consultas y caché semanal: `src/core/api.ts`, `src/core/juniorSync.ts`, `src/core/juniorRepository.ts`.
- Estimación y gráfica: `src/core/levelTrend.ts`, `src/core/juniorTalent.ts`, `src/ui-components/juniorCanvas.ts`, `src/ui-components/juniorExport.ts`.

Los ejemplos de respuestas reales de la API, cuando hagan falta, permanecen en el documento local excluido de Git `docs/documentacion-talent/API-SOKKER.md`. La [spec fechada](../docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md) explica las decisiones iniciales.
