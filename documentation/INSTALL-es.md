# Instalar Sokker++ desde el código fuente

[English](INSTALL-en.md) · **Español**

El ZIP incluido en `documentation/` es una compilación antigua. Para la instalación manual, usa el código actual.

1. Descarga o clona este repositorio e instala las dependencias de desarrollo con `npm ci`.
2. Ejecuta `npm run build`. Se crea `dist/` con `manifest.json` en la raíz.
3. Abre `chrome://extensions/`, `edge://extensions/` o `brave://extensions/` en el navegador correspondiente y activa **Modo de desarrollador**.
4. Elige **Cargar descomprimida** y selecciona la carpeta `dist/` que contiene `manifest.json`.
5. Entra a Sokker con tu sesión abierta. En las páginas de plantilla/jugador aparecen el historial guardado y las flechas según haya datos. Pasa el cursor o enfoca el nombre de un jugador del primer equipo para abrir General Skills ++. En el detalle de un informe de entrenamiento o en tu propia cantera, haz lo mismo con un juvenil para ver su gráfica.

Después de cambiar el código, recompila y pulsa **Recargar** en la tarjeta de la extensión del navegador. `npm run package` crea un ZIP de tienda desde `dist/`; el script actual utiliza `rm` y `zip` de POSIX, por lo que en Windows necesita un entorno que ofrezca esos comandos. Para pruebas locales basta con `npm run build` y cargar `dist/`.

El historial local se guarda en los datos del sitio `sokker.org` del navegador. Exporta una copia JSON desde el popup antes de cambiar de navegador o equipo si quieres conservar el historial acumulado. Consulta la [política de privacidad](../PRIVACY.es.md).
