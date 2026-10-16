# ⚽ Sokker++

[English](readme.md) · **Español**

Sokker++ es una extensión ultraligera para Google Chrome diseñada para inyectar analíticas avanzadas, seguimiento de habilidades y estimación de talento directamente en la interfaz de [Sokker.org](https://sokker.org).

El proyecto rinde homenaje a C++ en su nombre, reflejando su filosofía principal: **máximo rendimiento, control absoluto del estado y cero dependencias innecesarias.**

## 🚀 Características Principales

* **Seguimiento Histórico (Skill Tracker):** Rastrea las subidas y bajadas de habilidades de los jugadores semana a semana.
* **Inyección UI No Invasiva:** Colorea dinámicamente las celdas de la tabla de la plantilla (`/app/squad/`) en verde (subida) o rojo (bajada).
* **Gráficos Nativos:** Tooltips flotantes con gráficas de progresión dibujadas 100% con la API nativa de `<canvas>`, sin librerías externas pesadas.
* **Talento juvenil:** En los informes de entrenamiento y tu cantera, pasa el cursor sobre el nombre de un juvenil o enfócalo con el teclado para ver niveles observados, tendencia, talento de Sokker y una estimación independiente en semanas por nivel. [Uso y límites](docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md).
* **Smart Sync:** Intercepta la API nativa de Sokker para conocer la semana actual (`today.week`) y solo descarga el delta de semanas faltantes, evitando saturar los servidores del juego.
* **Progreso del primer equipo:** General Skills ++ muestra los entrenos avanzados y de formación enfocados desde la última subida observada de cada habilidad, su curva nativa y el ritmo observado en semanas por nivel cuando hay datos suficientes. La tabla semanal sigue visible; [cálculo y límites](documentation/TALENT_SUMMARY.es.md).
* **Gestor de Backups:** Base de datos local con importación y exportación JSON del historial del primer equipo y de los juveniles.

## 🛠️ Arquitectura y Filosofía Técnica

Sokker++ está construido siguiendo las mejores prácticas de **ECMAScript (ES2026+)** bajo un paradigma estrictamente **Funcional**.

**Reglas del Repositorio:**
1.  **Cero Clases (`class`):** El estado se encapsula utilizando cierres (*closures*) y módulos (*ESM*).
2.  **Cero Dependencias (Vanilla JS):** No React, no Chart.js, no librerías de estado. Todo se resuelve con APIs nativas del navegador (IndexedDB, Canvas, Fetch, MutationObserver).
3.  **Separación de Efectos (Side-Effects):** * La manipulación del DOM (`ui.ts`, `observer.ts`) está aislada.
    * Las peticiones de red (`api.ts`) son funciones puramente asíncronas.
    * La persistencia (`repository.ts`) abstrae IndexedDB sin exponer su API interna.

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
    │   ├── talent.ts          # Contadores enfocados y ritmo por habilidad
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
npx vitest run    # tests
npx tsc --noEmit  # typecheck
```

## 📚 Documentación

* [LOGIC_EXPLANATION.md](documentation/LOGIC_EXPLANATION.md): sincronización, gráficas y detección de subidas.
* [TALENT_SUMMARY.es.md](documentation/TALENT_SUMMARY.es.md): contadores enfocados, ritmo observado, tabla semanal y límites del primer equipo.
* [Diseño de talento juvenil](docs/superpowers/specs/2026-10-16-junior-talent-hover-design.md): páginas admitidas, sincronización, cálculo y límites.
* [PRIVACY.es.md](PRIVACY.es.md): política de privacidad (datos solo en tu navegador).
* [store/](store/LISTING.md): ficha y checklist de envío a la Chrome Web Store.
* Instalación: [español](documentation/INSTALL-es.md) · [English](documentation/INSTALL-en.md).
