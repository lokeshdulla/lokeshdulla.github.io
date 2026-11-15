# Boys' weight-for-age Z-score calculator (0–5 years)

Static site (HTML, CSS, vanilla JS). No backend, no build step.

## Files
- `index.html` – page structure
- `style.css` – responsive, light/dark styling
- `script.js` – WHO LMS data, Z-score maths, chart, form logic

## Deploy to GitHub Pages
1. Create a new repository on GitHub (e.g. `growth-tracker`), set to Public.
2. Upload `index.html`, `style.css`, `script.js` (and this README) to the repository root.
   - Web: **Add file → Upload files**, then **Commit changes**.
   - Or from a terminal:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/<your-username>/growth-tracker.git
     git push -u origin main
     ```
3. In the repository go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/growth-tracker/`.

To test locally, just open `index.html` in a browser.

## How it works
Age is calculated from the date of birth (to a chosen weighing date, default today). The WHO L, M, S values for that age are interpolated, and
`Z = ((weight / M)^L − 1) / (L × S)`, with the WHO adjustment beyond ±3 SD. Percentile comes from the normal distribution.

Cut-offs: below −3 severely underweight, −3 to −2 underweight, −2 to +2 normal, above +2 above normal range.

## Disclaimer
A screening aid, not medical advice.
