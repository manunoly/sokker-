# Chrome Web Store listing and dashboard answers

## 1. Item name

```text
Sokker++
```

## 2. Summary / short description

```text
Track Sokker player skill changes, training history, and estimated talent in your browser.
```

English manifest summary (`_locales/en/messages.json`):

```text
Track Sokker player skill changes, training history, and estimated talent in your browser.
```

Spanish manifest summary (`_locales/es/messages.json`):

```text
Consulta los cambios de habilidades, el historial de entrenamientos y el talento estimado de tus jugadores de Sokker.
```

## 3. Detailed description — English

```text
Sokker++ adds player development history to Sokker.org. On squad and player pages, skill changes are marked with up and down arrows so you can spot weekly improvements and declines.

Hover or focus a first-team player's name on squad/player pages, training setup, or training report details for “General Skills ++”: direct advanced and non-direct formation training week counts since each skill's last observed rise, plus a weekly table with Record, Pos / Skill, Eff, Week, and skill levels. Hover or focus a skill value for its observed-level chart. The table exports CSV and skill charts export PNG. On training report details and your own academy page, hovering or focusing a junior name shows the observed junior curve, Sokker's talent value, and a separate curve estimate when at least four observations exist. Junior charts also export PNG. Use the popup to sync first-team data, repair history gaps, or export/import a JSON backup.

Sokker++ automatically syncs when a Sokker.org page loads. It uses your existing Sokker session to request game data and stores the resulting history in IndexedDB on your device. The extension does not send this data to its developer or other third parties.

Unofficial fan-made tool, not affiliated with or endorsed by Sokker.

Open source: https://github.com/manunoly/sokker-
Support: https://github.com/manunoly/sokker-/issues
```

## 4. Detailed description — Spanish

```text
Sokker++ añade un historial de desarrollo de jugadores en Sokker.org. En las páginas de plantilla y de cada jugador, marca con flechas hacia arriba y abajo los cambios de habilidades para que puedas identificar las mejoras y bajadas semanales.

Pasa el cursor o enfoca el nombre de un jugador del primer equipo en la plantilla, la ficha del jugador, la configuración de entrenamiento o el detalle de informes para abrir “General Skills ++”: contadores de semanas con entrenamiento avanzado directo y formación sin foco directo desde la última subida observada de cada habilidad y una tabla semanal con Registro, Pos / Skill, efectividad, semana y niveles. Al pasar o enfocar una habilidad aparece su gráfica de niveles observados. La tabla exporta CSV y las gráficas, PNG. En el detalle de informes de entrenamiento y en tu propia cantera, el nombre juvenil abre una curva, el talento informado por Sokker y una estimación independiente cuando hay al menos cuatro observaciones. La gráfica juvenil también exporta PNG. El popup permite sincronizar los datos del primer equipo, reparar huecos y exportar/importar una copia JSON.

Sokker++ sincroniza automáticamente cuando se carga una página de Sokker.org. Usa tu sesión existente de Sokker para solicitar datos del juego y guarda el historial resultante en IndexedDB en tu dispositivo. La extensión no envía estos datos a su desarrollador ni a terceros.

Herramienta no oficial hecha por fans; no está afiliada ni cuenta con el respaldo de Sokker.

Código abierto: https://github.com/manunoly/sokker-
Soporte: https://github.com/manunoly/sokker-/issues
```

## 5. Category

```text
Entertainment
```

Fallback if the Dashboard presents a different or revised list: choose `Tools` as the closest available fit. Google describes Entertainment as including extensions for fans of sports; category is selected from the Dashboard's Store Listing tab. [Official category guidance](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well)

## 6. Language

```text
Primary language: English
Additional language: Spanish
```

The 0.2.2 package includes localized extension summaries in `_locales/en/messages.json`, `_locales/es/messages.json`, `_locales/fr/messages.json`, and `_locales/sk/messages.json`. The detailed listing copy in this document is provided in English and Spanish. Select Spanish after uploading the updated package, paste section 4, and save the draft. Keep section 3 as the English description.

## 7. URLs

```text
Homepage URL: https://manuel.team/
Support URL: https://github.com/manunoly/sokker-/issues
Privacy policy URL: https://github.com/manunoly/sokker-/blob/main/PRIVACY.md
```

## 8. Privacy practices tab

### Single purpose description

```text
Show Sokker first-team skill history and junior talent charts on Sokker.org using locally stored game data.
```

### Permission justification

```text
Host permission https://sokker.org/* and content script match https://sokker.org/*: the content script enhances squad/player, training setup, training report details, and own academy pages. It makes same-origin requests to Sokker's current, training, player, junior roster, and junior graph endpoints to build local history. The extension has no permissions entry in its manifest.
```

### Remote code

```text
No, I am not using remote code. The extension does not fetch or execute remotely hosted code; its API requests retrieve Sokker game data only. The packaged Vite build is minified, not obfuscated.
```

### Data usage categories

```text
Personally identifiable information — Collected: Yes. The user's Sokker team ID (game account identifier) is read from Sokker and used locally to load the roster. Player names/IDs belong to fictional in-game players.
Health information — Collected: No. Injury fields describe fictional in-game players, not the user.
Financial and payment information — Collected: No. It does not access payment or financial data.
Authentication information — Collected: No. It uses the existing Sokker session for same-origin requests but does not read or store login credentials or session tokens.
Personal communications — Collected: No. It does not access messages or communications.
Location — Collected: No. It does not access location data.
Web browsing activity — Collected: No. It does not record browsing history, visited URLs, or browsing behavior.
User activity — Collected: No. It does not track clicks, keystrokes, or activity outside the stated Sokker feature.
Website content — Collected: Yes. It reads Sokker game data (in-game player names, skills, value, injuries, weekly training report fields, and junior roster, talent, weeks remaining, and graph points) needed for the displayed history and estimates. Stored only locally.
Other personal information — Collected: No. It does not collect other personal information beyond the categories above.
```

### Certifications

```text
Yes — I certify the extension's data practices comply with the Chrome Web Store User Data Policy and Limited Use requirements.
Yes — I certify user data is not sold or transferred for purposes unrelated to the extension's single purpose.
Yes — I certify user data is not used or transferred to determine creditworthiness or for lending purposes.
```

The Dashboard's privacy field is described in [Google's official Privacy practices documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/). The listed category names follow the user-data types in Google's [official User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/); confirm the exact visible checkboxes in the live Dashboard before submission.

## 9. Screenshot captions

```text
Screenshot 01: Review General Skills ++ and weekly first-team training history.
Screenshot 02: Inspect a junior's observed levels and separate talent estimates.
Screenshot 03: Export a junior talent chart as a PNG image.
```

## Sources (code)

- `manifest.json` — MV3, Sokker-only host scope, popup, and icons.
- `src/core/api.ts`, `src/core/sync.ts`, `src/core/juniorSync.ts` — same-origin requests and weekly synchronization.
- `src/core/repository.ts`, `src/core/juniorRepository.ts` — local IndexedDB, backup, and junior cache.
- `src/content/main.ts`, `src/content/playerCard.ts`, `src/content/juniorCard.ts`, `src/content/ui.ts` — page activation and visible UI.
- `src/core/talent.ts`, `src/core/juniorTalent.ts`, `src/ui-components/playerSkillCanvas.ts`, `src/ui-components/juniorCanvas.ts` — counts, estimates, and charts.
- `popup/popup.ts`, `documentation/TALENT_SUMMARY.md`, `documentation/JUNIOR_TALENT.md` — controls and current behavior descriptions.
