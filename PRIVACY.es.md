# Política de privacidad de Sokker++

[English](PRIVACY.md) · **Español**

## Fecha de entrada en vigor

9 de octubre de 2026

## Datos a los que accede la extensión

Sokker++ accede y guarda los datos del juego necesarios para mostrar cambios de habilidades e historial de jugadores:

- ID del equipo y semana, temporada, semana de temporada, día y fecha actuales.
- IDs y nombres de jugadores (jugadores ficticios del juego).
- Valores de habilidades, valor del jugador e información de lesiones dentro del juego de esos jugadores (incluidos los días restantes cuando estén disponibles).
- Campos del informe semanal de entrenamiento: tipo, habilidad entrenada, posición, intensidad y minutos.
- La semana y fecha asociadas a cada entrada guardada del historial del jugador.

## Cómo se accede a los datos

En páginas de `https://sokker.org`, Sokker++ realiza solicitudes del mismo origen a `https://sokker.org/api/current`, `https://sokker.org/api/training?filter[week]=N` y `https://sokker.org/api/player?filter[team]=ID` usando la sesión existente del usuario en Sokker. No solicita ni guarda las credenciales de inicio de sesión.

## Dónde se almacenan

La extensión guarda el historial de jugadores y los metadatos de sincronización únicamente en IndexedDB del navegador, en la base `SokkerTalentTrackerDB`, en el dispositivo del usuario. Como la base la crea el content script de la extensión, el navegador la guarda en el almacenamiento del sitio `https://sokker.org`. No mantiene un servidor propio ni una copia en la nube.

## Compartición

Sokker++ no envía estos datos al desarrollador ni a terceros. No se venden, no se usan para publicidad ni para evaluar la solvencia o elegibilidad para préstamos.

## Aviso sobre la sincronización automática

La sincronización se inicia automáticamente al cargar una página de Sokker.org. La extensión solicita datos actuales de Sokker y guarda el historial localmente. También puedes iniciar una sincronización desde la ventana emergente de la extensión.

## Controles del usuario y conservación

La ventana emergente ofrece Sincronizar ahora, Reparar historial, Exportar copia JSON, Importar copia JSON y Borrar todos los datos. Los datos permanecen en IndexedDB local hasta que los borres. Usa **Borrar todos los datos** en la ventana emergente antes de desinstalar, o borra los datos del sitio `sokker.org` en la configuración del navegador; desinstalar la extensión por sí solo no elimina esta base.

## Uso limitado

El uso de la información recibida por esta extensión cumple la Política de Datos de Usuario de Chrome Web Store, incluidos los requisitos de Uso Limitado.

## Sin afiliación con Sokker

Sokker++ es una extensión no oficial hecha por fans. No está afiliada ni cuenta con el respaldo de Sokker.

## Contacto

Para preguntas o solicitudes de privacidad, abre un issue en https://github.com/manunoly/sokker-/issues.

## Código abierto

Código fuente: https://github.com/manunoly/sokker-
