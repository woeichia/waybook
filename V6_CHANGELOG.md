# Waybook v6 — Cloud pilot changelog

Based on the user-provided AI Studio–corrected `waybook (4).zip` (not the original v5 archive).

## Added
- `google-apps-script/Code.gs`: Google Drive read API and authenticated write API.
- `src/utils/driveCloud.ts`: cloud read/write/photo adapter and Google sign-in.
- `src/components/CloudPanel.tsx`: administrator login, publish, reload and cloud status.
- `.github/workflows/pages.yml`: sample static GitHub Pages deployment.
- `GOOGLE_DRIVE_SETUP_v6.md`: setup, security limits, and acceptance tests.

## Preserved
- Taiwan trip itinerary, Noto Sans TC font, photo gallery, JSON import/export, local prototype behavior.
- AI Studio corrections in v5 photo storage. Adjusted gallery loader so IndexedDB unavailability falls back correctly.

## Cloud behavior
- With empty cloud env variables: local prototype as before.
- With both cloud settings present: family view is read-only, and the published itinerary/photos load from Drive. Authorized administrator can edit/upload locally and publish.
- Cloud snapshots reference Drive photo file IDs and keep timestamped backups of prior JSON versions.

## Not yet production-verified
- Google Apps Script server must be deployed with an admin account and OAuth web client ID.
- A live two-device integration test is required. Google Drive access and sign-in cannot be verified offline.
- Read endpoint exposes photos to people who know the URL: this is a pilot for non-sensitive images only.
- Native AI generation route depends on Node/AI Studio and is not available under static GitHub Pages.
