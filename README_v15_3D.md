# Waybook v15.3D — Family-authenticated Google Drive video delivery (pilot)

## Scope and safety

This is a deliberately limited **8 MB** proof of concept for **one already-registered video**, not a production streaming solution. The existing v15.3C family password, v15.3B Drive video registry, administrator publishing, photos, sounds, and app navigation remain intact. No new storage service and **no Google login for viewers** in the new green player. It leaves all Drive permissions Restricted. It does NOT remove the original Drive player: that is a fallback, still subject to Google's login/access rules.

**Important:** Back up your working `Code.gs` and keep a copy of the repository before applying. The login and security code must remain unchanged. Install both frontend and backend from this ZIP; the new button cannot work with the old Apps Script deployment.

## Files

- `Code.gs` — complete backend from v15.3C with one additional authenticated `videoChunk` family-read action. No need to change existing Script Properties.
- `src/components/CloudVideoGallery.tsx` — adds a green **v15.3D 家庭密碼播放** test button for already registered videos <=8 MB and full-view HTML5 player; retains the existing Drive preview button as fallback.
- `src/utils/privateDriveVideo.ts` — new chunk retrieval and integrity checks, session-memory reuse of the downloaded video.

## Installation

1. Back up your existing working `Code.gs` and repository.
2. Copy the two `src/` files into your Waybook GitHub repo, commit `Pilot protected Google Drive video playback`, push and verify GitHub Pages Actions succeeds.
3. In your existing **Waybook Apps Script project**, replace the entire `Code.gs` with the provided complete version. Keep existing Script Properties unchanged: `FOLDER_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, `ORS_API_KEY`, `FAMILY_ACCESS_CODE`. **Deploy > Manage deployments > Edit > New version > Deploy**. Re-use the existing web-app URL.
4. Google Drive API must remain enabled on the same Google Cloud project (done for v15.3A). This pilot uses the Apps Script execution owner's Drive authorization via `ScriptApp.getOAuthToken()` and `UrlFetchApp` to fetch 256 KiB ranges from the Drive API. You may need to authorize new permissions for the Apps Script web app owner if prompted. Check `appsscript.json` if you explicitly configured `oauthScopes`: both `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/script.external_request` must be available; existing Apps Script functionality may require other scopes too. Do not replace a custom scopes list blindly.
5. Use an already registered **MP4 video smaller than 8 MB**; your earlier ~4.30 MB clip is suitable. Keep the file inside `Waybook Family Videos` and leave its Drive general access **Restricted**.
6. On a separate phone/browser, open Waybook without Google login, enter the normal family password. Open that event > **雲端回憶短片** > green **v15.3D 測試：用家庭密碼直接播放（無需 Google 登入）** button. Wait for progress. Confirm play with audio, close with Back/close, reopen in the same page, and play again.
7. Test that **Lock** requires the code again; close the browser tab and verify re-login; verify the normal photo gallery and administrator publication are unchanged. No private Drive sharing to family accounts is necessary for the new green button.

## What counts as PASS

- An invited tester with **no Google account logged in** can view a **Restricted** Drive video via the green Waybook button after entering the family code.
- Audio and full video work; Back closes the viewer; reuse inside the same open page does not download again.
- No Google OAuth token appears in browser code, a video URL, or family responses.
- The old itinerary, memories photos, login and admin publish still work.

## Expected limitations

- **Maximum 8 MB**. Larger clips retain the older Drive preview. This is intentional until download speed, quota usage, errors and device compatibility are measured.
- **The whole video is downloaded before playback**. Google Drive API supports HTTP Range, but Apps Script cannot stream video bytes as a native HTTP video response. This pilot repeatedly fetches 256 KiB chunks and returns base64 via authenticated iframe POST responses. ~4.3 MB takes about 18 sequential Apps Script requests; it may be slow on mobile and could hit quotas. If it is too slow, we should not scale it to 25 MB without a different delivery architecture.
- Memory-only cache while current page is open; not saved to device storage or offline. This avoids accidentally leaving downloaded family video files accessible after logout.
- Google Apps Script limits, Google Drive API Range behavior, browser iframe restrictions, and real-device playback have **not** been verified live. An `HTTP 200` instead of `206` from Drive results in a safe error, not an accidental whole-video download.
- A shared family password is not individual-user authentication. Anyone with the password and active session can access registered family content. The publicly served frontend files also need independent audit for embedded itinerary/media assets.

## Troubleshooting

- `Unsupported family read action` -> old Apps Script deployment is still active; deploy a **new version of existing deployment**.
- `Drive partial download unavailable (HTTP 403)` -> Drive API not enabled for the Apps Script execution project, or Apps Script Drive authorization / scopes insufficient; check Apps Script Executions and Google Cloud Drive API.
- `HTTP 200` -> Drive did not honor Range; do not weaken the 206 check. Report this exact error for alternate design.
- Timeout -> Google Apps Script bridge or quotas; take a screenshot of the error. Do not repeatedly tap upload or modify the Drive sharing settings.
- No green button -> the event has no registered video, the video exceeds 8 MB, or the frontend deploy is stale.

## Rollback

Restore the previous `Code.gs` and `src/components/CloudVideoGallery.tsx` and remove `src/utils/privateDriveVideo.ts`. Do not delete any Drive files. The existing video registry and photo data are unaffected.
