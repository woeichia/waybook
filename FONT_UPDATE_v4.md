# Font update v4

- Replaced Zhi Mang Xing with **Noto Sans TC** for Chinese headings and all body copy.
- Traditional Chinese-friendly fallbacks: Microsoft JhengHei (Windows), PingFang TC (Apple).
- Kept the existing `.font-calligraphy` class as an alias to avoid breaking components.
- No itinerary data or images changed from v3.
- This version loads Noto Sans TC from Google Fonts when online and falls back to installed system fonts if unavailable.
