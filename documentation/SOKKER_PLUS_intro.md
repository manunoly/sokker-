# Sokker++

[English](SOKKER_PLUS_intro-en.md) · **Español**

Sokker++ añade al sitio de Sokker el historial de habilidades del primer equipo y una gráfica de talento juvenil. Es una extensión independiente hecha por fans, sin afiliación ni respaldo de Sokker.

- En las vistas de plantilla y jugador, marca las subidas y bajadas observadas de habilidades. **General Skills ++** muestra una tabla semanal, los entrenos avanzados y de formación asignados desde la última subida de cada habilidad, y una gráfica de niveles observados por habilidad. La tabla permite exportar CSV y las gráficas, PNG.
- En los detalles de informes de entrenamiento y en tu propia cantera, la tarjeta juvenil muestra la curva de niveles, la tendencia, el talento que informa Sokker y una estimación independiente. La estimación necesita al menos cuatro observaciones y no representa el talento oculto del juego.
- La extensión solicita datos a la API de Sokker con la sesión ya abierta y los guarda en IndexedDB del navegador. El primer equipo intenta sincronizar al cargar Sokker; los juveniles solo se sincronizan al entrar en las páginas admitidas. Los datos guardados pueden exportarse e importarse mediante una copia JSON. Para conservar un historial acumulado al cambiar de navegador o equipo, exporta esa copia.

Consulta [la guía del primer equipo](TALENT_SUMMARY.es.md), [la guía juvenil](JUNIOR_TALENT.es.md), [instalación](INSTALL-es.md) y [privacidad](../PRIVACY.es.md). Las capturas antiguas de esta carpeta pueden no representar la interfaz actual.

[by manuel.team](https://manuel.team)
