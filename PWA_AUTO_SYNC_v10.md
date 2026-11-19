# Waybook PWA + Family Auto Sync (v10)

Base: AI Studio corrected waybook (9).zip plus previously deployed successful Google Drive receipt and administrator auth corrections.

## Changes
- On initial visit Waybook already pulls Google Drive snapshot; now family viewer also checks when returning to the browser/PWA, regaining connectivity, and every two minutes while visible. Throttled to 15 seconds.
- No auto-refresh while logged in as admin, editing a trip or using a detail sheet. Local unpublished changes are protected from automatic replacement. Manual Reload remains.
- Same `updatedAt` cloud snapshot avoids needless large photo downloads. Existing downloaded photo data is reused by file ID.
- Existing Vite PWA plugin and PWA icon assets were already in the project; fixed manifest icon locations and HTML favicon/touch icon for GitHub Pages `/waybook/` base path.
- No new cloud API, subscriptions, credentials, or server required.

## Publishing
1. For an existing GitHub repo, replace `src/App.tsx`, `vite.config.ts`, `index.html`, `src/utils/driveCloud.ts` as appropriate. `Code.gs` is only for record and matches the already successful administrator authentication fix; if your working backend is deployed, do not redeploy it merely for this change.
2. Commit and push to main. Github Actions rebuilds the PWA.
3. Open https://woeichia.github.io/waybook/; on Android Chrome use menu > Add to Home screen / Install app; on iPhone Safari use Share > Add to Home Screen.
4. Publish a changed title from desktop; on family phone open the installed Waybook app and allow time for cloud data to load. Leave app and come back to test refresh on return.

## Boundaries
- Published trip and photos need internet to fetch latest updates. Previously cached pages can work offline, but the latest cloud changes cannot arrive offline.
- A GitHub Pages PWA is not a native app-store application, and installed PWA behavior depends on device and browser.
- The live cloud reading API is public; avoid private family photos or booking credentials until access control is implemented.
- Weather `/api/weather` and AI `/api` remain unavailable on static GitHub Pages; intentionally unchanged.
- Backend files included so the complete ZIP reflects latest fixes; no backend changes required for this PWA/sync step.
