# 台湾2026 PWA installability fix

Replace only `vite.config.ts` in the root of the GitHub waybook repository. This changes PWA manifest icon URLs from domain-root paths (`/pwa-...`) to manifest-relative paths (`pwa-...`). On GitHub Pages these resolve to `/waybook/pwa-...`.

Preserves app name 台湾2026, base path, all other PWA settings, and all application features.

Commit and push in GitHub Desktop; verify Actions deployment. In normal Chrome (not Incognito) check `https://woeichia.github.io/waybook/manifest.webmanifest`, which should have icon URLs relative to `/waybook/`. If previously installed, uninstall first only after checking your unpublished local edits.
