# 台湾2026 — Waybook v14.1: Location-aware road travel estimates

## What this patch changes

- Preserves the working v14 planner, event-ID/photo behavior, and caching.
- Adds an explicit **計算實際道路時間** button inside the move/copy preview.
- Calculates **each adjacent leg** in the proposed activity order, using geocoded Taiwan place names and OpenRouteService driving-car road routes.
- Fills the preview's per-leg transfer times when routing succeeds, and immediately recalculates the schedule.
- Displays each leg's source/destination, estimated minutes and kilometres, with clear warnings for unresolved/low-confidence places.
- Keeps manual duration/transfer overrides, existing schedule-conflict confirmation and the ability to cancel without changing anything.
- Does NOT ask family viewers to run location requests; ONLY the administrator who signs in and clicks the routing button uses the free quota.
- Does NOT delete events or photos or automatically publish anything.

## Required: free OpenRouteService key

1. Create your free account and key using https://account.heigit.org/ (follow the provider's current registration UI).
2. **Never** commit the API key to GitHub or put it in a Vite environment variable.
3. In Google Apps Script for your existing *Waybook Backend*, open **Project Settings → Script Properties**.
4. Add `ORS_API_KEY` with your actual key as the value. Leave all other properties (`FOLDER_ID`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, etc.) unchanged.

## Install the backend safely: preserve your live authentication and receipts

**Important:** The version of `google-apps-script/Code.gs` in the public GitHub repository is older than the deployed Apps Script project. Replacing your live Code.gs from GitHub risks breaking login and sync. DO NOT replace it.

1. In your existing Google Apps Script project, add a **new script file** `WaybookRouting.gs`. Paste the supplied `google-apps-script/WaybookRouting.gs` in full.
2. In your CURRENT, WORKING `Code.gs` locate the `doPost(e)` dispatch which already handles `uploadPhoto` and `publish`.
3. Immediately before the final `else throw Error('Unsupported write action')` (or equivalent fallback), insert exactly this additional branch:

```javascript
else if (payload.action === 'routePlan') answer = {ok:true,data:waybookRoutePlan_(payload.data)};
```

   Important: Leave `checkAdmin_(payload.idToken)` **before** this branch. Do not expose a public GET `routePlan` action.
4. Save. Choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Keep existing web-app URL, 'Execute as me' and current permissions. Redeploying only a new version means the GitHub Actions variable does not need to change.
5. Apps Script's first call to UrlFetchApp may ask you to authorize external requests in your account. Review and authorize if expected. Never share the key or your login token.

## Update GitHub project

Copy only these files from the patch into your existing `waybook` repository:

- `src/App.tsx`
- `src/components/ItineraryEditor.tsx`
- `src/utils/routePlanning.ts` (new)

Commit `Add authenticated ORS road estimates to schedule preview`, Push, and check GitHub Pages succeeds. Do not copy or overwrite your GitHub workflow or existing source outside these paths. If you've made other source edits since v14, compare first instead of wholesale replacement.

## Acceptance tests (before publishing itinerary)

1. Make full JSON backup and confirm photo IDs are still present; do not alter the cloud snapshot for testing.
2. Windows: login as Waybook administrator. Day 3 → 清境農場 → Move to Day 4.
3. Use insert position **after 逢甲退房出發**. Click **計算實際道路時間**.
4. Verify leg labels and driving minutes, especially Cingjing → Shifen. Do not rely on an incorrect geocoder match.
5. Change insert position to last; recalculate. Verify the previous leg is now 台北飯店 → 清境農場, not a default 30-minute transfer.
6. Check the schedule warnings and charter end time. Cancel. Verify Day 3 and Day 4 remain unchanged.
7. Test a manual override after a successful route request.
8. Remove network access / simulate route outage: app must show an error without changing the itinerary.
9. Verify PWA, automatic sync, weather, photos, and current GitHub Pages workflow still work.

## Design and security caveats

- Route estimates represent road-network travel for `driving-car`, **not live traffic** or public transport. They do not include waiting, parking, detours or operating hours.
- `mapQuery` needs to be precise. A mistaken geocoding match can give false directions. The app displays original place names; check the intended endpoints.
- The service currently has intermittent availability issues (November 2026). Failure is not evidence that the app is broken. You can enter manual travel times instead.
- The backend has a hard guard of **60 external calls per UTC day** and at most **10 stops per calculation**. The provider has its own independent daily/per-minute quotas. Cached repeated results can avoid additional provider requests, but caching is temporary. Exceeding the guard yields a user-facing error, not automatic billing.
- Imported JSON event IDs, existing cloud photo references and App's cache layer are unchanged.
- `ORS_API_KEY` is private in Apps Script properties, but Google's Apps Script project must remain access-controlled; do not share backend edit access with untrusted parties.

## Validation performed

- TypeScript/TSX transpilation diagnostics: 0 errors for all modified/new front-end files.
- Apps Script JS syntax: passes Node V8 syntax check.
- Actual route API requests not exercised: no user-supplied API key is available, and provider availability may be limited. Full GitHub production build and real phone acceptance tests must be completed after setup.
