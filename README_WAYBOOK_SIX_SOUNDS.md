# Waybook — Six Sounds (v15.1 audio refinement)

This is a **front-end-only** change based on the currently working v15.1 Memories Wall. No Google Apps Script, Google Drive, or itinerary JSON changes are required.

## Six sound types

1. **tap** — softer paper tap for ordinary button actions.
2. **navigate** — familiar two-note transition when changing itinerary days.
3. **slide** — light paper slide on photo movement / gallery navigation.
4. **pickup** — subtle lift/flick when the centered Memories frame settles after moving.
5. **whoosh** — airy opening sound when a Memories frame is expanded.
6. **confirm** — warm two-note confirmation when enabling sound.

These sounds are generated with browser Web Audio. No external audio assets, API, or fees. The existing app-wide sound enable/disable setting is respected.

## Installation

1. Save a copy of your current working `src/utils/uiSounds.ts`, `src/components/MemoryGallery.tsx`, `src/components/StopDetailSheet.tsx`, and `src/App.tsx` (or create a Git commit checkpoint).
2. Extract this patch ZIP into your **current Waybook repo root**, keeping the `src/` folder paths.
3. In GitHub Desktop, verify **only four files** changed:
   - `src/utils/uiSounds.ts`
   - `src/components/MemoryGallery.tsx`
   - `src/components/StopDetailSheet.tsx`
   - `src/App.tsx`
4. Commit `Refine six Waybook UI sounds` and Push origin.
5. Confirm the GitHub Actions build/deploy succeeds, then refresh the PWA (relaunch if cached).

## Suggested acceptance test

- Enable sound and confirm the warm chime.
- Tap an ordinary button: a quiet paper tap, not the original sharp click.
- Switch itinerary days: hear the two-note navigation.
- Browse existing event/reference gallery: photo-slide sound, no UI changes.
- Swipe or use arrows in Memories Wall: slide, then a very subtle frame pickup once the centered photo settles.
- Tap a Memories photo or `查看大圖`: airy opening whoosh, **not** a simultaneous general button click.
- Test cover, caption and delete controls, which should still work.
- Disable sound: verify all sounds are muted.

## Known limitations

Sound quality and autoplay restrictions depend on the phone/browser. Browser audio may be suspended before the first user interaction. Existing visual photo motion is not changed. No changes to videos or backend.

## Verification

The four modified files passed a TypeScript syntax parse, and `uiSounds.ts` passed a standalone TS type check. A complete Vite build could not be performed in this environment because the project dependencies were not available offline. GitHub Actions is the final build gate.
