# Sokker++ Privacy Policy

**English** · [Español](PRIVACY.es.md)

## Effective date

October 9, 2026

Last updated: October 23, 2026.

## What data the extension accesses

Sokker++ accesses and stores the Sokker game data needed to show skill changes and player history:

- Team ID and the current week, season, season-week, day, and date.
- Player IDs and player names (fictional in-game players).
- Player skill values, player value, and in-game injury information of those players (including injury days remaining when supplied).
- Weekly training report fields: kind, trained skill, position, intensity, and minutes.
- The week/date associated with each saved player history entry.
- Junior IDs, team IDs, observed weekly levels, Sokker's junior talent value, remaining academy weeks, and the local week/resolution state used to avoid repeated requests.

## How it is accessed

On supported pages of `https://sokker.org` and its subdomains, Sokker++ sends fixed GET requests through its extension worker to `https://sokker.org/api/current`, `/api/training?filter[week]=N`, and `/api/player?filter[team]=ID` using the user's existing Sokker session. On eligible junior pages it also requests `/api/junior?filter[limit]=100` and `/api/junior/{id}/graph`. The canonical API remains on `sokker.org` even when the page is on a subdomain. The extension does not read, copy, or store login credentials or cookies manually.

## Where it is stored

The extension stores first-team and junior history and sync metadata in extension-local IndexedDB named `SokkerPlusPlusDB` on the user's device. This database is shared by supported Sokker pages in the same extension installation and browser profile. It is not shared between profiles, installations, or devices. No developer-operated server or cloud copy is maintained.

When recovering an older `SokkerTalentTrackerDB` from Sokker site storage, the extension reads and copies all stores, keys, values, and accessible schema metadata into a verified recovery archive, including fields it cannot use in charts. It retains migration conflicts and a recoverable previous destination. It does not modify or delete the source database. A JSON backup can contain both histories, complete recovery archives, and conflicts, so it should be stored and shared accordingly.

## Sharing

Sokker++ does not send this data to the developer or any third party. Data is not sold, used for advertising, or used to assess creditworthiness or lending eligibility.

## Automatic sync disclosure

First-team synchronization is attempted automatically when a Sokker.org page loads. Junior synchronization runs on training report details pages and on the user's own academy page; hovering a junior reads stored data. The extension requests Sokker data and saves the returned history locally. You can also start a first-team sync from the extension popup.

## User controls & retention

The popup provides Sync now, Repair history, Export JSON backup, Import JSON backup, and Clear all data controls. Export, import, and clear work without an open Sokker tab; sync and repair need a signed-in Sokker page. Export a backup before moving or uninstalling the extension.

**Clear all data** removes the shared history, conflicts, and internal recovery copies after confirmation. It retains only minimal control markers to prevent automatic reimport of old site databases. It does not delete the older site database or any independently saved backup. If you also want to remove the retained source, use the browser's site-data controls for the corresponding Sokker origin. An explicitly selected backup can still be imported after a clear.

## Limited Use

The use of information received by this extension adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Not affiliated with Sokker

Sokker++ is an unofficial fan-made extension. It is not affiliated with or endorsed by Sokker.

## Contact

For questions or privacy requests, open an issue at https://github.com/manunoly/sokker-/issues.

## Open source

Source code: https://github.com/manunoly/sokker-
