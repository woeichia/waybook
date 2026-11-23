# Waybook v15.3A — Private Google Drive video upload pilot

**Scope:** administrator-only verification of uploading ONE already-saved local Memories clip directly into the Google account chosen during the OAuth consent flow. Does not synchronize video to family members, change Apps Script, alter photo galleries, or change iPhone/Android navigation.

## Files (replace/add exactly these)

- `src/components/StopDetailSheet.tsx` — one admin-only panel below the existing local video pilot
- `src/components/DriveVideoUploadPilot.tsx` — NEW private-upload test panel
- `src/utils/driveVideoPilot.ts` — NEW Google Identity Services token + resumable Drive upload and verification

Use your latest working repository as the baseline and overwrite only these paths. Do NOT install an older navigation patch. This includes the existing local video player, so retain your current `MemoryClipPilot.tsx`, `compressVideo.ts`, `DaySelector.tsx`, `MemoryGallery.tsx`, and `Code.gs` as-is.

## Google Cloud one-time setup

1. Open https://console.cloud.google.com/apis/library/drive.googleapis.com and select the SAME Google Cloud project associated with the OAuth Client ID currently configured as `VITE_WAYBOOK_GOOGLE_CLIENT_ID` in your Waybook GitHub Actions deployment.
2. Click **Enable** for Google Drive API if not already enabled.
3. In Google Auth Platform / OAuth consent screen, ensure `https://www.googleapis.com/auth/drive.file` is an allowed/requested scope. This is a per-file, non-sensitive scope, not broad access to all your Drive files.
4. If the OAuth app is in **Testing** mode, add the Google account used to upload to Test users.
5. Check the web OAuth Client ID has authorized JavaScript origin `https://woeichia.github.io` (origin only, no `/waybook/` path). Keep existing origin values, don't replace.
6. **No client secret, API key, or long-lived Google access token is needed** in frontend or GitHub. Do not paste private keys into the repository.

The existing admin login is used for UI gating; Google Drive upload separately prompts for consent to a Google account. Make sure to choose your intended personal Drive account. A test file is created in that account's My Drive root with a `Waybook_TEST_` prefix. It remains private by default; the app does NOT change sharing permissions.

## Deploy and test

1. Commit the three files and push. Check GitHub Actions and open your installed Waybook app.
2. Log in as Waybook administrator, open an event with a **locally stored video** on that SAME device.
3. The new **v15.3A · Google Drive 私人上傳測試** section appears under the local video player. Tap **重新檢查** if you just added the clip.
4. Tap **上傳測試影片至 Drive**, approve the upload and the Google consent screen.
5. Wait for 100%; verify a Drive file ID, the same byte size, and file link. Confirm you see `Waybook_TEST_...` in Google Drive.
6. Reopen the event; the previously uploaded test file isn't automatically republished or downloaded. This is intentional.
7. Delete the test file manually from your Google Drive after testing if desired.

## Known limitations and safety

- v15.3A uploads a file **privately**; **family members cannot watch it yet**. v15.3B will handle secure playback and publishing.
- Only one upload should be attempted per clip. If the connection fails or times out, first search Drive for `Waybook_TEST_` before retrying, to avoid duplicates.
- The code starts a **resumable upload session**, but the pilot does not yet implement resuming an interrupted session; that requires a later reliability enhancement.
- A 25 MB limit still applies to the stored local clip, using any compression already performed by Waybook. Google Drive API charges no direct usage fees for this within standard quotas, but files use your Google account storage.
- `403 SERVICE_DISABLED` → enable Google Drive API on the matching Cloud project.
- `403 access_denied` / `Error 403: access_denied` during OAuth → add your Google account as OAuth test user / verify OAuth consent settings.
- `400 origin_mismatch` → confirm JavaScript origin is exactly `https://woeichia.github.io`.
- `401` → Drive token expired or unauthorized; reopen consent and retry *only after checking Drive for a partial/complete test file*.
- `403 storageQuotaExceeded` → account storage is full.
- The in-browser request may be blocked by device/browser or Google CORS policy; capture the error and do not modify Apps Script or turn off security protections to work around it.

## Validation

The three TypeScript/TSX files passed TypeScript transpiler syntax diagnostics (0 errors), and ZIP contents were checked. Full Vite production build and actual Google OAuth/Drive phone test have NOT been completed in this environment.
