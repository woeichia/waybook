# Waybook v15.1 — Memories Wall UI

This patch redesigns **旅途回憶 / Memories** only.

## What changes
- Keeps **行程參考 / Event Photos** unchanged.
- Changes **Memories** into a horizontal overlapping photo-frame wall.
- The centered frame is highlighted with a subtle lifted motion.
- Tap a frame to enlarge it full-screen.
- Preview images use `object-fit: contain` to avoid cropping faces.
- Caption editing, set-cover and delete actions are moved to the selected-photo panel below the gallery.

## Files
- `src/components/MemoryGallery.tsx`

## Install
1. Back up the current working version.
2. Copy `src/components/MemoryGallery.tsx` into your GitHub repository, replacing the existing file.
3. Commit with: `Improve memories gallery wall UI`
4. Push to GitHub and confirm Actions succeeds.

## What to test
1. Existing event/reference photos remain unchanged.
2. Memories show as overlapping horizontal frames.
3. Swiping left/right changes the highlighted frame.
4. Tapping a frame opens full-screen viewer.
5. Wide group photos no longer crop people in the preview.
6. Admin can still edit caption, set memory cover, and delete a memory photo.
