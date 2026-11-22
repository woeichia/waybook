# Waybook v15 — Memories Photo Gallery (No Video Yet)

## Preserved baseline
This patch starts from the successful GitHub v14.1 source. Keep a copy/tag of the working commit **5b765a0f64952d3aaa23b42e90ae50ede19a2d6e** before changing anything. The working routing and itinerary code remains unchanged except the separate photo-memory integrations.

## What is included
- Existing planning/reference galleries remain stored in `galleries`, with the original 8-picture limit and current card covers.
- New `memoryGalleries` separately stores 12 photos per event, captions and an independent memory cover (first photo).
- Same Google Drive folder, same administrator-only publishing, family read-only views, phone cache, and unchanged Google Apps Script endpoint.
- Whole-backup JSON exports include memory photo file references and captions, but **not image bytes**. The original Google Drive files must still be preserved.
- Videos are **not** included: they belong to v15.1, after photo publication has been verified.

## Installation — follow in this order
1. In the live site, export **Full Backup JSON** (Share / Import). Also save the existing Code.gs to a text file and keep the existing v14.1 local repository copy.
2. Open your EXISTING Waybook Apps Script project and backup its exact live `Code.gs`. This patch's `Code.gs` is based on your last corrected v14.1 complete Code.gs, not a live-editor read. If you have made any further custom backend changes since, reconcile them before replacement.
3. Replace `Code.gs` with the complete `Code.gs` included in this ZIP. Do not add an extra `WaybookRouting.gs`; ORS routing functions are already included in this complete backend. Preserve existing script properties `FOLDER_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, and `ORS_API_KEY`.
4. Save Apps Script. Deploy > Manage deployments > Edit your existing Web App > New version > Deploy. Do **not** create a new deployment or change access permissions.
5. Copy the 7 `src/` files from this ZIP over the same paths in your GitHub Desktop local Waybook repository, including the two NEW files `src/components/MemoryGallery.tsx` and `src/utils/memoryGallery.ts`. Commit and Push.
6. Confirm GitHub Actions succeeds. Hard refresh or reopen the installed PWA to retrieve the new version.

## Safe tests
1. Open a stop with existing reference photos; confirm they still show in the event card and under **行程參考照片**.
2. Sign in as the administrator, open the stop, add **one** photo under **旅途回憶 · Memories**, add a caption, move it to the memory cover. The reference cover should not change.
3. Before publishing, verify the new memory photo only appears on your device.
4. Publish to Google Drive, then open the website in another browser or a family member's phone (read-only), check the memory photo and caption, and check the reference photos were not changed.
5. Close and reopen the PWA: memory photo should load from cache if available; captions and references should remain.
6. Export a full backup and confirm `memoryGalleries` exists with file IDs/captions. Do not expect binary files in JSON.
7. Test move/copy event, confirm the existing ID or copied memory refs follow the intended event. Do not publish destructive tests.

## Limitations / privacy
- Up to 12 memory images per stop; each upload is compressed to fit the backend's 650 KB compressed image maximum, though some images may still exceed it. If upload fails, retry a smaller image.
- Existing backend is publicly readable for published media; anybody with the URL may retrieve photos if they know the published references. Do not post private/sensitive family images until access controls are redesigned.
- The app only allows the signed-in admin to edit and upload. Family members remain viewers.
- This patch was syntax-checked, but not tested against your actual Apps Script deployment or private Drive files.
- For reliable rollback, retain v14.1 source AND your pre-v15 backend Code.gs.
