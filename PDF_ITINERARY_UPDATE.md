# Waybook — PDF itinerary edition

Source: `Taiwan_Family_Trip_2026 (1).pdf`, five pages.

- Dates: 5–13 December 2026, nine days.
- Party: 2 adults + 1 child, as specified on page 1 of the PDF.
- Chartered car: 6–8 December; departure 09:00 each day.
- Accommodation: Taipei 5 Dec, Fengjia 6–7 Dec, Taipei 8–12 Dec. Hotel names are not specified in PDF.
- 7 Dec: Cingjing then optional Puli; dinner at Umai at 19:00/19:30 (booking not confirmed). No Sun Moon Lake.
- 8 Dec: Shifen Waterfall, Shifen Old Street, Jiufen, back to Taipei.
- 9 Dec: Zoo, Maokong, couple's dinner at Xiang Se 18:00–21:00.
- 10 Dec: Children's Amusement Park; Science Centre OR Astronomical Museum optional.
- 13 Dec: 05:00 private airport transfer, 08:25 flight.

The itinerary is updated in `src/data/taiwan_pdf_itinerary.json`, imported as the app default by `sampleTrip.ts`. Every activity has a stable identifier, a local bundled image, map search query, time, notes, and category. Images are illustrative from existing bundled assets; they are not proof of bookings or hotel locations.

The app now uses a new browser storage key for this PDF edition so old locally saved sample trips do not obscure the updated itinerary in AI Studio. The old storage entries remain in the browser untouched. Subsequent edits are stored locally under the new key, not synced across devices.

Confirm before departure: Gaomei tide/boardwalk opening, Umai booking and branch, Xiang Se booking, and Taipei hotel's luggage-storage policy.
