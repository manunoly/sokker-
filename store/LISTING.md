# Chrome Web Store listing and dashboard answers

## 1. Item name

```text
Sokker++
```

## 2. Summary / short description

```text
Track Sokker player skill changes, training history, and estimated talent in your browser.
```

Proposed manifest `description` (same value):

```text
Track Sokker player skill changes, training history, and estimated talent in your browser.
```

## 3. Detailed description — English

```text
Sokker++ adds player development history to Sokker.org. On squad and player pages, skill changes are marked with up and down arrows so you can spot weekly improvements and declines.

Open a player's history tooltip to see the “General Skills ++” view: a week-by-week skills table with training columns for Kind, Pos / Skill, and Eff. It also includes a talent summary for each skill, counting qualifying advanced trainings since the last skill pop and showing an estimated talent based on the recorded history. A footer shows the saved history range. Talent is an estimate from the history available to the extension, so it may be unknown when there are not enough complete training intervals. Use the popup to sync now, repair history gaps, or export and import a JSON backup.

Sokker++ automatically syncs when a Sokker.org page loads. It uses your existing Sokker session to request game data and stores the resulting history in IndexedDB on your device. The extension does not send this data to its developer or other third parties.

Unofficial fan-made tool, not affiliated with or endorsed by Sokker.

Open source: https://github.com/manunoly/sokker-
Support: https://github.com/manunoly/sokker-/issues
```

## 4. Detailed description — Spanish

```text
Sokker++ añade un historial de desarrollo de jugadores en Sokker.org. En las páginas de plantilla y de cada jugador, marca con flechas hacia arriba y abajo los cambios de habilidades para que puedas identificar las mejoras y bajadas semanales.

Abre el tooltip del historial de un jugador para ver “General Skills ++”: una tabla semanal de habilidades con las columnas de entrenamiento Kind, Pos / Skill y Eff. También incluye un resumen de talento por habilidad, que cuenta los entrenamientos avanzados válidos desde la última subida de esa habilidad y muestra una estimación basada en el historial registrado. El pie indica el rango de semanas guardadas. Desde la ventana emergente puedes sincronizar, reparar huecos del historial y exportar o importar una copia JSON.

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

## 7. URLs

```text
Homepage URL: https://github.com/manunoly/sokker-
Support URL: https://github.com/manunoly/sokker-/issues
Privacy policy URL: https://github.com/manunoly/sokker-/blob/main/PRIVACY.md
```

## 8. Privacy practices tab

### Single purpose description

```text
Show Sokker player skill changes, training history, and estimated talent on Sokker.org using locally stored game history.
```

### Permission justification

```text
Host permission https://sokker.org/* and content script match https://sokker.org/*: the content script enhances Sokker squad/player pages and makes same-origin requests to Sokker's current, training, and player endpoints to build the user's training history. The extension has no permissions entry in its manifest.
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
Website content — Collected: Yes. It reads Sokker game data (in-game player names, skills, value, injuries and weekly training report fields) needed for the displayed history and talent estimate. Stored only locally.
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
Screenshot 01: Review weekly reports and player skill history.
Screenshot 02: Spot player skill increases and decreases.
Screenshot 03: View skill progression over time.
Screenshot 04: Inspect a player's saved skill history.
Screenshot 05: Compare tracked skills across the squad.
```

## Sources (code)

- `manifest.json:2-18` — MV3, Sokker-only host permission and content-script match; `manifest.json:20-35` — popup and store icon assets.
- `src/core/api.ts:6-18,24-32,53-58,72-78` — same-origin API endpoints, current team/week data, training and roster requests.
- `src/core/sync.ts:19-24,40-75` — sync workflow and requested weeks.
- `src/content/main.ts:7-13` — automatic sync on page load; `src/content/main.ts:19-60` — repair, backup, manual sync, and clear handlers.
- `src/core/repository.ts:9-14,112-135` — local IndexedDB name and stores; `src/core/repository.ts:177-210` — player IDs/names, skill values, value, injury, and training history saved.
- `src/core/trainingReport.ts:23-51` — kind, skill, position, intensity, and minutes extracted from training reports.
- `src/content/ui.ts:216-251` — skill comparison and rendered up/down arrows; `documentation/LOGIC_EXPLANATION.md:41-61` — arrow behavior on player and squad views.
- `src/content/tooltip.ts:420-439,471-508` — “General Skills ++” table, training columns, and history range footer.
- `src/content/tooltip.ts:817-842` and `documentation/TALENT_SUMMARY.md:1-18,22-35,64-77` — advanced training count and estimated talent summary.
- `popup/index.html:68-82` and `popup/popup.ts:37-53,57-75,78-97,99-115,118-151` — sync, repair, JSON export/import, and clear controls.
- `src/core/repository.ts:306-357` — data export, restore, and database clearing.
- `readme.md:3-13,65-69` — project purpose, features, and open source documentation.
