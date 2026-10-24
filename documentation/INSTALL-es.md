# Instalar Sokker++ desde el código fuente

[English](INSTALL-en.md) · **Español**

Para instalar la compilación empaquetada, descarga [sokker-plus-plus.zip](sokker-plus-plus.zip), descomprímelo y usa **Cargar descomprimida** en el navegador para seleccionar la carpeta extraída que contiene `manifest.json`. El navegador no carga este ZIP directamente. Si prefieres compilar desde el código fuente:

1. Descarga o clona este repositorio e instala las dependencias de desarrollo con `npm ci`.
2. Ejecuta `npm run build`. Se crea `dist/` con `manifest.json` en la raíz.
3. Abre `chrome://extensions/`, `edge://extensions/` o `brave://extensions/` en el navegador correspondiente y activa **Modo de desarrollador**.
4. Elige **Cargar descomprimida** y selecciona la carpeta `dist/` que contiene `manifest.json`.
5. Entra a Sokker con tu sesión abierta. En las páginas de plantilla/jugador aparecen el historial guardado y las flechas según haya datos. Pasa el cursor o enfoca el nombre de un jugador del primer equipo para abrir General Skills ++. En el detalle de un informe de entrenamiento o en tu propia cantera, haz lo mismo con un juvenil para ver su gráfica.

Después de cambiar el código, recompila y pulsa **Recargar** en la tarjeta de la extensión del navegador. `npm run package` regenera el ZIP enlazado arriba desde `dist/`; el script actual utiliza `rm` y `zip` de POSIX, por lo que en Windows necesita un entorno que ofrezca esos comandos. Para pruebas locales basta con `npm run build` y cargar `dist/`.

El historial se comparte entre las páginas admitidas de `sokker.org` y sus subdominios en la misma instalación de la extensión y perfil del navegador. Se guarda localmente en la extensión; no se comparte con otro perfil, instalación o dispositivo. Exporta una copia JSON antes de cambiar o desinstalar. El popup permite exportar, importar y borrar el historial local sin una pestaña Sokker abierta; sincronizar y reparar requieren una página de Sokker con sesión.

Al actualizar desde la antigua base del sitio, abre una página clásica de `https://sokker.org` una vez y recarga las pestañas existentes de Sokker. La recuperación copia la base original sin borrarla. Si la beta redirige antes de inspeccionarla, el popup explica que hace falta una página clásica. Antes del primer piloto de esta compilación experimental con datos reales, conserva una copia independiente completa y demuestra su restauración en un entorno aislado. En cualquier retorno deben preservarse tanto la base original como el historial común nuevo, que puede contener observaciones posteriores.

Esta compilación desde el código añade compatibilidad beta; estas instrucciones no regeneran un ZIP empaquetado existente. Consulta la [política de privacidad](../PRIVACY.es.md) y el [registro de verificación](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) para conocer el alcance comprobado.
