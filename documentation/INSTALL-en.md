# Install Sokker++ from source

**English** · [Español](INSTALL-es.md)

The ZIP committed under `documentation/` is an older build. Use the current source for a manual installation.

1. Download or clone this repository and install its development dependencies with `npm ci`.
2. Run `npm run build`. It creates `dist/` with `manifest.json` at its root.
3. Open `chrome://extensions/`, `edge://extensions/`, or `brave://extensions/` in the matching browser and turn on **Developer mode**.
4. Choose **Load unpacked** and select the `dist/` directory containing `manifest.json`.
5. Open Sokker while signed in. On squad/player pages, saved skill history and arrows appear as data becomes available. Hover or focus a first-team player's name for General Skills ++. On a training report details page or your own academy page, hover or focus a junior name for its chart.

After changing source code, rebuild and use **Reload** on the extension's browser card. `npm run package` builds a store ZIP from `dist/`; its current script uses POSIX `rm` and `zip`, so on Windows run it in an environment that provides those commands. For local testing, `npm run build` and loading `dist/` are enough.

Local history is stored in the browser's `sokker.org` site data. Export a JSON backup from the popup before moving browsers or devices if you want to preserve accumulated history. See the [privacy policy](../PRIVACY.md).
