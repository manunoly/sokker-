# Chrome Web Store submission checklist

## Package

- [ ] Run `npm ci` and `npm run package` in a POSIX-compatible shell with `zip` installed. Inspect `store/sokker-plus-plus.zip` and confirm `manifest.json` is at its root. The committed `documentation/sokker-plus-plus.zip` is an old build and must not be uploaded.
- [ ] Confirm the uploaded build corresponds to the source facts cited in `store/LISTING.md`, especially `manifest.json` host scope and the same-origin API behavior in `src/core/api.ts`.
- [ ] Store icon: reuse `assets/icons/icon-128.png` (128×128); no replacement icon was created.

## Store listing

- [ ] Item name — `store/LISTING.md`, heading “1. Item name”.
- [ ] Summary / short description — `store/LISTING.md`, heading “2. Summary / short description”. Use that same value as the proposed manifest description when updating the manifest separately.
- [ ] Detailed description, English — `store/LISTING.md`, heading “3. Detailed description — English”.
- [ ] Detailed description, Spanish — `store/LISTING.md`, heading “4. Detailed description — Spanish”.
- [ ] Category — `store/LISTING.md`, heading “5. Category”; choose Entertainment, with Tools as the fallback.
- [ ] Primary and additional languages — `store/LISTING.md`, heading “6. Language”.
- [ ] Homepage URL, Support URL, Privacy policy URL — `store/LISTING.md`, heading “7. URLs”.
- [ ] Replace outdated screenshots with fresh captures of General Skills ++ and the junior chart. Check that account and player details are safe to publish, and verify the required image sizes in the live Dashboard before submission.
- [ ] Screenshots — upload `store/screenshot-01.png` through `store/screenshot-05.png`; use captions in `store/LISTING.md`, heading “9. Screenshot captions”.
- [ ] Small promotional tile — upload `store/promo-small-440x280.png`.
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
- [ ] Upload the store icon, five screenshots, and promotional tile.
- [ ] Paste each listing value into its matching Dashboard field.
- [ ] Complete the Privacy practices answers and certifications.
- [ ] Choose visibility and regions.
- [ ] Review the final listing and submit it for review.

## Known limitations to mention if reviewers ask

- First-team synchronization is attempted on Sokker.org page load (`src/content/main.ts`). Junior synchronization is limited to eligible report details and own academy pages (`src/content/juniorPage.ts`).
- Player, junior, and sync history is kept in local IndexedDB (`SokkerTalentTrackerDB`) in the `sokker.org` site storage (`src/core/repository.ts`, `src/core/juniorRepository.ts`). The extension does not send it to the developer or third parties. Uninstalling does not delete it; the popup's Clear All Data does.
