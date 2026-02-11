# ⚽ Sokker++

Sokker++ es una extensión ultraligera para Google Chrome diseñada para inyectar analíticas avanzadas, seguimiento de habilidades y estimación de talento directamente en la interfaz de [Sokker.org](https://sokker.org). 

El proyecto rinde homenaje a C++ en su nombre, reflejando su filosofía principal: **máximo rendimiento, control absoluto del estado y cero dependencias innecesarias.**

## 🚀 Características Principales

* **Seguimiento Histórico (Skill Tracker):** Rastrea las subidas y bajadas de habilidades de los jugadores semana a semana.
* **Inyección UI No Invasiva:** Colorea dinámicamente las celdas de la tabla de la plantilla (`/app/squad/`) en verde (subida) o rojo (bajada).
* **Gráficos Nativos:** Tooltips flotantes con gráficas de progresión dibujadas 100% con la API nativa de `<canvas>`, sin librerías externas pesadas.
* **Smart Sync:** Intercepta la API nativa de Sokker para conocer la semana actual (`today.week`) y solo descarga el delta de semanas faltantes, evitando saturar los servidores del juego.
* **Gestor de Backups:** Base de datos local con opción de importar/exportar la historia completa en formato JSON.

## 🛠️ Arquitectura y Filosofía Técnica

Sokker++ está construido siguiendo las mejores prácticas de **ECMAScript (ES2026+)** bajo un paradigma estrictamente **Funcional**. 

**Reglas del Repositorio:**
1.  **Cero Clases (`class`):** El estado se encapsula utilizando cierres (*closures*) y módulos (*ESM*).
2.  **Cero Dependencias (Vanilla JS):** No React, no Chart.js, no librerías de estado. Todo se resuelve con APIs nativas del navegador (IndexedDB, Canvas, Fetch, MutationObserver).
3.  **Separación de Efectos (Side-Effects):** * La manipulación del DOM (`ui.js`, `observer.js`) está aislada.
    * Las peticiones de red (`api.js`) son funciones puramente asíncronas.
    * La persistencia (`repository.js`) abstrae IndexedDB sin exponer su API interna.

## 📁 Estructura del Proyecto

El código fuente está dividido para maximizar la testabilidad y la separación de responsabilidades:

```text
sokker-talent-tracker/
├── manifest.json              # Configuración Manifest V3
├── popup/                     # UI de la extensión (Import/Export/Sync manual)
└── src/
    ├── content/               # Interacción con el DOM (Side Effects)
    │   ├── main.js            # Entry point del Content Script
    │   ├── observer.js        # MutationObserver para la SPA de Sokker
    │   ├── ui.js              # Mutaciones visuales de la tabla
    │   └── tooltip.js         # Lógica de los tooltips flotantes
    ├── core/                  # Lógica de Negocio y Datos
    │   ├── api.js             # Fetchers puros hacia api.sokker.org
    │   ├── repository.js      # Wrapper funcional de IndexedDB (Closures)
    │   └── sync.js            # Orquestador: compara semanas y decide el fetch
    ├── ui-components/         # Presentación Pura
    │   └── canvas.js          # Función pura para dibujar la gráfica (Canvas API)
    └── utils/                 # Utilidades (JSON a Blob, etc.)