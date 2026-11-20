# 台湾2026 — v12 phone photo cache fix

## What this fixes
- Previously the mobile PWA kept cloud photos only in React memory, so each cold launch re-downloaded every photo.
- A cold launch also ran a foreground cloud reload regardless of whether anything changed.
- This patch stores the last published snapshot and photos in IndexedDB on each device, loads them locally before checking cloud, and silently skips reapplying an unchanged cloud version.
- Only genuinely missing photos are fetched, in batches of 3. The background refresh does not block the normal reader experience.

## Apply on top of the CURRENT GitHub repo (after your v11/weather, postcard icon, 台湾2026 name and PWA path fix)
Copy ONLY these two files to the matching paths, keeping all other files as they are:

- src/App.tsx (replace)
- src/utils/cloudCache.ts (new)

In GitHub Desktop you should see exactly two changed/added files. Commit `Cache published itinerary and photos on phone` and Push origin. Confirm Actions succeeds.

No change to vite.config.ts, manifest, icons, Google Apps Script, or OAuth.

## Acceptance checks
1. On Windows publish one test photo. On phone, reopen PWA while online and allow one initial sync.
2. Force close/reopen phone PWA: gallery photos should appear from phone storage without redownloading everything or requiring Reload.
3. Reopen with airplane mode: the last successfully cached itinerary/photos should still show (weather/external maps require internet).
4. Publish a new picture from Windows, restore phone connectivity/reopen: only the newly published image should download; older photos remain visible.
5. With no new publication, leave and reopen the app several times: no full photo refresh.
6. Confirm editor, publish, weather, sounds, postcard motions still behave normally.

Note: the browser/OS can evict site storage when space is low. A reinstall or clearing site data removes the cache; the app will recover from the cloud upon the next connection. This is a caching fix, not a permanent offline backup or access control system.
