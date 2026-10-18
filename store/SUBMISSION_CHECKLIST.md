# Chrome Web Store submission checklist

## Package

- [ ] Build with `npm run build`, then package the contents of `dist/` at the ZIP root (`npm run package` in a POSIX-compatible shell with `zip`, or `Compress-Archive` on Windows). The single release ZIP is `documentation/sokker-plus-plus.zip`; confirm `manifest.json` is at its root and the archive matches the latest build.
- [ ] Confirm the uploaded build corresponds to the source facts cited in `store/LISTING.md`, especially `manifest.json` host scope and the same-origin API behavior in `src/core/api.ts`.
- [ ] Confirm the ZIP includes `_locales/en/messages.json` and `_locales/es/messages.json`; select Spanish in the Store listing and save the description from `store/LISTING.md` section 4.
- [ ] Store icon: reuse `assets/icons/icon-128.png` (128×128); no replacement icon was created.

## Store listing

- [ ] Item name — `store/LISTING.md`, heading “1. Item name”.
- [ ] Summary / short description — `store/LISTING.md`, heading “2. Summary / short description”. The manifest reads English and Spanish summaries from `_locales/`.
- [ ] Detailed description, English — `store/LISTING.md`, heading “3. Detailed description — English”.
- [ ] Detailed description, Spanish — `store/LISTING.md`, heading “4. Detailed description — Spanish”.
- [ ] Category — `store/LISTING.md`, heading “5. Category”; choose Entertainment, with Tools as the fallback.
- [ ] Primary and additional languages — `store/LISTING.md`, heading “6. Language”.
- [ ] Homepage URL, Support URL, Privacy policy URL — `store/LISTING.md`, heading “7. URLs”.
- [ ] Screenshots — upload the three current PNGs in `store/chrome-web-store-assets/`: `screenshot-general-skills-640x400.png`, `screenshot-junior-card-640x400.png`, and `screenshot-junior-export-640x400.png`. They use the owner-approved public examples; inspect the player details before submission.
- [ ] Small promotional tile — upload `store/chrome-web-store-assets/promo-small-440x280.png`, not an SVG.
- [ ] Optional marquee tile — upload `store/chrome-web-store-assets/promo-marquee-1400x560.png`.
- [ ] Store icon — upload/reuse `assets/icons/icon-128.png`.

## Privacy practices

- [ ] Single purpose — `store/LISTING.md`, heading “8. Privacy practices” → “Single purpose description”.
- [ ] Host permission and content script match justifications — same section → “Permission justification”.
- [ ] Remote code answer and justification — same section → “Remote code”.
- [ ] Data categories and collected yes/no — same section → “Data usage categories”; verify the currently rendered dashboard checkboxes.
- [ ] All three data-use certifications — same section → “Certifications”.
- [ ] Privacy policy — publish/link `PRIVACY.md` at the URL in listing heading “7. URLs”.

## Distribution

- [ ] Choose visibility (for example, public or unlisted) in the Dashboard.
- [ ] Choose countries/regions for availability.
- [ ] Review any pricing/distribution choices shown in the live Dashboard.

## Account

- [ ] Confirm the developer account profile and contact email in the Dashboard.
- [ ] Complete any account verification or payment steps the Dashboard currently requires.

## Remaining manual submission steps

- [ ] Upload the ZIP package.
- [ ] Upload the store icon, three current screenshots, and promotional tile.
- [ ] Paste each listing value into its matching Dashboard field.
- [ ] Complete the Privacy practices answers and certifications.
- [ ] Choose visibility and regions.
- [ ] Review the final listing and submit it for review.

## Known limitations to mention if reviewers ask

- First-team synchronization is attempted on Sokker.org page load (`src/content/main.ts`). Junior synchronization is limited to eligible report details and own academy pages (`src/content/juniorPage.ts`).
- Player, junior, and sync history is kept in local IndexedDB (`SokkerTalentTrackerDB`) in the `sokker.org` site storage (`src/core/repository.ts`, `src/core/juniorRepository.ts`). The extension does not send it to the developer or third parties. Uninstalling does not delete it; the popup's Clear All Data does.
