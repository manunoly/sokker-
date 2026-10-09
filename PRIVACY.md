# Sokker++ Privacy Policy

**English** · [Español](PRIVACY.es.md)

## Effective date

October 9, 2026

## What data the extension accesses

Sokker++ accesses and stores the Sokker game data needed to show skill changes and player history:

- Team ID and the current week, season, season-week, day, and date.
- Player IDs and player names (fictional in-game players).
- Player skill values, player value, and in-game injury information of those players (including injury days remaining when supplied).
- Weekly training report fields: kind, trained skill, position, intensity, and minutes.
- The week/date associated with each saved player history entry.

## How it is accessed

On `https://sokker.org` pages, Sokker++ makes same-origin requests to `https://sokker.org/api/current`, `https://sokker.org/api/training?filter[week]=N`, and `https://sokker.org/api/player?filter[team]=ID` using the user's existing Sokker session. It does not request or store the user's login credentials.

## Where it is stored

The extension stores player history and sync metadata only in the browser's IndexedDB database named `SokkerTalentTrackerDB` on the user's device. Because the database is created by the extension's content script, the browser keeps it in the site storage of `https://sokker.org`. It does not maintain a developer-operated server or cloud copy.

## Sharing

Sokker++ does not send this data to the developer or any third party. Data is not sold, used for advertising, or used to assess creditworthiness or lending eligibility.

## Automatic sync disclosure

Synchronization starts automatically when a Sokker.org page loads. The extension requests current Sokker data and saves the returned history locally. You can also start a sync from the extension popup.

## User controls & retention

The popup provides Sync now, Repair history, Export JSON backup, Import JSON backup, and Clear all data controls. Data remains in the browser's local IndexedDB until you delete it. Use **Clear all data** in the popup before uninstalling, or clear the site data for `sokker.org` in your browser settings; uninstalling the extension alone does not delete this database.

## Limited Use

The use of information received by this extension adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Not affiliated with Sokker

Sokker++ is an unofficial fan-made extension. It is not affiliated with or endorsed by Sokker.

## Contact

For questions or privacy requests, open an issue at https://github.com/manunoly/sokker-/issues.

## Open source

Source code: https://github.com/manunoly/sokker-
