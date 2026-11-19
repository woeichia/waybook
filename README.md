# Waybook PWA name patch — 台湾2026

Changes only the installed PWA name and website/browser title.

1. Copy `vite.config.ts` and `index.html` to the root of your existing `waybook` GitHub repository, replacing matching files.
2. In GitHub Desktop, commit (`Name PWA 台湾2026`) and **Push origin**.
3. Confirm GitHub Actions deployment succeeds.
4. On phone, remove the old installed Waybook shortcut/app and reinstall if the old name persists. Before doing so, ensure unpublished local edits are backed up or published; reinstalling can affect local data.

This patch does not include any icon images. Apply the Style C postcard icon patch separately if you have not already done so.
No change to Google Drive backend, OAuth, photo gallery, itinerary, sounds or sync.
