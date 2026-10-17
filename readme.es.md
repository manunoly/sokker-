# ⚽ Sokker++

[English](readme.md) · **Español**

Sokker++ es una extensión para navegadores Chromium que añade historial de habilidades y estimaciones de talento juvenil a [Sokker.org](https://sokker.org). Es un proyecto independiente, sin afiliación con Sokker.

Usa TypeScript, API nativas del navegador y almacenamiento local en IndexedDB. Las gráficas usan Canvas sin librerías de gráficos.

## 🚀 Características Principales

* **Seguimiento Histórico (Skill Tracker):** Rastrea las subidas y bajadas de habilidades de los jugadores semana a semana.
* **Inyección UI No Invasiva:** Colorea dinámicamente las celdas de la tabla de la plantilla (`/app/squad/`) en verde (subida) o rojo (bajada).
* **Gráficos Nativos:** Tooltips flotantes con gráficas de progresión dibujadas 100% con la API nativa de `<canvas>`, sin librerías externas pesadas.
* **Talento juvenil:** En los informes de entrenamiento y tu cantera, pasa el cursor sobre el nombre de un juvenil o enfócalo con el teclado para ver niveles observados, tendencia, talento de Sokker y una estimación independiente en semanas por nivel. [Uso y límites](documentation/JUNIOR_TALENT.es.md).
* **Sincronización:** Consulta la semana actual de Sokker, actualiza la última semana guardada al cambiar de semana, obtiene informes recientes que falten y refresca el informe de la semana actual. Los juveniles solo se sincronizan en sus páginas admitidas y se reutilizan los datos de la semana.
* **Progreso del primer equipo:** General Skills ++ muestra los entrenos avanzados y de formación asignados desde la última subida observada de cada habilidad y una gráfica nativa de niveles y subidas. La tabla semanal sigue visible; [cálculo y límites](documentation/TALENT_SUMMARY.es.md).
* **Gestor de Backups:** Base de datos local con importación y exportación JSON del historial del primer equipo y de los juveniles.

## 🛠️ Arquitectura y Filosofía Técnica

El content script Manifest V3 separa el acceso a la API del mismo origen (`src/core/api.ts`), la persistencia IndexedDB (`src/core/repository.ts` y `src/core/juniorRepository.ts`), la sincronización (`src/core/sync.ts` y `src/core/juniorSync.ts`) y la integración con las páginas (`src/content/`). La compilación usa Vite; las gráficas en ejecución usan Canvas.

## 📁 Estructura del Proyecto

El código fuente está dividido para maximizar la testabilidad y la separación de responsabilidades:

```text
sokker-plus-plus/
├── manifest.json              # Configuración Manifest V3
├── popup/                     # UI de la extensión (Import/Export/Sync manual)
└── src/
    ├── content/               # Interacción con el DOM (Side Effects)
    │   ├── main.ts            # Entry point del Content Script
    │   ├── observer.ts        # MutationObserver para la SPA de Sokker
    │   ├── ui.ts              # Mutaciones visuales de la tabla
    │   ├── tooltip.ts         # Hover y foco del primer equipo
    │   ├── playerCard.ts      # Resumen, tarjeta por habilidad y tabla semanal
    │   ├── playerLocale.ts    # Ocho idiomas de la tarjeta del primer equipo
    │   ├── i18n.ts            # Normalización de habilidades entrantes
    │   ├── juniorPage.ts      # Rutas y activación en nombres juveniles
    │   ├── juniorCard.ts      # Recuadro con datos locales
    │   └── juniorLocale.ts    # Ocho idiomas y respaldo en inglés
    ├── core/                  # Lógica de Negocio y Datos
    │   ├── api.ts             # Fetchers puros hacia sokker.org/api (mismo origen)
    │   ├── repository.ts      # Wrapper funcional de IndexedDB (Closures)
    │   ├── sync.ts            # Orquestador: compara semanas y decide el fetch
    │   ├── gapDetector.ts     # Detección de semanas faltantes en la historia
    │   ├── talent.ts          # Contadores de entrenamiento por habilidad
    │   ├── playerTimeline.ts  # Semanas de informe y niveles observados
    │   ├── levelTrend.ts      # Regresión compartida
    │   ├── juniorSync.ts      # Cola juvenil y sincronización semanal
    │   ├── juniorRepository.ts # Juveniles en la misma IndexedDB
    │   ├── juniorTalent.ts    # Estimación de la curva juvenil
    │   └── trainingReport.ts  # Informe de entrenamiento por jugador
    ├── types/                 # Tipos compartidos de TypeScript
    ├── ui-components/         # Presentación Pura
    │   ├── playerSkillCanvas.ts # Gráfica del primer equipo (Canvas API)
    │   ├── playerSkillExport.ts # Adaptador PNG del primer equipo
    │   ├── chartExport.ts     # Compositor PNG compartido
    │   └── juniorCanvas.ts    # Gráfica juvenil (Canvas API)
    └── utils/                 # Utilidades
        ├── scheduleIdle.ts    # Planificación de trabajo en tiempo ocioso
        └── escapeHtml.ts      # Escapado de valores renderizados como HTML
```

## 🧑‍💻 Desarrollo

```bash
npm ci            # instalar dependencias
npm run dev       # build en modo watch
npm run build     # genera dist/ (cargar como "unpacked" en chrome://extensions)
npm run package   # genera store/sokker-plus-plus.zip desde dist/
npx vitest run    # tests
npx tsc --noEmit  # typecheck
```

`npm run package` necesita los comandos POSIX `rm` y `zip`; en Windows usa un entorno que los proporcione. Para cargar `dist/` basta con `npm run build`.

## 📚 Documentación

* [Índice de documentación](documentation/README.md): guías vigentes y registros de diseño históricos.
* [LOGIC_EXPLANATION.md](documentation/LOGIC_EXPLANATION.md): sincronización, gráficas y detección de subidas.
* [TALENT_SUMMARY.es.md](documentation/TALENT_SUMMARY.es.md): contadores, curvas observadas, tabla semanal y límites del primer equipo.
* [Talento juvenil](documentation/JUNIOR_TALENT.es.md): páginas admitidas, sincronización, cálculo y límites.
* [PRIVACY.es.md](PRIVACY.es.md): política de privacidad (datos solo en tu navegador).
* [store/](store/LISTING.md): ficha y checklist de envío a la Chrome Web Store.
* Instalación: [español](documentation/INSTALL-es.md) · [English](documentation/INSTALL-en.md).
