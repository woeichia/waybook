# Waybook v8 — Postcard Page Turn test

## Source
Built directly from AI Studio–corrected `waybook (8).zip`, not from the earlier 3D Flip + Enlarge test ZIP.

## Changes
- `src/components/StopCard.tsx`: measure the whole event card when its image or text is tapped; pass the card rectangle into the motion controller. Adds a stable marker for the close animation.
- `src/App.tsx`: manage the opening and closing animation, then render the unchanged StopDetailSheet.
- `src/components/PostcardPageTurn.tsx` (new): visual postcard overlay that lifts and rotates on its vertical edge, grows to a larger card, then yields to the existing detail view. Closing reverses the motion. Uses reduced-motion preference.

No change to itinerary data, photos, sound utilities, Google Drive backend, JSON import/export, existing detail view, styling or fonts.

## Test checklist for AI Studio
1. Open an activity using its photo, and again using its title. Both should show the postcard opening effect and open details.
2. Close with the X and by tapping the overlay. Confirm the return animation targets the same event card.
3. Scroll well down the day before opening a card. Confirm the turn originates from the correct card location.
4. Test small-screen preview and device orientation changes.
5. Swipe and enlarge gallery photos and verify photo changes remain saved.
6. Confirm existing sound toggle, button/day/gallery audio, JSON import and Cloud panel are unaffected.
7. Verify the sound diagnostic test panel stays removed.
8. Test with operating system reduced-motion turned on.

## Verification limits
- ZIP archive checked. TypeScript TSX transpilation diagnostics passed for all three affected files.
- Full `npm install` timed out in this execution environment, so `tsc --noEmit`, Vite production build, and live AI Studio preview have NOT been independently completed. Please run compile/lint and inspect the live preview in AI Studio.
