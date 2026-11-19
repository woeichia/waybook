# Waybook — Update 1 (18 November 2026)

## Included
- Full Traditional Chinese UI font: **Noto Sans TC** for headings and body text. Fallbacks: Microsoft JhengHei and PingFang TC. Zhi Mang Xing was removed due to incomplete glyph display.
- Fixed photo paths: bundled images now reside in `public/images` and itinerary refers to `/images/...`. `SmartImage` also supports previously saved legacy `/src/assets/images/...` paths.
- New **編輯行程** button: update trip title, dates, traveller count, cover image URL, day title/date, each stop's time/category/title/description/location/Google Maps query/transit/image URL. Add, duplicate, reorder, or delete stops.
- Upload a stop photo from the editor, compressed and stored in the current browser.

## Preview
1. Import the ZIP project into Google AI Studio's app development environment.
2. Open the preview. Tap **編輯行程** above the timeline controls.
3. Select a day, edit fields, tap 完成.
4. Click Share / Import to export an updated itinerary JSON/share link when needed.

## IMPORTANT limitations
- Edits and manually uploaded photos are saved to the browser's **localStorage** ONLY. They DO NOT sync to family devices and are not protected by admin authentication.
- Anyone with the app can open the editor. Don't put private personal details in this version or send it to others as if it were read-only.
- Share links are snapshot links, not a permanent synced trip. Custom uploaded photos are NOT embedded in the exported itinerary or shared snapshot.
- Bundled local photographs are included in the site build but a manually uploaded new photo is not automatically added to the published source archive.
- Google Fonts requires an internet connection initially. There are no font files included.
- The sample trip remains unchanged, including a possibly inaccurate 12:30 PM arrival and travellers=3. Please correct using the editor after reviewing actual travel arrangements.
- This patch has passed TypeScript/TSX parsing checks but a full dependency-based Vite build was **not** possible in the editing environment. Confirm functionality via AI Studio preview.

## Future family sync options
**Recommended:** Supabase backend with a `trip` data record, `stops` collection, protected owner editing, and cloud photo storage. Alternative: Google Apps Script web endpoint serving/storing JSON in Google Drive, but requires identity enforcement, safe write permissions, and conflict protection. Avoid making a public writable Google Apps Script endpoint or placing a master password/API secret in frontend code.
