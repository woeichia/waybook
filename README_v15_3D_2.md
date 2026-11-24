# Waybook v15.3D.2 — simplified video card and unobstructed viewer

## Changes
- Return to the original Google Drive embedded preview player from v15.3B.
- Remove the green v15.3D chunk-download test UI and its repeated-download path.
- Replace the text-like video button with a 16:9 event-cover photo card, with a centered Play icon.
- Keep close controls in a separate top header rather than floating on top of the player.
- Reserve a distinct area for Drive playback and a bottom fallback link.
- Keep existing admin registration, private Drive permissions, video index caching and family password infrastructure unchanged.

## Install on existing Waybook
Copy ONLY these two files to your current repository, preserving directories:
- src/components/CloudVideoGallery.tsx
- src/components/StopDetailSheet.tsx
Commit 'Simplify Drive video viewer and add preview card' and push. Check GitHub Actions deployment.
No Apps Script Code.gs changes and no Google Cloud setting changes.

## Important limitations
- The card uses the EVENT COVER PHOTO as a provisional thumbnail, not an actual still frame from the video. A true video thumbnail requires a separate thumbnail-generation and publishing feature.
- Google Drive controls the iframe's video overlays and playback UI. Waybook can avoid covering the iframe with its own Close button, but cannot remove Google Drive's built-in overlays or guarantee uncropped playback on all phones. For native controls a different authenticated video delivery design would be needed.
- Google Drive still enforces its own file permissions. The Waybook family password alone does NOT grant access to restricted Drive files. Test on a separate unprivileged account before claiming no-Google-login family viewing.
- The old experimental src/utils/privateDriveVideo.ts can stay unused in the repository. Do not delete or change the v15.3D Code.gs as part of this patch; keeping it helps rollback.
- Video bytes are not locally cached by Waybook; Google Drive controls streaming and its browser cache.

## Testing
1. Open a registered video event. Expect image-cover card with centered Play icon.
2. Tap Play: Google Drive video appears in a full-screen dialog with Waybook Close ABOVE it, not over it.
3. Play, rotate screen, close, Back, reopen.
4. Test as admin, then as family member with only Waybook access; if Drive prompts Google login, this is the outstanding access-control limitation, not a patch failure.
5. Verify memories photos, admin registration, and publishing still operate normally.

This patch has been checked for TypeScript/TSX parsing and ZIP integrity, but not built in the full project or tested on mobile.
