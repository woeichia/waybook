# Waybook — Memory Wall Audio Reliability Fix

## Replace only these two files

- `src/components/MemoryGallery.tsx`
- `src/utils/uiSounds.ts`

Keep the existing `App.tsx`, `StopDetailSheet.tsx`, the backend and all photos unchanged.

## Fixes

- The memory slide and pickup effects are louder and longer to be audible on typical phone speakers.
- On touch, audio is primed during the pointer gesture so iOS PWAs can play delayed sounds.
- The memory gallery watches the actual scroll movement (including native touch inertia) and plays pickup once after a new centered photo settles.
- The scroll event listener no longer gets recreated on every highlighted-card change.
- Existing sound toggle, event photo gallery, full-screen viewer, cloud sync and captions are unchanged.

## Deploy / verify

1. Back up the current working Waybook repo.
2. Copy the two files into the same paths in your repository.
3. Commit `Make memories slide and pickup sounds audible` and Push.
4. Verify GitHub Actions succeeds.
5. On your phone, turn sound on and make sure system media volume is up. If using the installed PWA, fully close and reopen it to receive the latest service-worker update.
6. Open an event with at least two memory photos. Swipe so a different card becomes centered. Expect one audible paper slide and, after stopping, one pickup sound. Also test the left/right arrow buttons.

This patch does not change the server, Google Drive, or stored photo structure.
