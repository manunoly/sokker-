# Política de privacidad de Sokker++

[English](PRIVACY.md) · **Español**

## Fecha de entrada en vigor

9 de octubre de 2026

Última actualización: 23 de octubre de 2026.

## Datos a los que accede la extensión

Sokker++ accede y guarda los datos del juego necesarios para mostrar cambios de habilidades e historial de jugadores:

- ID del equipo y semana, temporada, semana de temporada, día y fecha actuales.
- IDs y nombres de jugadores (jugadores ficticios del juego).
- Valores de habilidades, valor del jugador e información de lesiones dentro del juego de esos jugadores (incluidos los días restantes cuando estén disponibles).
- Campos del informe semanal de entrenamiento: tipo, habilidad entrenada, posición, intensidad y minutos.
- La semana y fecha asociadas a cada entrada guardada del historial del jugador.
- IDs juveniles y de equipo, niveles semanales observados, talento juvenil informado por Sokker, semanas restantes en la cantera y estado local de semana y resolución que evita repetir solicitudes.

## Cómo se accede a los datos

En páginas admitidas de `https://sokker.org` y sus subdominios, Sokker++ realiza solicitudes GET fijas desde el worker de la extensión a `https://sokker.org/api/current`, `/api/training?filter[week]=N` y `/api/player?filter[team]=ID` usando la sesión existente del usuario en Sokker. En páginas juveniles admitidas también solicita `/api/junior?filter[limit]=100` y `/api/junior/{id}/graph`. La API canónica permanece en `sokker.org` aunque la página esté en un subdominio. La extensión no lee, copia ni guarda manualmente credenciales ni cookies.

## Dónde se almacenan

La extensión guarda el historial del primer equipo, el historial juvenil y los metadatos de sincronización en IndexedDB local a la extensión, en la base `SokkerPlusPlusDB`, en el dispositivo del usuario. Esta base se comparte entre las páginas admitidas de Sokker de la misma instalación de la extensión y perfil. No se comparte entre perfiles, instalaciones o dispositivos. No se mantiene un servidor propio ni una copia en la nube.

Al recuperar una antigua `SokkerTalentTrackerDB` del almacenamiento del sitio Sokker, la extensión lee y copia todos sus stores, claves, valores y metadatos accesibles del esquema en un archivo de recuperación verificado, incluidos los campos que no puede usar en las gráficas. Conserva los conflictos de migración y un destino anterior recuperable. No modifica ni borra la base fuente. Una copia JSON puede contener ambos historiales, archivos íntegros de recuperación y conflictos, y debe almacenarse y compartirse con ese cuidado.

## Compartición

Sokker++ no envía estos datos al desarrollador ni a terceros. No se venden, no se usan para publicidad ni para evaluar la solvencia o elegibilidad para préstamos.

## Aviso sobre la sincronización automática

La sincronización del primer equipo se intenta automáticamente al cargar una página de Sokker.org. La de juveniles se ejecuta en los detalles de informes de entrenamiento y en la cantera propia; el hover juvenil lee los datos guardados. La extensión solicita datos a Sokker y guarda el historial localmente. También puedes iniciar la sincronización del primer equipo desde la ventana emergente.

## Controles del usuario y conservación

La ventana emergente ofrece Sincronizar ahora, Reparar historial, Exportar copia JSON, Importar copia JSON y Borrar todos los datos. Exportar, importar y borrar funcionan sin una pestaña Sokker abierta; sincronizar y reparar necesitan una página Sokker con sesión. Exporta una copia antes de cambiar o desinstalar la extensión.

**Borrar todos los datos** elimina el historial común, los conflictos y las copias internas de recuperación tras la confirmación. Solo conserva marcadores mínimos de control para impedir la reimportación automática de las bases antiguas del sitio. No borra la base antigua ni una copia independiente guardada en un archivo. Para eliminar también la fuente conservada, utiliza los controles de datos del sitio del navegador para el origen Sokker correspondiente. Después de borrar sigue siendo posible importar explícitamente una copia elegida por el usuario.

## Uso limitado

El uso de la información recibida por esta extensión cumple la Política de Datos de Usuario de Chrome Web Store, incluidos los requisitos de Uso Limitado.

## Sin afiliación con Sokker

Sokker++ es una extensión no oficial hecha por fans. No está afiliada ni cuenta con el respaldo de Sokker.

## Contacto

Para preguntas o solicitudes de privacidad, abre un issue en https://github.com/manunoly/sokker-/issues.

## Código abierto

Código fuente: https://github.com/manunoly/sokker-
