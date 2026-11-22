# 台湾2026 / Waybook v14 — Smart Schedule Planner (Phase 1)

## What this update does

The **Move to another day / Copy to another day** operation now opens a scheduling preview instead of instantly appending the event with its old time. It supports:

- Destination day and insertion position.
- Day start and end times (charter days default 09:00–19:00, other days 09:00–21:00; all editable).
- Transfer time, activity duration and buffer per stop.
- Optional fixed-start activities (e.g., reservations), including timing conflicts.
- Warning when the result ends after the day limit, and confirmation before saving conflicts.
- Preservation of original stop IDs when moving, unique IDs when copying and existing photo callbacks from v13.
- Saving selected durations / transfer estimates in each itinerary stop's optional `schedule` field, including JSON validation/import-export compatibility.

This is an **estimate-based scheduling assistant**, NOT actual driving time routing. It cannot know traffic, opening hours or realistic distances unless you enter and verify those values. Unverified durations are explicitly marked; the app never deletes an activity for you.

## Install

1. Make a full cloud/JSON + photo backup before any update.
2. Extract the ZIP at the root of your existing `woeichia/waybook` repository, replacing matching paths only.
3. Exactly **4 files** should be changed/added:
    - `src/components/ItineraryEditor.tsx` (modified)
    - `src/types/itinerary.ts` (modified)
    - `src/utils/itinerary.ts` (modified)
    - `src/utils/schedulePlanner.ts` (new)
4. GitHub Desktop: Commit `Add smart schedule preview to cross-day transfers`, Push origin, verify Pages workflow succeeds.
5. Don't overwrite `src/App.tsx`, `google-apps-script/Code.gs` or photo cache code; this patch does not include them.

## Acceptance test (do not publish first)

1. Open Day 3 → 編輯我的旅程 → expand 清境農場 → 移動到另一天.
2. Choose Day 4 and insert **after 逢甲退房出發**.
3. Preview must show recalculated start/end times, including the time needed to reach the next attraction (initially 30 minutes marked unverified).
4. Edit transfer to/from 清境 manually to realistic values; confirm a warning if the end exceeds 19:00.
5. Mark a restaurant or other booked activity as **固定開始時間**; force a collision and confirm that the planner warns.
6. Cancel: no events should move, and original photos remain.
7. Repeat and confirm. Check all event IDs, pictures and activity order. Test move-back and copy with new ID separately.
8. Export JSON, import it, check the new `schedule` fields survive, and verify all photos before publishing.
9. Check the installed PWA, weather, cloud sync and gallery remain functional.

## Cautions

- Existing human-readable time strings often lack durations. They receive **category-based placeholders** (15–60 min) that you must review.
- Travel defaults to **30 minutes per leg**, explicitly marked unverified. This is NOT an actual route estimate. Very distant attractions can be hours apart.
- For every insertion, the incoming leg and next leg are marked unverified even if old route inputs existed, because the sequence changed.
- The destination-day itinerary is re-timed when you confirm. Fixed-start activity `time` text remains unchanged, and overlaps show as warnings. Recheck reservations, routing, and location opening hours manually.
- Move affects destination-day event times but does not re-time the old/source day; review the source day too.
- Cloud publish remains manual. Do not publish a trial schedule until satisfied with it.

## Verification performed

- Transpilation syntax checked using TypeScript for all four files.
- Planner engine compiled to JS and tested with a case inserting 清境 into Day 4; it warned correctly when projected end exceeded the 19:00 charter limit.
- Full Vite production build unavailable because repository dependencies were not installed here. The GitHub Actions build and phone testing are still required.
