# The Gilt Recipes (Netlify)

A recipe blog for The Gilt Butchery. It has recipes for each pork cut, likes, star ratings, public comments and private feedback. There is also a password-protected kitchen admin page.

## What's inside

```
public/                 static site
  index.html            home: cut chart, "New & updated", recipe grid, feedback form
  recipe.html           recipe page (served at /r/<slug>)
  admin.html            kitchen admin (recipes, comments, feedback)
  assets/               css, js, favicon
    loader.js           the Gilt Butchery loading screen (generated, see below)
netlify/functions/      API (Netlify Functions v2)
  recipes.mjs           /api/recipes        list / read / create / edit / delete
  engage.mjs            /api/engage         likes, ratings, comments
  feedback.mjs          /api/feedback       private notes to the owner
  img.mjs               /api/img            recipe photo upload + serving
  feed.mjs              /feed.xml           RSS of new and updated recipes
netlify/lib/            shared helpers + 6 starter recipes (seeded on first visit)
single/                 builds the one-file version: python3 single/build.py
tools/pig_qr.py         makes the packaging QR (the dots draw a pig face)
tools/pig_chart/        rebuilds the cut chart from reference.jpg (the parts-of-a-pig picture)
tools/loader/           rebuilds assets/loader.js from the traced drawing
```

All data lives in **Netlify Blobs**, so there is no database to set up.

## Cut chart

The home page chart is traced from `tools/pig_chart/reference.jpg`: head, jowl, neck, shoulder, picnic, hocks, back fat, loin, ribs, bacon (belly), leg and ham. Each zone is clickable and keyboard-focusable, shows how many recipes it has (a gold number), fades when it has none yet ("coming soon"), and filters the recipe grid. Both hocks are one cut ("Hocks & Trotters") and light up together.

Cuts are defined twice and must match: `G.CUTS` in `public/assets/app.js` and `CUTS` in `netlify/lib/shared.mjs`. Recipes saved before the change keep working (`shoulder`, `loin`, `ribs`, `belly`, `leg`, `trotters` are unchanged). New cuts appear in the admin Cut menu automatically. To regenerate the artwork:
```bash
pip install numpy pillow scipy scikit-image
python3 tools/pig_chart/build_chart.py     # writes tools/pig_chart/chart.svg.html; paste its <svg> into index.html
```

## Loading screen

`public/assets/loader.js` plays the line-drawing story (farmer and pig, farmer eating, then the wordmark) on the **home page, once per browser session**. Moving between recipes and back does not replay it. It lifts when the recipes have loaded and the story has finished (about 14 s). A **Skip** button lets visitors leave early, and reduced-motion visitors get a near-instant version.

- Timings live in `CONFIG` at the top of `tools/loader/loader.template.js`. Rebuild with `python3 tools/loader/build_loader.py`.
- `home.js` calls `GiltLoader.done()` once the recipes have loaded. A 25 s safety timer lifts it if the API never answers.
- The markup is the `#loader` block in `index.html` (between the `loader:head` / `loader:body` comments) and its CSS is at the end of `style.css`. The single-file build includes all of it.

## Deploy (about 5 minutes)

Functions need a Git deploy or the CLI. Drag-and-drop deploys do not run functions.

**Option A: GitHub**
1. Push this folder to a new GitHub repo.
2. In Netlify, go to **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml`.
3. Go to **Site configuration → Environment variables** and add `ADMIN_KEY` = a long secret (12+ characters). Scope it to Functions.
4. Redeploy. Rename the site in **Site configuration → Site details** (for example `thegiltbutchery` gives `thegiltbutchery.netlify.app`).

**Option B: CLI**
```bash
npm install
npx netlify-cli login
npx netlify-cli init            # create the site
npx netlify-cli env:set ADMIN_KEY "your-long-secret"
npx netlify-cli deploy --prod
```

## Owner's guide

- Open `https://<your-site>/admin.html` and enter the `ADMIN_KEY`.
- **New recipe**: fill the form. Put one ingredient per line and one step per line. Photos are resized automatically before upload.
- **Editing**: type a short note in "What changed?". Customers then see an **Updated** stamp, the note under the title and in "New & updated", a "since your last visit" banner, and an entry in Recipe history and the RSS feed. Tick **Small fix only** for typos so customers aren't notified.
- Untick **Published** to keep a recipe as a draft.
- The six recipes marked **Starter recipe** are written as a starting point. Edit them into your own (or delete them) before launch.
- **Comments** tab: read and delete comments. **Feedback** tab: private notes and ratings from customers.

## Single-file version

`the-gilt-recipes.html` (from `python3 single/build.py`) is the whole blog in one HTML file, with the starter recipes built in.
- Opened from a phone/computer or hosted anywhere without functions, it runs in **preview mode**: likes, ratings and comments are saved on that device only (a note says so).
- Uploaded next to this Netlify project, it automatically uses the live API, so everything is shared.
- For the real blog (owner admin, shared comments, photos, RSS) deploy this whole project.

## Packaging QR (one code only)

`Gilt-Pig-QR.png` is the only QR. Its dots draw a pig's face. Each module's centre carries the data, and the ring around it paints the pig. It opens `https://thegiltbutchery.netlify.app/?src=qr`, so **name the Netlify site `thegiltbutchery`**. If that name is taken or you use your own domain, regenerate it:
```bash
pip install segno pillow
python3 tools/pig_qr.py "https://<your-address>/?src=qr" Gilt-Pig-QR.svg
```
Print it at least 3 cm wide on white, and test-scan a printed proof before the full run.
