# Waybook — Postcard (Style C) PWA icon patch

Copy `public/` files and `index.html` into the root of your current Waybook GitHub repository, replacing existing files. This patch changes only the PWA icon assets and the browser tab icon reference. It does NOT change app name, functionality, manifest, cloud sync, photos, weather, or React code.

Icon files:
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`
- `public/apple-touch-icon.png`
- `public/favicon-64.png`

To rename the app later, edit `vite.config.ts` VitePWA manifest `name` and `short_name`, and `index.html` `apple-mobile-web-app-title` and `<title>`. Update `og:title` if desired. Then commit and push. App reinstall may be necessary for new name/icon to appear.

Do not copy the README file unless wanted.
