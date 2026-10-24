# Install Sokker++ from source

**English** · [Español](INSTALL-es.md)

For a packaged installation, download [sokker-plus-plus.zip](sokker-plus-plus.zip), extract it, then use **Load unpacked** in your browser to select the extracted directory containing `manifest.json`. The browser does not load this ZIP directly. To build from source instead:

1. Download or clone this repository and install its development dependencies with `npm ci`.
2. Run `npm run build`. It creates `dist/` with `manifest.json` at its root.
3. Open `chrome://extensions/`, `edge://extensions/`, or `brave://extensions/` in the matching browser and turn on **Developer mode**.
4. Choose **Load unpacked** and select the `dist/` directory containing `manifest.json`.
5. Open Sokker while signed in. On squad/player pages, saved skill history and arrows appear as data becomes available. Hover or focus a first-team player's name for General Skills ++. On a training report details page or your own academy page, hover or focus a junior name for its chart.

After changing source code, rebuild and use **Reload** on the extension's browser card. `npm run package` regenerates the ZIP linked above from `dist/`; its current script uses POSIX `rm` and `zip`, so on Windows run it in an environment that provides those commands. For local testing, `npm run build` and loading `dist/` are enough.

History is shared between supported pages on `sokker.org` and its subdomains in the same extension installation and browser profile. It is stored locally in the extension; it is not shared with another profile, extension installation, or device. Export a JSON backup before moving or uninstalling. The popup can export, import, and clear local history without an open Sokker tab; sync and repair require a signed-in Sokker page.

When updating from the older site database, open a classic page on `https://sokker.org` once and reload existing Sokker tabs. Recovery copies the original database without deleting it. If the beta redirects before that inspection, the popup explains that a classic page is needed. For the first real-data pilot of this experimental build, first keep an independent complete backup and demonstrate its restoration in an isolated environment. The original database and the new shared history must both be preserved during any rollback, because the new history may contain later observations.

This source build adds beta compatibility; an existing packaged ZIP is not rebuilt by these instructions. See the [privacy policy](../PRIVACY.md) and the [verification record](../docs/research/2026-10-23-new-sokker-beta-verification.es.md) for the tested scope.
