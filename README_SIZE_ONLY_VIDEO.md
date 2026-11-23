# Waybook — Size-only video limit + full-view player + phone Back improvements

**Base:** Live successful run #22. This new patch replaces the *uninstalled* 20-second patch. Apply only this patch.

## Features
- **No duration limit.** One local video per event. Maximum **25 MB after optional compression**.
- Files <=25 MB retain their original quality and sound.
- Larger files attempt device-local 720p encoding with sound, only where supported. May take approximately real-time; long videos can take a long time. If the browser cannot compress with audio or output remains >25 MB, the user sees an error. The original file is not modified.
- Play opens a full-view overlay, fit/contain, with playback controls; tap close or use Android Back to close.
- Android PWA Back aims to close photo/video/event overlays before leaving itinerary; platform dependent.
- Photo memory gallery and existing six UI sounds preserved except Back integration.

## Install
Copy the `src` folder into your current GitHub Waybook repository, preserving directory structure. Changed/new files:
- `src/components/MemoryClipPilot.tsx`
- `src/utils/compressVideo.ts` (new)
- `src/components/StopDetailSheet.tsx`
- `src/components/MemoryGallery.tsx`
- `src/components/DaySelector.tsx`

Commit and Push. No Google Apps Script changes.

## Test
1. Open existing short video (unchanged video data), check sound/full view.
2. Upload a 30–60 second video under 25 MB; verify accepted and playable after restarting PWA.
3. Try an over-25 MB video; if browser supports compression, verify smaller result and retained audio.
4. Verify Android Back closes video viewer, then event, then returns to prior day.
5. Confirm memory photos, captions, and sounds are intact.

**Important:** Video remains device-local. It is not synced to Google Drive, not available to family, and not included in JSON backups. Keep original files. The 25 MB limit is per video, **not a shared cloud quota**. Long videos may require significant on-device encoding time.
