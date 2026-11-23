# Waybook v15.3C — Family Access Foundation (pilot)

## Read before installing

This patch changes both frontend and Google Apps Script read authentication. **The old frontend will not read data after the new backend is deployed.** Back up the entire existing project and the existing `Code.gs`. Ideally update frontend first, then Script Properties and backend immediately afterward. The new frontend cannot read data from the old backend, so arrange a short maintenance window. Do not deploy just before travel.

**This is NOT the protected private-video streaming phase.** It gates itinerary/photo/metadata API reads. The v15.3B Drive video iframe still follows Google Drive's own per-file access rules; family login does not override them. Existing bundled/static assets, cached local data stored on previously-used devices, and previously shared Drive links cannot be retroactively made secret.

## Contents

- `Code.gs`: full replacement for the v15.3B backend, retaining photo publishing, admin auth, ORS route planning, video registration and receipts
- `src/main.tsx`: mounts app only after family verification
- `src/components/FamilyGate.tsx`: family password screen and manual Lock button
- `src/utils/familyAccess.ts`: short-lived server session via POST (no password/token in URL)
- `src/utils/driveCloud.ts`: protected POST-based snapshot, photos, video registry; existing admin write mechanism retained

## Installation

1. In Google Apps Script, **back up existing Code.gs** to a local file.
2. In Google Apps Script: Project Settings → Script Properties → Add `FAMILY_ACCESS_CODE`. Choose a **long unique passphrase of 12–128 characters**, not a 4-digit PIN. Do not put the code in GitHub files or variables. Keep `FOLDER_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, `ORS_API_KEY` unchanged.
3. Extract ZIP to your local Waybook GitHub repository. Replace only the 4 matching `src` files, preserving all other source files. Commit `Introduce protected Waybook family sessions` and push; check GitHub Actions. **Until backend deploys, sign-in will not work**.
4. Replace `Code.gs` with the included complete script. Use **Deploy → Manage deployments → Edit → New version → Deploy**, not New Deployment. `Execute as: Me`, access: `Anyone` (the script verifies sessions internally). Avoid sharing this URL in public places.
5. Open Waybook in a fresh or incognito phone browser. Expect the family login screen. Enter the passphrase. Verify itinerary + photos, edit/publish as admin, and video metadata appear. Test incorrect passphrase, Lock, close/reopen, and session expiry. Test a second family phone before removing backups.
6. Test that the old API endpoints `?action=snapshot&callback=__waybook_test` and `?action=photo&fileId=...&callback=__waybook_test` now return `Family authorization required`, rather than the data. Do not paste real family tokens in URLs.

## Behavior

- Session stored in `sessionStorage`, validated against Google Apps Script CacheService (up to 6h). The session may outlive a phone's swipe-away/termination if the OS restores the web view. It is **not possible to guarantee 'logout exactly when the app is fully closed' on iOS/Android PWAs**.
- Explicit **鎖定** button removes session immediately from this browser's sessionStorage. Backend tokens may remain valid until expiry; local locks do not revoke a leaked token.
- A network connection is needed on unlock/verification. Previously cached itinerary is not displayed before login; once unlocked, existing IndexedDB cache behavior stays intact.
- Existing Google Drive family videos still require Drive sharing/account access in v15.3B. Family-code-only private playback requires an additional protected video delivery design.
- Since GitHub Pages hosts static JavaScript and assets publicly, the family code does not make source code or embedded/static itinerary data inherently secret. A later privacy hardening should remove any sensitive baked-in data from the publicly deployed bundle.

## Troubleshooting

- **Code not accepted:** ensure `FAMILY_ACCESS_CODE` is set in **the same Apps Script project**, has at least 12 chars, and new deployment version was published.
- **Timeout after entering correct code:** the Apps Script HtmlService iframe may be blocked or the browser may disallow cross-origin messages. Test Chrome (not an embedded WhatsApp browser), inspect console, and verify deployment URL. Don't disable security features.
- **Old app suddenly cannot load photos:** frontend/browser may be cached; reopen or update installed PWA after deploying both sides. Don't revert only one side.
- **Drive video still asks for Google login:** expected until protected video delivery is implemented.
- **Family cannot enter at all:** redeploy previous `Code.gs` and previous frontend files together as rollback.
