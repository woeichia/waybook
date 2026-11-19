# Waybook v6 — Google Drive integration (pilot)

## What is included

- v5 photo-gallery UI, Taiwan itinerary and Noto Sans TC font.
- Public **read-only** cloud itinerary and gallery, with manual reload button.
- Google administrator sign-in (Google Identity Services ID token).
- Protected publishing of itinerary and photos via Google Apps Script.
- Conflict detection using `updatedAt`, version backups in Drive.
- JSON import/export retained. A JSON file contains itinerary fields, **not binary photographs**.
- Local-only preview mode when cloud settings are blank.

**Privacy warning:** The pilot *read* endpoint is accessible to anyone who knows the Apps Script URL. The itinerary and uploaded pictures must be treated as public/unlisted. Do not upload private family photos or sensitive booking details until we implement an authenticated viewer endpoint. Google Drive itself need not be publicly shared; the Apps Script owner account acts as the reader. **Write access is protected by server-side Google ID-token verification and an admin email allowlist.**

## Google setup — required once

1. In Google Drive, create a private folder called `Waybook Taiwan` and copy the folder ID from its URL.
2. In Google Cloud Console, create or select a project, configure the OAuth consent screen (External works for consumer Gmail accounts) and create a **Web application** OAuth client ID. Add your eventual `https://YOURNAME.github.io` origin and, when applicable, your AI Studio preview origin to **Authorized JavaScript origins**. The origin is scheme+host(+port), **not a path**. If your app is in testing mode, add your own Google account as a test user.
3. Visit [Google Apps Script](https://script.google.com/), create a project and paste `google-apps-script/Code.gs` into `Code.gs`.
4. In Apps Script, open **Project Settings → Script properties**. Add:
   - `FOLDER_ID`: the private Drive folder ID.
   - `GOOGLE_CLIENT_ID`: the Web OAuth client ID created above.
   - `ADMIN_EMAIL`: your exact Google account email (the only authorized publisher).
5. Deploy → New deployment → Web app. Set **Execute as: Me**, **Who has access: Anyone**. Authorize the Drive and external URL permissions. Copy the `/exec` URL (not `/dev`).
6. Add to a local `.env` file for preview, or AI Studio's environment configuration:
   ```
   VITE_WAYBOOK_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   VITE_WAYBOOK_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   ```
   These values are client-visible by design. **Never put a personal Google password, access token, or API secret in frontend env variables.**
7. Restart/rebuild the preview. The banner changes to `Google Drive 同步 · 已設定`. Use `管理員登入` and select the authorized Google account. Publish once. Open in a second phone/browser and use `重新載入` to see the same cloud snapshot.
8. After changes to `Code.gs`, create **a new Apps Script deployment version**. Otherwise the `/exec` URL continues serving the old backend.

## Deploy with GitHub Pages

The repository contains `.github/workflows/pages.yml`. Push the project to a GitHub repository on `main`, then enable **Settings → Pages → Source: GitHub Actions**. In **Settings → Secrets and variables → Actions → Variables**, create:

- `WAYBOOK_APPS_SCRIPT_URL` (the `/exec` URL)
- `WAYBOOK_GOOGLE_CLIENT_ID` (the public Web OAuth client ID)

The workflow builds with `VITE_BASE_PATH=/REPOSITORY_NAME/` so the application loads under GitHub Pages. Your authorized Google origin is `https://YOURNAME.github.io`. Fixed bundled photos under `/images/...` are rewritten for the repository base by `SmartImage`.

This project also has a server-side AI itinerary generation route for AI Studio/Node preview. That route **does not run on GitHub Pages**, which hosts static files only. JSON import, gallery and Google Drive sync are intended to work without it.

## Accept/reject test

1. Keep settings blank and confirm the old v5 local-gallery behavior remains intact.
2. Configure the backend, sign in as admin, publish the default Taiwan trip. Check a second browser gets the itinerary.
3. Upload **one test photo** as admin and click `發佈行程及照片`. Reload a second browser; check its image carousel and card cover.
4. As a guest, verify edit and upload controls are absent. Attempted backend publishing with no valid ID token must fail.
5. Change an itinerary stop and re-publish, then refresh the second browser. Confirm JSON import still works.
6. If two admins/browsers publish based on different versions, the older version must be rejected until reload.

## Limitations

- Image data crosses through Apps Script (base64 JSONP response) because standard Google Drive share links are not reliable website image endpoints. This is suitable for **small pilot galleries**, not a production photo CDN; script quotas, response sizes and speed apply.
- The public read endpoint is **not private family authentication**. Do not use it for sensitive imagery.
- Auto-refresh is not enabled; guests can press Reload or refresh the browser page.
- Photo loading is sequential and can be slow on large itineraries. Test 1–3 photos before expanding.
- Admin ID tokens are short-lived. Sign in again if the backend rejects an expired token.
- An Apps Script + Google Identity flow cannot be fully verified until deployed to your Google account. Test in the deployed origin, not only embedded AI Studio preview, which may block Google login in an iframe.
- Local v5 pictures are stored only on the original device. In configured cloud mode, re-upload the desired pictures and publish them from that device before relying on remote viewing.
- No automatic photo recovery after deleting from a published manifest; snapshots retain references in the backup JSON, but Drive files are not removed by the app.
