# 台湾2026 · Waybook v13 — Safe JSON Import/Backup + Cross-day Events

Small patch against the current GitHub Waybook version **after v12 cloud photo caching**. Apply exactly the three files in `src` to the existing repository. Preserve `google-apps-script/Code.gs`, `src/utils/cloudCache.ts`, vite config and the current PWA icon.

## Functions
- Move a stop to another day: retain its stable ID, uploaded photo references and gallery.
- Copy a stop to another day (or the same day): create a unique ID and reuse existing cloud photo file references without uploading them again.
- JSON Export remains a *portable itinerary-only* format for ChatGPT editing.
- New `Full Backup + Photo References` JSON includes a `format` marker, itinerary and `galleries` mapping of event IDs to Google Drive photo IDs. **The JPEG bytes are NOT embedded in JSON.** Make a separate backup of the Waybook Drive folder for true media recovery.
- Import now previews the count of moved/added/removed events and requires an explicit confirmation. It blocks imports that remove IDs currently associated with photos and rejects missing/duplicate IDs.
- Cloud publishing retains existing photo references for untouched galleries, including photos not completely downloaded to the phone. Editing a gallery still allows intentional remove/change.
- Deleting a photo-bearing event warns about disconnecting its images.

## Installing
1. Extract this patch. Copy `src/` over `src/` in the current GitHub Desktop repository, replacing only matching files.
2. Expect exactly three changes: `src/App.tsx`, `src/components/ItineraryEditor.tsx`, `src/components/ShareImportSheet.tsx`.
3. Commit `Add safe JSON backup and cross-day event transfer`, Push origin and verify GitHub Pages deployment.
4. On Windows admin browser, publish/sync and EXPORT both JSON files **before testing any destructive edits**.

## Test plan (use a disposable test event, not your real itinerary)
1. On Windows, confirm original photo-bearing stop is visible; export `Full Backup + Photo References` and save it independently.
2. In Edit, move the test stop to a different day and verify the same photo is available; publish; reopen on phone.
3. Copy the test stop to another day. It must have a new ID, independent details and the referenced planning photos; publish and reload on phone.
4. Export itinerary JSON, adjust **only the title/time/day** in a text editor, keep IDs unchanged, upload to the JSON tab. See preview before confirming. Publish, verify photos remain.
5. Test a modified JSON that deletes an ID of a photographed event. Import must BLOCK it.
6. Verify a phone with partly cached photos cannot delete photo links simply by publishing an unrelated edit.
7. Check original gallery, weather, PWA installation, sounds and automatic sync.

## Limits / cautions
- Existing Google Drive photos remain in the existing Drive folder. Removing an event may remove its link from published itinerary but not necessarily the actual file.
- Full Backup JSON does not contain media bytes. Imported photo references are only usable if those Drive file IDs still exist and are accessible through the current backend.
- App import changes local admin state first. Family devices see changes only after administrator presses Publish.
- This patch has passed TypeScript parse/transpile checks, but has NOT been end-to-end tested in GitHub Pages/Google Apps Script. Keep your existing backup before applying.
- Video clips and separate Memories gallery are intentionally deferred to a later phase.
