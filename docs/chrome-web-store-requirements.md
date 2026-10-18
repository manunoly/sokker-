# Preparación de Sokker++ para Chrome Web Store

Revisión inicial del repositorio y de la documentación oficial de Google: 16 de octubre de 2026. Estado local actualizado el 18 de octubre para la versión 0.2.1. La configuración de la cuenta y del Developer Dashboard se comprueba al enviar. La [ficha preparada](../store/LISTING.md) y el [checklist de envío](../store/SUBMISSION_CHECKLIST.md) contienen los textos y pasos actuales.

## Estado del repositorio

- `manifest.json` declara Manifest V3, versión `0.2.1`, `https://sokker.org/*` para el content script y el host, popup e iconos; no declara permisos generales adicionales. Incluye descripciones breves en inglés y español mediante `_locales/`.
- [PRIVACY.md](../PRIVACY.md) y [PRIVACY.es.md](../PRIVACY.es.md) documentan el historial del primer equipo y juvenil, la sincronización automática y el almacenamiento local.
- `store/chrome-web-store-assets/` contiene las capturas y mosaicos de la ficha actual, aprobados para publicación por el propietario.
- `npm run build` genera `dist/`; `npm run package` construye el único ZIP de distribución en `documentation/sokker-plus-plus.zip` desde allí en un entorno con comandos POSIX `rm` y `zip`. Las guías de instalación enlazan ese mismo archivo.
- La ficha de tienda debe describir las **dos** funciones actuales: historial y curvas de habilidades del primer equipo, y talento juvenil en las páginas admitidas. Ya no se muestra una estimación de talento por habilidad del primer equipo.

## Comprobaciones antes de publicar

1. Probar la extensión cargando `dist/` como descomprimida. Confirmar el contenido y la versión de `manifest.json` en el ZIP nuevo; Google exige el manifiesto en la raíz del archivo. [Preparar la extensión](https://developer.chrome.com/docs/webstore/prepare).
2. Sustituir capturas desfasadas por imágenes de la UI actual. Google documenta al menos una captura de 1280×800 o 640×400, un icono de 128×128 y una imagen promocional pequeña de 440×280. [Imágenes para la tienda](https://developer.chrome.com/docs/webstore/images).
3. Comprobar que propósito único, alcance del host, datos recogidos, uso de API y política de privacidad coinciden entre código, [ficha](../store/LISTING.md) y Dashboard. Declarar correctamente los datos juveniles y la sincronización en páginas admitidas. [Campos de privacidad](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/).
4. Revisar en el Dashboard las opciones actuales de idioma, categoría, distribución, contacto y certificaciones. Los textos del repositorio son borradores para pegar allí; su presencia no demuestra que se haya completado o aprobado un envío.
5. Confirmar con el propietario cualquier autorización externa necesaria para distribuir una herramienta que consulta la API de Sokker. El permiso del navegador no sustituye las condiciones del juego.

La investigación fechada del 9 de octubre contenía una tabla de faltantes que ya no representa el repositorio: desde entonces se añadieron la política de privacidad, la ficha, las imágenes y se redujo el host a `https://sokker.org/*`. Mantener el [checklist](../store/SUBMISSION_CHECKLIST.md) como registro operativo del envío.
