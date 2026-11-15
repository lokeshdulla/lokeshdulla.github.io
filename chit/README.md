# ChitBook – chit fund manager

Single-admin, client-side app. No backend; all data lives in the browser's `localStorage`.

## Files
- `index.html` – page structure
- `style.css` – mobile-first styles (auto dark mode)
- `script.js` – all logic

## Deploy to GitHub Pages
1. Create a GitHub account and click **New repository** (e.g. `chitbook`). Public is fine; Pages on private repos needs a paid plan.
2. Upload `index.html`, `style.css`, `script.js` to the **root** of the repo (use **Add file → Upload files**, then **Commit changes**).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, set Source = **Deploy from a branch**, Branch = **main**, folder = **/ (root)**, then **Save**.
5. Wait 1–2 minutes. Your app will be live at `https://<your-username>.github.io/chitbook/`.
6. On your phone: open the link, then **Add to Home Screen** for an app-like icon.

To update later, upload the changed files again and commit.

## Important notes
- Data is stored per browser, per device, per URL. Another phone or browser starts empty.
- Clearing site data / browsing history, or using private mode, erases the data. Use **Download backup** often and **Restore backup** to move data to another device.
- There is no login. Anyone who opens the link on your phone can see the data. Keep the phone locked, and don't share the backup file.
