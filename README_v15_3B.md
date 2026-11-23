# Waybook v15.3B — Family video playback, private Drive folder

## What is included

- `Code.gs`: **full Apps Script backend replacement**, based on the validated v15 Memories backend (includes original photo publishing, receipt polling, admin authentication, and v14.1 routing). Adds `videos`, `registerVideo`, `removeVideo` actions.
- `src/components/CloudVideoGallery.tsx`: new. Shows already-published video metadata from local cache, checks updates without downloading video bytes, provides full-view Drive playback and Drive link fallback. Adds administrator registration of previously uploaded Drive file ID.
- `src/components/StopDetailSheet.tsx`: replace current v15.3A file; mounts video panel for admin and family, without modifying existing photo or local-video components.
- `src/components/DriveVideoUploadPilot.tsx`: replace current v15.3A file; sends the uploaded Drive ID to the new panel automatically (still possible to paste it manually).

No change to `src/App.tsx`, `DaySelector.tsx`, `MemoryGallery.tsx`, `uiSounds.ts`, existing photo cache, itinerary publishing, or GitHub Pages workflow.

## Install in GitHub repo

1. Save a backup/copy of the current code and Apps Script backend. Keep a known-good GitHub commit.
2. Unzip and copy the `src` files into the repo, preserving paths.
3. Commit `Add v15.3B private family video registry and playback` and Push origin.
4. Check GitHub Actions and confirm success.
5. In the **same existing Apps Script project**, paste **the complete Code.gs** from this archive into the existing script editor, replacing Code.gs. Do not delete existing Script Properties, including `FOLDER_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, and `ORS_API_KEY`.
6. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Keep the existing deployment URL, execution as Me, and permissions consistent with your working backend. Do not create a new web-app URL.
7. Open Waybook and verify existing itinerary and photos still load before registering a video.

## Register the v15.3A uploaded test video

1. On the administrator's phone, sign in as Waybook admin and open the same itinerary event where the test video was uploaded.
2. In `雲端回憶短片`, paste the Google Drive File ID from the successful v15.3A upload (or upload a new clip to populate the field automatically).
3. Tap `登錄雲端影片`, then authorize the **same Waybook admin Google account** again if prompted. It uses the existing admin ID-token check, independent of the Drive access-token scope.
4. The backend confirms the video file type and that it is at most 25 MB, moves the file into `Waybook Family Videos` inside the existing Waybook root folder, and saves a **small video-index JSON**. It does not change Google Drive sharing permissions.
5. Do not manually publish the itinerary for this test; video references are versioned separately to avoid disturbing the photo-sync baseline.

## One-time secure family folder sharing (REQUIRED)

1. Open Google Drive with the account that owns the Waybook Apps Script and storage folder.
2. Find the existing Waybook folder (the `FOLDER_ID` Script Property points to it) and the new **Waybook Family Videos** subfolder.
3. Right-click **Waybook Family Videos** → Share.
4. Under General access, keep **Restricted**, NEVER `Anyone with the link`.
5. Add the specific family members' Google emails as **Viewer** (not Editor), then Send.
6. In the family member's Android/iPhone browser, sign in to that invited Google account (Drive web or Google app). Open Waybook **without admin login**. Open the event and tap the cloud video.
7. If the embedded Google Drive player asks for login, is blocked by third-party cookie policies or appears blank, choose **Open in Google Drive** in the Waybook video viewer. This is a deliberate supported fallback. Google controls embedded Drive playback and processing.

**Privacy limitation:** This option requires family members to have a Google account with access to the folder. It does not achieve anonymous, login-free private streaming. Metadata (Drive file ID, size, MIME type and event mapping) is readable via the public Waybook `videos` API, but Drive restricts actual video bytes. Avoid sensitive file names; the public video registry does not include names.

## Cache behavior

- Only video **metadata** is saved in the device localStorage (and kept for 30 days while available); video bytes are not prefetched.
- Opening an event shows the cached video action first, with a lightweight background check for changes. Opening an event again does not trigger video re-download until the video is played.
- Drive/browser controls video streaming and caching after playback; we do not promise offline viewing of videos or zero network use on repeated playback.
- Existing photos and itinerary continue using their existing IndexedDB caching and version checks unchanged.
- A failed video metadata check preserves the previously cached list.

## Test checklist

1. Confirm existing itinerary and photo gallery works before and after updating Apps Script.
2. Register a Drive video as admin and verify it appears under **Waybook Family Videos**, not at Drive root.
3. Confirm the folder remains **Restricted**, then share only with invited Google accounts as Viewers.
4. Open Waybook without **Waybook administrator** login on an invited family device; check that the event shows the video. Try Play and **Open in Google Drive** fallback.
5. Try the same Drive video link using a non-invited account: permission denied. If the video plays publicly, stop and review Drive folder and file permissions before using real family footage.
6. Reopen Waybook with no changes: metadata from cache displays, photo downloads don't restart.
7. Upload and register a replacement video: family device checks the video-index version on next event opening and shows the new ID.
8. Android Back or on-screen close returns from the cloud player to the event. iPhone edge swipe remains an unverified separate pilot; use the close control.

## Rollback

The backend uses a **new separate file** `waybook_video_index.json`; it doesn't change the existing `waybook_snapshot.json` format. Restore the previous Code.gs from your backup and redeploy a New version on the same deployment if needed. Restore the previous StopDetailSheet.tsx and DriveVideoUploadPilot.tsx; remove CloudVideoGallery.tsx. The Drive video/index files remain unless manually deleted.

## Known limitations

- No built-in Drive ACL management: share the dedicated video folder manually once.
- Video streaming may be restricted within cross-site iframes on some mobile browsers; Google Drive link fallback is essential.
- Video metadata only, not bytes, is cached; Drive may still transfer data on repeated playback.
- One published video per event. Registration can replace a prior reference without deleting the previous Drive file.
- Apps Script must run as the file owner for moving the v15.3A test file into its subfolder.
- Test with family accounts before publishing sensitive media. No paid hosting is involved, but Google storage and usage quotas apply.
