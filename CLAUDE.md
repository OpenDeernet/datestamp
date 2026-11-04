# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**DateStamp** – a free web tool that puts the date on photos (the orange "film camera" date, a white one or a label), with a second tool on its own page that changes the date taken saved in the photo's EXIF (nothing printed, a JPEG not re-encoded). It runs **entirely in the browser**: there is no backend, photos never leave the device, and that privacy is part of the pitch. The site is static, hosted on **GitHub Pages**, earns its traffic from **SEO in many languages** and its money from **Google AdSense** in two side rails.

The owner talks to Claude in Polish; code, comments and commit messages are in English.

## Design

The approved design is the Claude Design canvas "DateStamp redesign" (https://claude.ai/artifact/5ZdGrBPuf34nr7SM2fbS6n, private to the owner): desktop and phone, empty and saving. Principles behind it, keep them:

- **Orange is the date.** The glowing orange is the product (the retro stamp) and the accent on primary actions; everything else is warm neutral. No gradients, emoji or decorative cards.
- **The tool comes first:** a one-line intro, then the editor above the fold. Settings are visible choices (style tiles with a preview, a corner picker on a photo), not dropdowns, except the format.
- **Usable by anyone:** 44 px targets in the editor, text contrast ≥ 4.5:1 (dark text on the orange buttons for that reason), states told apart by more than colour.
- Fonts are the system's (`system-ui`, `ui-monospace`): no web font to download.

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm run check     # astro check: TypeScript in .astro and .ts files (tests included)
npm run build     # check + static build into dist/
npm run preview   # serve dist/ locally
npm test          # Vitest unit tests (tests/unit)
npm run test:e2e  # Playwright against the built site (tests/e2e); builds first locally
npm run assets    # re-render public/ icons and public/og/*.png (see SEO below), then commit them
```

Node ≥ 22.12 (see `engines`). First time: `npx playwright install chromium`.

Astro 7 runs one dev/preview server per project and refuses a second (`Dev server already running … astro dev stop`); a stale one serves old code with "FailedToLoadModuleSSR". Stop it with `npx astro dev stop` / `npx astro preview stop`. The Playwright config passes `--ignore-lock` for that reason.

## Tests and CI

- **Unit (Vitest, `tests/unit`)**: date formats, the date shift and the redated file name (`shift.ts`), `fitPixels` (the iOS pixel cap), file filtering and unique names (`src/lib/files.ts`), and the translations: every locale has every key of `en`, no empty strings, the same number of FAQ entries/features/steps, placeholders kept, URL-safe and distinct paths.
- **End-to-end (Playwright, `tests/e2e`)**, on desktop Chrome and an emulated Pixel 7, against `astro preview` of the build: EXIF date and file-date fallback, the progress bar, dropping onto any part of the page, a non-photo file, remove/clear, saving every photo as its own full-size JPEG, the ZIP's contents, "done" going back to "ready" after an option change, per-language date formats and their memory, the change-date page (`exif.spec.ts`: a JPEG's picture untouched, the new date in its EXIF, set all and shift, HEIC → JPEG), every page in every locale answering, lang/title/hreflang/canonical, the language menu, the theme switch, no horizontal scroll, sitemap and ads.txt.
- Fixtures in `tests/fixtures`: `exif-landscape.jpg` (EXIF date 1998-07-14 18:30, 1200×800), two photos without EXIF, and a text file.
- The e2e build has fake AdSense and GA4 ids (`TEST_ADS_ENV` in playwright.config.ts, the same in ci.yml's build step), so ad slots and the cookie banner are tested as in production; `test` from helpers.ts blocks every request to Google's ad and analytics servers and pre-sets a rejected cookie choice (`test.use({ consent: null })` for the banner's own test).
- `useFileDownloads(page)` (tests/e2e/helpers.ts) removes the folder picker and the share sheet, so saving falls back to plain downloads that Playwright can catch.
- **CI** (`.github/workflows/ci.yml`) on every push to main and every pull request: `npm ci`, build (with `astro check`), unit tests, Playwright. The Playwright report is uploaded when it fails. **The deploy runs only after CI succeeded on main** (`workflow_run`), and deploys the commit CI tested.
- A change in the editor or on a page needs its test in the same change. Add an e2e test for a new behaviour, a unit test for new pure logic.

## Stack

- **Astro 7** (static output) – pages are plain HTML at build time, with almost no JavaScript besides the editor.
- **Vanilla TypeScript** for the editor (no framework); Astro bundles the `<script>` in `Editor.astro`.
- **exifr** – reads the photo's EXIF date. **libheif-js** – decodes HEIC where the browser cannot (lazy). **JSZip** – the optional ZIP, loaded with a dynamic `import()` only when needed.
- **@astrojs/sitemap** – `sitemap-index.xml`.
- **Tailwind CSS 4** (`@tailwindcss/vite`), styles in `src/styles/global.css`. Utilities in the markup; Tailwind scans `.ts` files too, so classes in the editor's template strings (`src/lib/editor.ts`) work.
- **Tailwind Plus Elements** (`@tailwindplus/elements`) for the dropdowns (`<el-select>`, `Select.astro`). It needs a Tailwind Plus licence (the owner's).

### Tailwind rules here

- **Semantic colours only:** `bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`/`text-accent`, `text-on-accent`, `bg-accent-soft`, `text-success`. They map to the CSS tokens in `@theme inline`, so the theme switch changes them all and there are no `dark:` variants. Never use raw palette colours for themed parts (`bg-white`, `text-gray-500`).
- **State styles are unlayered CSS** at the bottom of `global.css` (photo card states, progress finished/failed, theme highlight, ad breakpoints), keyed by `data-*` attributes. They must stay outside `@layer`: Tailwind's utilities layer beats any layered rule, so a state rule inside `@layer components` loses to the element's own utilities. That happened: the "ready" badge stayed visible because of its `flex`, and the "done" badge stayed dark because of `bg-black/70`.
- An inline `transform` set from JS (the progress fill) must not meet a Tailwind `scale-*` utility on the same element: Tailwind 4 uses the separate `scale` property, and the two multiply.
- `<el-select>` quirks: it has a `name` **attribute** but no `.name` property (read `getAttribute("name")`), it reads its `value` **attribute** when it starts (set the attribute, not only `.value`, or the start undoes it), and it fires `input` and `change` like a native select. Once it has started (Elements loads in the layout, so usually before the editor), a value set from code does not redraw its button: the editor writes the chosen label into `el-selectedcontent` itself. And do not read its options from the DOM at start-up (Elements may have moved them): the editor gets the offered formats from `data-formats`.

Dependencies are pinned to exact versions. Pick versions at least two weeks old (supply-chain caution), never a release from the last few days.

## Layout

```
src/
  pages/[...path].astro   ONE route that generates every page in every locale (getStaticPaths)
  components/
    Home.astro            landing page: hero, editor, features, FAQ (+ FAQPage JSON-LD), guide links
    Guide.astro           how-to page for a long-tail search (+ HowTo JSON-LD), editor included
    Editor.astro          static markup of the date stamp editor; passes its strings in data-strings
    ExifEditor.astro      the "change the date" editor: same columns, its own settings (one date for all, the shift)
    PhotoColumn.astro / SaveActions.astro   the parts both editors share: drop zone, progress, photo grid / save buttons
    ChangeDate.astro      the "change the date" page (`exif`): hero, ExifEditor, steps (+ HowTo), FAQ (+ FAQPage), a link to the stamp
    GuideLinks.astro      the list of guide links (home, every guide, the change-date page)
    Select.astro          a dropdown on <el-select> (only the format uses it)
    ExamplePhoto.astro    a CSS/SVG stand-in photo for the "how it looks" examples
    ThemeSwitch.astro / Flag.astro / AdRail.astro / InlineAd.astro / Privacy.astro
  layouts/Base.astro      <head>: title, description, canonical, hreflang, OG, manifest, WebApplication JSON-LD; header with language menu
  lib/
    stamp.ts              pure drawing: formatDate, drawStamp, renderStamped, fitPixels, canvasToJpeg
    photo.ts              photoDate (EXIF → file date fallback), decodePhoto, stampedFileName
    workbench.ts          what both editors share: picking/dropping files, cards and their states, the queue, progress, saving (folder/gallery/files/ZIP)
    editor.ts             the date stamp editor on the workbench: its options, stamped previews, stamped export
    exif-editor.ts        the "change the date" editor on the workbench: set all, shift, export with redateJpeg
    shift.ts              pure: shiftDate (clock time, days/hours/minutes), redatedFileName
    files.ts              pure helpers: droppedPhotos (the drop filter), uniqueName
    progress.ts           the progress bar (start/step/percent/finish/fail/hold)
    theme.ts              light/dark/system
    ads.ts                AdSense config from env, fillAds(), RAILS_MIN_WIDTH
  pages/404.astro         the page GitHub Pages serves for any missing address: every locale's copy, a script shows the path's (else the browser's) language; noindex, no ads
  pages/ads.txt.ts        ads.txt generated from the publisher id
  pages/robots.txt.ts     robots.txt (all crawlers, AI ones named) + sitemap
  pages/llms.txt.ts       llms.txt for AI assistants, generated from the strings
  pages/og/[locale].astro the share-picture layout, dev server only (npm run assets)
scripts/assets.mjs        renders the icon PNGs and the OG pictures with Playwright
integrations/sw.js        the service worker (offline use) as a template; service-worker.mjs fills it in after the build and writes dist/sw.js
  i18n/
    locales.ts            the locale list + default locale (imported by astro.config.mjs too)
    index.ts              strings map, t(), pages list, pathOf(), href()
    en.ts                 reference strings; every other <locale>.ts `satisfies typeof en`
public/                   favicon.svg, manifest.webmanifest (the sample photos are in src/assets/samples)
tests/unit, tests/e2e, tests/fixtures
.github/workflows/ci.yml       tests on every push and PR
.github/workflows/deploy.yml   GitHub Pages deploy, after CI passed on main
```

## How the editor works

Two editors share one base, `src/lib/workbench.ts` (`mountWorkbench`): adding and dropping photos, the cards and their states, the queue, the progress bar and every save mode. Each editor passes what differs: how a card's preview is drawn, the date label, the export, the file name, its settings fieldset and its statistics event. The date stamp editor (`editor.ts`) is described below; the "change the date" one has its own section after it. Markup: `PhotoColumn.astro` and `SaveActions.astro` are shared, the settings column is each editor's own.

1. The user picks photos (the zone opens a hidden `<input type="file" multiple>`) or drops them **anywhere on the page**: the drop listeners are on `document`, so a photo dropped beside the zone is not opened by the browser. The drop filter is lenient (an empty MIME type passes, as the macOS Photos app and HEIC in Chrome give none); a file the browser cannot decode gets the "cannot open" message.
2. `photoDate` reads `DateTimeOriginal` (or `CreateDate`) with exifr. Without EXIF (screenshots, photos from messengers) it uses `file.lastModified`, and the UI says so. Each photo has a `datetime-local` input to change its date.
3. `decodePhoto` = `createImageBitmap(file)`, which applies the EXIF orientation by itself. If that fails on a HEIC (name, type, or an `ftyp` HEIF brand in its first bytes: Chrome, Edge and Firefox cannot decode it), `src/lib/heic.ts` imports libheif (`libheif-js`, WebAssembly, ~2 MB, LGPL-3.0, its own chunk) at that moment and decodes it; the service worker does not precache that chunk. Fixture `exif-landscape.heic` (made from exif-landscape.jpg with macOS `sips`).
4. Each photo keeps only a **small preview canvas** (~0.6 MP) so changing an option redraws instantly. The full-size image is **decoded again on export** and then released, so an album never sits in memory at full resolution.
5. Export: `renderStamped` at full size (capped per device, see below; `fitPixels` rounds down so it never lands above the cap) → JPEG 0.95 → the EXIF put back.

### The saved photo keeps its quality and its metadata

- Full resolution: up to **100 MP** (`MAX_EXPORT_PIXELS`), except on **iPhone and iPad, 16 MP** (`SAFE_EXPORT_PIXELS`: iOS Safari refuses canvases above ~16.7 MP; `maxExportPixels()` spots iPadOS by its touch screen, as it reports a Mac). If the full size still fails (a browser's memory or own limit), the export retries at 16 MP rather than saving nothing. `tests/e2e/large.spec.ts` saves a generated 6000×6000 photo of ~10+ MB whole. JPEG quality **0.95**; outside the date the saved photo is within PSNR ≥ 40 dB of the original (tests/e2e/quality.spec.ts).
- **EXIF survives** (`src/lib/exif.ts`, no library): a canvas drops all metadata, so the original JPEG's APP1 EXIF segment is copied into the new file, with Orientation set to 1 (the pixels are already upright), the pixel dimensions set to the exported size, the IFD1 thumbnail dropped (it shows the photo without the date), and the date taken overwritten when the user changed it under the thumbnail. A photo without EXIF (screenshot, PNG, HEIC) gets a minimal EXIF with the stamped date. Camera, lens and GPS stay: it is the user's own file and never leaves the device.
- Not kept: the ICC colour profile. The canvas works in sRGB, so a wide-gamut (Display P3) iPhone photo comes out in sRGB; keeping P3 would need a `display-p3` canvas and its profile written into the file.
- Tests: `tests/unit/exif.test.ts` (segment parsing, fitting, building, broken input, `redateJpeg`) and `tests/e2e/quality.spec.ts` (resolution, PSNR outside the date, the date really drawn in its corner and nowhere else, EXIF fields, edited date, no-EXIF photo, a sideways photo turned upright, the ZIP, a new `-date.jpg` file with the original untouched). Fixtures: `exif-full.jpg` (1600×1200, photo-like texture, date, Make/Model/Lens, GPS, EXIF size), `rotated.jpg` (stored 800×600, Orientation 6).

### Saving many photos: no ZIP by default

Many people cannot open a ZIP (and only Safari on a Mac unpacks one by itself), so **"Save all" never makes one**. It picks a mode once (`saveMode()` in editor.ts), and its label says which:

- **folder** – Chrome/Edge on a computer (`showDirectoryPicker`): the user picks a folder and the photos are written into it as plain files. The picker opens **before** the export, because it needs the click's user activation. Existing names are never overwritten (`IMG_1-date-2.jpg`).
- **gallery** – a touch device that can share files: the share sheet's "Save Images" puts them in the gallery. A long export outlasts the tap that started it and the sheet is then refused (`NotAllowedError`); the finished bar then shows a "Save the photos" button for a fresh tap.
- **files** – everything else: each photo downloads as its own file, 250 ms apart (browsers drop downloads started in the same instant).

"Download as ZIP" is a secondary button (from 2 photos). It stores the JPEGs uncompressed (`STORE`: they are compressed already) and shows its own percent step.

### The editor's markup

Left column (`relative`): drop zone (hidden once there are photos), the photo grid, "add more", and the progress panel floating over its bottom. With a mouse (`pointer-fine:`) the grid scrolls inside, so a long album does not stretch the editor: beside the settings it fills the column down to "add more" (a container query on the editor, `@min-[52.5rem]`, with a zero flex basis so the settings set the height), stacked it is at most as high as the drop zone; its scroll area reaches up to the editor's top border (`-mt`/`pt` = the column's padding) and a cut-off edge fades out over 8 px (scroll-driven animations in global.css, written as longhands because the minifier breaks the shorthand); not on touch screens (a scroll container would turn iOS Safari's toolbar opaque). Right column: one `<fieldset data-options>` holding every setting, disabled while saving (the hint then says so):

- **style** and **position** are `<input type="radio">` (visually hidden) inside tile `<label>`s, styled with `has-checked:`; the change event bubbles to the fieldset.
- **format** is `<el-select name="format">` (see its quirks above).
- **size** is a native range input.

The tiles' and the position picker's sample dates are HTML (`.stamp[data-style]` in `global.css`, matching how `stamp.ts` draws on the canvas); `refreshPreviews()` keeps their text in the chosen format and the position picker in the chosen style and size. Change a style in `stamp.ts` → change `.stamp` too.

Photo card: the preview in a 4:3 frame (`bg-photo`), the state badge, a remove button, the file name and the date's source (EXIF / file date, in accent), and the date folded in a `<details>` to change it.

No fixed bottom bar on phones, although the design sketched one: a fixed or sticky layer at the bottom makes iOS Safari's toolbar opaque. The save buttons stay in the flow, after the settings.

### Photo states and progress

Each card has `data-state` (styled in `global.css`): `waiting → loading → ready` while photos are added (every card appears at once as a shimmering placeholder, then they load one by one), `queued → working → done` during an export (dimmed, spinner with accent ring, green ring with a check). "done" means "in the last download": changing that photo's date or any option puts it back to "ready". The progress bar (`progress.ts`) shows the step, `3 / 12` and the bar, turns green with ✓ and closes, or turns red with "Something went wrong" when a job throws. It is `absolute` over the bottom of the photos' column (not fixed: that would turn iOS Safari's toolbar opaque), so opening it never moves the photos; it opens and closes with a fade and a small slide (`data-open`, 300 ms), and closed it is invisible and `inert`. Never toggle it with `hidden`: that cannot animate.

Adding and exporting are **serialised** through one queue (`run()` in editor.ts), because they share the progress bar: photos dropped during an export load after it.

### Changing the date in the EXIF (the `exif` page)

The second tool (`/change-photo-date/`, `/pl/zmien-date-zdjecia/`...) prints nothing: it rewrites the date taken, so galleries sort the photo where it belongs. `exif-editor.ts` on the workbench, `ExifEditor.astro` for the markup.

- **A JPEG is not encoded again.** `redateJpeg` (src/lib/exif.ts) changes only the EXIF segment: DateTimeOriginal, DateTimeDigitized and DateTime written in place; an EXIF without them gets a new Exif IFD (and IFD0, if it had no pointer) appended to the segment, the old values staying at their offsets. Everything else stays: camera, GPS, orientation, the IFD1 thumbnail (the pixels did not change). A JPEG without EXIF gets a minimal one after its JFIF segment; an unreadable EXIF is replaced by a minimal one. `OffsetTime*` is kept on purpose: the user edits the camera's clock time, not the zone.
- **HEIC, PNG, WebP** have no JPEG to keep: decoded, drawn at full size (same caps as the stamp editor) and saved as a JPEG with a minimal EXIF.
- **File names:** the same name for a JPEG (it is the same photo), `.jpg` for the rest (`redatedFileName`). In a folder `uniqueName` still never overwrites.
- **The cards** have the date field open (`dateOpen`), the date with its time (the locale's `-time` format), and "Was: …" once changed; they are wider (`<PhotoColumn wide>`: one column on a narrow phone, at most two), or the datetime field is cut off.
- **Every photo at once:** one date for all (`datetime-local` + button), and a shift: later/earlier radio tiles (no minus sign: iOS's numeric keypad has none) and days/hours/minutes. `shiftDate` moves the clock time, so "1 day later" keeps the hour across a DST change.
- Statistics: `dates_save` {count, method, changed} (counts only).
- Tests: `tests/e2e/exif.spec.ts` (picture bytes identical outside the EXIF, the new date and the kept tags, set all and shift, a photo without EXIF and the ZIP, HEIC → JPEG, the navbar link).

### Date formats per language

The format list and its order come from the locale (`dateFormats` in `src/i18n/<locale>.ts`): the country's own way first, and the first is the default. pl/de `14.07.2026`, es/fr/it/pt `14/07/2026`, en both `14/07/2026` and the US `07/14/2026`, then a variant with the time, retro (`'26 7 14`) and ISO. A format remembered on a page in another language that this page does not offer falls back to the page's default.

**Every stamp size is a fraction of the photo's shorter side** (`size` is a percentage), so the preview and the export look the same. Keep it that way when adding styles.

Options are remembered in `localStorage` (`datestamp:options`). Every access is wrapped in try/catch, because storage can be blocked (private mode), and the editor works without it.

## Offline (PWA)

The site installs as an app (`manifest.webmanifest`, `display: standalone`) and the editor works without a network after one visit. `integrations/service-worker.mjs` (an Astro integration) writes `dist/sw.js` from `integrations/sw.js` at the end of the build: it keeps every language's home page, `_astro/` (scripts, styles, JSZip), the icons and the sample photos, and its version is a hash of those files, so a deploy that changes one installs a new worker and drops the old cache. Pages go to the network first (an update shows at once) and fall back to the last copy, else that language's home page; files are cache-first. Only same-origin GETs: Google's ads and statistics never go through it. Base.astro registers it in production builds only (none on the dev server). Cached copies are matched with `ignoreVary` (a module script's request carries Origin, the install's did not) and `ignoreSearch` (the icons' `?v=`).

The e2e tests run with `serviceWorkers: "block"` (a worker would answer requests out of reach of `page.route`); `tests/e2e/offline.spec.ts` turns it on, goes offline and uses the editor.

## SEO and AI answer engines

- **Titles ≤ 60 characters, descriptions 90–160** (a unit test enforces it in every locale): the search phrase first, then the benefit, then `| DateStamp`.
- **Head (Base.astro):** canonical, hreflang for every locale + x-default, `robots max-image-preview:large`, Open Graph (site name, `og:locale` with region from `ogLocales`, alternates, 1200×630 image + alt), Twitter `summary_large_image`, icons (SVG, 32 px PNG, apple-touch, manifest), theme-color per scheme, a link to `llms.txt`.
- **JSON-LD is one `@graph` per page** with stable `@id`s: `WebSite`, `WebApplication` (free, runs in the browser, featureList from the facts and steps), `WebPage` (breadcrumb on subpages), plus what the page passes as `schema` (Home: `FAQPage`; guides: `HowTo`). Never add a second ld+json block; pass nodes through `schema`. Do not invent facts (no fake ratings, no publisher we do not have).
- **Share pictures:** `public/og/<locale>.png`, rendered from `src/pages/og/[locale].astro` (the home h1 and facts, the domain, a print with the retro date) by `npm run assets`. Re-run it after changing a home h1/facts or the favicon, and commit the PNGs.
- **Logo:** the mark (`LogoMark.astro`, the favicon drawing inline, a thin ring for the dark frame) before the "Date**Stamp**" wordmark, in the navbar and the mobile menu. Change it together with `public/favicon.svg`.
- **Favicon:** after a new icon, bump `ICON_VERSION` in Base.astro (the `?v=` on the icon links), or browsers keep showing the cached one. `public/favicon.svg` (the wordmark's D with the orange stamp in the corner) is the source of every icon PNG; the maskable icon keeps the art in the middle 80 %.
- **AI:** `robots.txt` allows everything and names the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended...); `llms.txt` describes the tool, privacy, every page in every language, the iPhone steps and the FAQ, built from the same strings. The FAQ is always open on the page (no accordion), so its answers are in the visible text that crawlers read. `robots.txt`, like `ads.txt`, counts only at the domain root, so with the own domain.

## Layout

A **stacked layout** after Tailwind's Catalyst (owner's choice): a navbar on the frame colour (`bg-frame`), and the page in one rounded panel (`lg:rounded-xl lg:bg-page lg:ring-1 lg:ring-line lg:shadow-xs`, 8 px margin, 24 px padding). Below `lg` the panel is the page itself, no frame.

- Navbar: logo, a divider, links (the editor, "change date" (the `exif` page), how it works `#steps`, FAQ `#faq`, guides `#guides`: the list on the home page; on a guide page "guides" is the current item), then the theme switch and the language menu. Link labels are `nav` in the locale files.
- The navbar has **one underline** (`[data-nav-indicator]`), placed by Base.astro's script: under the current page's item, and on the home page under the section being read (it follows the scroll, sliding with a CSS transition; after a click on a section link it stays on that link until the visitor scrolls by hand, because near the end of the page the scroll cannot bring the last sections to the top). Between pages it slides too: cross-document view transitions (`@view-transition { navigation: auto }` in global.css) with the root's own animation off, so only `view-transition-name: nav-indicator` moves; browsers without them (Firefox) just load the page. Off with reduced motion.
- Section links only scroll, smoothly (`scroll-behavior: smooth`, off with reduced motion): Base.astro's script stops the jump and adds no `#section` to the address (an arriving hash is dropped too), and "Add date" on the home page scrolls to the top. The heading they land on grows slightly and gets a marker scribble drawn under its text in the accent, once the smooth scroll has stopped, which then fades (`.scribble`/`.is-target` in global.css; Base.astro's script wraps the text and adds the SVG, so a second click on the same link replays it; `:target` alone would not).
- Below `lg` the links are in a sheet from the left (`#mobile-menu`, opened by the hamburger). It is **not a modal `<dialog>`**: the top layer is fixed to the screen, and iOS Safari then paints its status bar and toolbar opaque (also with Elements' `<el-dialog>`). It is an `absolute` panel on the page, put at `scrollY` with `h-svh`, the page's scroll locked (`overflow: hidden` on `<html>`) and header/main `inert`; its tint `[data-menu-shade]` is `absolute inset-0` over the whole page, and while it is open the `theme-color` metas are taken out and `<html>`/`<body>` get the page colour × 0.7: Safari paints the status bar, above the page where no layer reaches, from theme-color or else the page background (changing theme-color's value on an open page did nothing in iOS 26); the open panel has `translate: none` (an identity transform would still make it a layer). Base.astro's script opens and closes it (X, a tap on the tint, Escape, any of its links: a `#section` link does not leave the page), as on magdalenakuznik.pl. At its bottom, above the theme switch: "Install the app" (Chrome/Edge's `beforeinstallprompt`; on iOS, which has none, a hint about Safari's Share menu; hidden when running as the app).
- The ad rails sit inside the panel, so they appear from **1392 px** (rails + gaps + 960 px + the panel's margin and padding), 300 px wide from 1680 px.

## Sample photos ("how it looks")

- Three photos by **Kamil Krzysteczko** on Unsplash (`src/lib/samples.ts`), one per example, in the order of `samples`: snowy mountain (white date, its outline on the bright snow), grass (label), forest (retro, which reads best on its light, even background). `src/assets/samples/<key>.webp`, 800×600, resized at build time by `ExamplePhoto.astro` (astro:assets `<Picture>`: 400 and 800 px, AVIF and WebP, WebP fallback), lazy-loaded; credited under the examples. The owner chose them and wants no picker: three examples, that's all.
- Licence: the Unsplash License (free, commercial use allowed, no credit required). Replacing one: check it says "Free to use under the Unsplash License" (not Unsplash+), crop to 4:3, and update its alt text in `home.examples.alts` in every locale.

## Theme and language menu

- **Light / dark / system** switch in the header (`ThemeSwitch.astro`, `src/lib/theme.ts`). "System" follows `prefers-color-scheme`; light or dark sets `data-theme` on `<html>` and is remembered in `localStorage` (`datestamp:theme`). An inline script at the top of `<head>` (Base.astro) applies it **before first paint**, so there is no flash of the wrong theme; its storage key must match `theme.ts`.
- Colours are tokens on `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft`). The dark values appear twice in `global.css` (under the media query guarded by `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`); change both. Never hardcode a colour in a component.
- **Theme changes fade** through `@property`-registered tokens transitioned on `<html>` only (`.theme-transition`, 0.3 s). Do not switch to per-element colour transitions or a view transition: both were tried and flicker (inherited colours compound and lag, and the view-transition snapshot jumps at the end). A new colour token needs its own `@property` and a place in that transition list.
- The sliding highlight under the picked theme is positioned by CSS from `data-theme` alone, so it is right before JS runs.
- The theme switch and the language button are both 34 px tall (`h-8.5`); keep them equal. The owner prefers them this compact (a 52 px version was tried and rejected).
- Dark theme values were lightened at the owner's request (bg `#2a2826`, cards `#34322f`); `--photo` is the stand-in photo colour, darker than the cards in the dark theme.
- The language menu is a `<details>` with an SVG flag per language (`Flag.astro`). The flag stands for the readers, not a country: en is the United Kingdom, pt is Brazil (the Portuguese copy is Brazilian), nl the Netherlands, cs Czechia, tr Turkey, ro Romania, id Indonesia. A new locale needs a flag there.

## i18n and SEO

Locales: **en (default, no prefix), pl, de, es, fr, it, pt, nl, cs, tr, ro, id**, each under `/<locale>/`. nl writes dates 14-07-2026 (`dmy-dash`); cs, like pl, gets non-breaking spaces after one-letter words.

- **All user-facing text lives in `src/i18n/<locale>.ts`.** Never hardcode copy in components. Polish strings get a non-breaking space after every one-letter word (a, i, o, u, w, z) in `src/i18n/index.ts` (`keepOneLetterWords`), so none ends a line; type plain spaces in pl.ts. `en.ts` is the reference shape; the others end with `satisfies typeof en`, so `npm run check` fails when a key is missing.
- **Slugs are translated** (`slugs` in each locale file), because the slug is a ranking signal in the searcher's language: `/de/datum-auf-foto-iphone/`, `/pl/jak-dodac-date-do-zdjecia-na-iphonie/`.
- Pages: `home`, `exif` (the "change the date" tool, ChangeDate.astro; strings under `exif`, its editor's own strings under `exif.editor`, merged over `editor`), the guides (`guidePages`: `iphone`, `android`, `windows`, `mac`, `batch` = many photos at once, `screenshot`, `timestamp` = date and time for reports and claims, `scanned` = old and scanned photos with the date typed in, `retro` = the old-camera date effect), `privacy`. 12 pages × 12 locales = 144.
- `pathOf(page, locale)` gives a page's path and `href(path)` adds the base path (GitHub Pages serves under `/<repo>/`). **Always build internal links and asset URLs with `href()`**, never a bare `/…`, or they break on GitHub Pages.
- Every page outputs a canonical URL, `hreflang` alternates for every locale plus `x-default` (English), and JSON-LD: `WebApplication` on every page, `FAQPage` on home, `HowTo` on guides.
- The sitemap's i18n option pairs pages only when their paths match after the locale prefix, so it links the home pages but not the translated-slug guides. The `hreflang` tags in `<head>` cover those; that is enough for Google.
- Titles: the main search phrase first, then the benefit, then `| DateStamp`. Keep them under about 60 characters, and descriptions at about 150–160.

**Adding a locale or a guide:** the steps are in the `add-language-or-guide` skill (`.claude/skills/add-language-or-guide/SKILL.md`).

Translations should read naturally: use the phrase people actually search for in that language (e.g. "Datum auf Foto", "poner fecha a una foto", "colocar data na foto"), not a word-for-word translation of English.

## Ads (Google AdSense)

Two vertical ad units in side rails, left and right of the 960 px content column (`Base.astro` → `AdRail.astro`), and one responsive unit in the content for narrower screens (`InlineAd.astro`):

- **≥ 1392 px:** 160 px rails (160×600). **≥ 1680 px:** 300 px rails (300×600, the better-paying size). **Below 1392 px:** no rails, a single column. `RAILS_MIN_WIDTH` in `src/lib/ads.ts` and the media query in `global.css` must stay equal.
- **Below 1392 px** (phones, tablets: most of the traffic) the inline unit shows instead: on Home between the features and the FAQ, on guides between the steps and the editor. It is hidden from 1392 px up, where the rails take over.
- The rails are `position: sticky`, so the ad stays in view while scrolling. They never cover content, which AdSense policy requires.
- `fillAds()` requests only ad units that have a width. A hidden rail is never requested, and when the screen gets wider (`matchMedia` change) the newly visible rails are filled. A unit is `ins.ad-unit` and gets the `adsbygoogle` class only when it is requested: each `push({})` fills the first `ins.adsbygoogle` AdSense has not seen, in page order, so otherwise the hidden inline unit took the right rail's turn ("No slot size for availableWidth=0").
- A unit AdSense could not fill (`data-ad-status="unfilled"`, e.g. before approval) leaves a white frame: the rail is then `opacity: 0` (not `visibility: hidden`: AdSense sets `visibility: visible` on its iframe), the inline unit `display: none` (global.css).
- **Configuration comes only from the environment** (`PUBLIC_ADSENSE_CLIENT` = `ca-pub-…`, `PUBLIC_ADSENSE_SLOT_LEFT`, `PUBLIC_ADSENSE_SLOT_RIGHT`, `PUBLIC_ADSENSE_SLOT_INLINE`, and `PUBLIC_GA_ID` for statistics; types in `src/env.d.ts`). In the deploy these are GitHub repository **variables** (`vars.ADSENSE_*`, not secrets: they end up in the public HTML anyway). Without them a production build has no rails and no AdSense script; `npm run dev` shows dashed placeholders so the layout can be checked.
- `ads.txt` is generated from the publisher id (`src/pages/ads.txt.ts`). Crawlers read it only from the domain root, so it works once the site has its own domain.
- **Cookie consent: our own banner** (`ConsentBanner.astro`, `src/lib/consent.ts`), the owner's choice, styled after Tailwind's cookie-banner block, with a choice per purpose: "Accept all", "Reject all" (equally prominent, GDPR) and "Customize", which unfolds switches for Necessary (always on), Statistics (GA4) and Advertising (AdSense). Rendered only when AdSense or GA4 is configured (and on the dev server). The choice is `{ analytics, ads, at }` in localStorage (`datestamp:consent`; an older choice without `analytics` counts as none, so the banner asks again); "Cookie settings" in the footer reopens the banner with the switches showing the current choice.
- One inline script at the top of `<head>` (Base.astro, `consentScript`) applies a stored choice before any Google script, with the same rules as `consent.ts`: no choice → `adsbygoogle.pauseAdRequests = 1` and GA4 not loaded; ads refused → `requestNonPersonalizedAds = 1`; statistics allowed → GA4 loaded right away. Change both together.

## Statistics (Google Analytics 4)

- `PUBLIC_GA_ID` (`G-…`, repository variable `GA_MEASUREMENT_ID`); without it there is no GA at all.
- **"Basic" Consent Mode v2:** without consent for statistics, gtag.js is not even downloaded; consent defaults are all `denied`, and an accepted choice updates `analytics_storage` (and the ad signals as the ads choice says). Withdrawing statistics later sends `denied` and deletes the `_ga` cookies (`revokeAnalytics`).
- **App events** (`track()` in `src/lib/analytics.ts`, sent only with consent): `photos_add` {count, with_exif}, `photos_save` {count, method: folder|gallery|files|zip, style, format, position, size}, `dates_save` {count, method, changed} (the change-date page), `editor_error`. **Never send a photo, a file name, or a date from a photo** — the privacy policy promises it. In GA's admin, turn off Enhanced measurement's "File downloads" to be safe (the saved photos are blob links).
- The privacy policy has a "Statistics" section in every locale; keep it in step with what is sent.
- **Trade-off the owner accepted:** a home-made banner is not a Google-certified CMP (TCF). In the EEA, the UK and Switzerland AdSense then serves only limited ads, which pay noticeably less there. Switching to Google's own CMP (AdSense → Privacy & messaging → European regulations) means removing our banner and the `<head>` pause script, not running both.
- **Privacy policy** (`privacy` page, all locales) names AdSense cookies and links to Google's ad settings. The contact email comes from `PUBLIC_CONTACT_EMAIL` (`vars.CONTACT_EMAIL`). Keep the page accurate when adding anything that stores or sends data.

AdSense policy points to respect when changing the layout: no ads on pages without real content, nothing that invites clicks ("click the ad", arrows), ads must not look like the editor's buttons or sit right next to them, and no more ads than content.

**AdSense approval needs a domain you own:** a `*.github.io` subdomain is not accepted. Buy a domain, point it at GitHub Pages (see below), then apply in AdSense with it.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys after CI succeeded on `main` (and by hand: workflow_dispatch). One-time setup in the GitHub repo: **Settings → Pages → Source: GitHub Actions**.

- The site is on its own domain, **datestamp.eu** (`public/CNAME`): the workflow sets `SITE=https://datestamp.eu` and `BASE_PATH=/`. Locally both default to `http://localhost:4321` and `/`.
- **Custom domain:** add it in Settings → Pages, put the domain in `public/CNAME`, and change the workflow's env to `SITE: https://<domain>` and `BASE_PATH: /`. GitHub issues the HTTPS certificate for it (Let's Encrypt); tick "Enforce HTTPS" once it is issued.
- A repository named `<owner>.github.io` is served at the root: `BASE_PATH: /`.

## Conventions

- Never commit or push unless the owner asks for it explicitly. Never force push.
- No backend, no uploads, no analytics that send photos or their metadata anywhere. Anything that would break "photos never leave your device" needs the owner's decision first.
- Keep the first page load light: the editor is the only real JavaScript. Load heavy libraries (JSZip, exifr, the HEIC decoder) with dynamic `import()` at the moment they are needed. Also for speed: the CSS is inlined into each page (`build.inlineStylesheets: "always"`), Tailwind Plus Elements is imported by the editor only, and AdSense's script is added after `load`, when the browser is idle (Base.astro). GitHub Pages sends `max-age=600` for every file and that cannot be changed there; repeat visits get the files from the service worker.
- Use `<details>`/`<summary>` and plain HTML for show/hide where possible (the language menu, the FAQ) rather than JavaScript.
- Every layout must work at 375 px with a 16 px gutter and no horizontal scroll.

## Known gaps / next steps

- **Retro font**: currently Courier New with a glow. A seven-segment font such as DSEG7 (OFL licence) bundled in `public/` would look closer to the real thing.
- GitHub's terms say Pages is not meant for running an online business. A free tool with ads is a grey area; if that becomes a problem, or a paid tier comes, move the static `dist/` to Cloudflare Pages (free, commercial use allowed, custom headers and redirects). With your own domain, the move keeps every URL and ranking.
