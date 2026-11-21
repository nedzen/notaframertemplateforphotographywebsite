# Dylan Calluy — portfolio template

An unofficial, standalone copy of the photographer portfolio published at
<https://smiling-listening-668328.framer.app/>.

The published site was built in Framer with a custom component that embedded
plain HTML, CSS and JavaScript. This repository contains that template,
extracted and cleaned: the Framer runtime, editor bar, analytics, CMS and
hosting wrappers are gone. What remains is a native ES-module front end with
local fonts, photographs and video, and no build step or runtime dependency.

> **Credit:** design, photography, video and copy belong to **Dylan Calluy**.
> Original site: <https://smiling-listening-668328.framer.app/>. Built with
> [Framer](https://www.framer.com/). This is not an official repository, and
> no permission to reuse the visual content is granted here.

## Quick start

```sh
npm start            # http://localhost:4321
# or
node server.mjs
# or a different port
PORT=5000 node server.mjs
```

Node 18+. `server.mjs` is a small static server with clean-URL fallback and
byte-range support for the video. It is for local use, not a hardened
production server.

## Routes

| URL | View |
| --- | --- |
| `/` | Project index with hover previews |
| `/grid` | Photo grid, lightbox and MONO toggle |
| `/about` | About sheet |
| `/contact` | Contact sheet |
| `/projects/<slug>` | Project header, filmstrip/stage, feed or carousel |
| anything else | The index (the local server falls back to `index.html`) |

Routing is client-side. Clean URLs and the back/forward buttons use the
History API; each view also has an internal hash (`#about`, `#grid`,
`#contact`, `#japan`). `router.js` maps between the two.

## Architecture

Native ES modules, loaded directly by the browser. No bundler, transpiler or
package dependency.

```
src/
  main.js          entry point; imports the features and starts the entrance
  layout.js        shared DOM refs, breakpoints, timing, state and hooks
  media.js         image/video readiness, cloning and autoplay helpers
  router.js        clean URL <-> hash mapping and document titles
  index.js         project rows, hover previews and touch autoplay
  sheets.js        About/Contact sheets
  grid.js          grid placement, scroll reveal, MONO and lightbox
  transitions.js   page state machine, URLs and global navigation events
  preloader.js     preloader and entrance sequence
  form.js          contact validation and success line
  project/
    context.js     shared project refs, data shape and media builders
    page.js        header, filmstrip, stage, wheel/keys and stage swipe
    feed.js        phone vertical feed
    carousel.js    desktop/tablet carousel
    index.js       public API for the project feature
```

Import direction:

```
main.js
├── router.js
├── index.js ──────────► layout.js, media.js
├── sheets.js ─────────► layout.js
├── grid.js ───────────► layout.js, sheets.js, media.js
├── project/index.js ──┬─ page.js ─────► carousel.js, context.js
│                      ├─ feed.js ─────► context.js
│                      └─ carousel.js ─► context.js
├── transitions.js ────► every feature, layout.js, router.js
├── form.js
└── preloader.js ──────► transitions.js, router.js, index.js, layout.js, media.js
```

Simplified: feature-to-feature imports (for example `page.js` also imports
`index.js`, `sheets.js` and `grid.js`) are omitted for readability.

`transitions.js` owns the page state machine (`index`, `grid`, `project`) and
imports the feature modules. Features never import `transitions.js`; they call
navigation through the `hooks` object in `layout.js`
(`hooks.goTo`, `hooks.syncHash`, `hooks.syncCurrent`, …). `preloader.js` is the
one startup module that imports `applyRoute` directly.

`layout.js` also owns the mutable app state (`state.activeRow`,
`state.currentPage`, `state.currentProject`, …), the breakpoints
(`1100px` tablet, `600px` phone, portrait-upright tablet) and the reduced-motion
query. `project/context.js` holds the project-side equivalents.

### Project layouts

The project page has three rendering engines:

- `project/page.js` — header line, filmstrip, stage and the desktop wheel/keyboard
  controls when the carousel is off.
- `project/carousel.js` — the desktop/tablet horizontal row (spring motion,
  drag, NEXT handoff).
- `project/feed.js` — the phone vertical feed.

`carouselOn()` and `feedOn()` in `project/context.js` choose between them.
Append `?project=stage` to a project URL to disable the carousel and use the
plain stage layout.

## Editing

- **Copy, project names, gallery, grid and About text:** `index.html`.
- **Project media:** `data.js`, grouped by project slug.
- **Colours, spacing, type and motion:** `styles.css` (`:root` at the top).
- **Routing and titles:** `src/router.js`.
- **Page transitions and global keys:** `src/transitions.js`.

### Adding a project

1. Add a row to `#projects` in `index.html`:

   ```html
   <li>
     <a class="project" href="/projects/new-project" data-project="new-project">
       <span class="project__num">09.</span>
       <span class="project__name">New Project</span>
     </a>
   </li>
   ```

2. Add a hover-preview set to `#gallery`:

   ```html
   <div class="gallery__set" data-project="new-project">
     <figure class="tile"><img src="/assets/images/…" alt=""></figure>
   </div>
   ```

3. Add its photos to `#photos` in `index.html`; each one is a `.photo` with
   `data-orient="p"` or `"l"`. The grid shuffles them at runtime.

4. Add the project to `data.js`:

   ```js
   "new-project": {
     media: [
       { project: "new-project", img: "/assets/images/x.jpg", video: "", poster: "", o: "p", alt: "" },
       { project: "new-project", img: "", video: "/assets/video/clip.mp4", poster: "/assets/images/poster.jpg", o: "l", alt: "" }
     ]
   }
   ```

Project order in the index, gallery sets and NEXT follows DOM order. The grid
photo set is independent and may contain any number of images.

### Contact form

The form validates in the browser, then shows the thank-you line and emits:

```js
document.addEventListener("contact:submit", (event) => {
  // event.detail = { name, email, message }
  // send it to your API here
});
```

There is no backend. The success state is not reset without a reload.

## Gotchas

- **Run it over HTTP.** ES modules and `history.pushState` do not work from
  `file://`. Use `npm start` or any static server.
- **Clean URLs need a fallback.** `/about`, `/grid`, `/contact` and
  `/projects/*` must all serve `index.html`. Netlify/Cloudflare Pages can use
  `/* /index.html 200`. GitHub Pages needs a `404.html` copy of `index.html`
  (or hash routing) because it has no rewrite rules.
- **Deploy at the domain root.** All asset and module paths are root-absolute
  (`/assets/...`, `/src/...`, `/data.js`). Serving under `/subpath/` requires
  changing those paths or adding a build step.
- **`data.js` is deliberately a classic script.** It sets `window.__data` and
  must load before `src/main.js`; changing it to `type="module"` would change
  when the project data becomes available.
- **The markup and CSS came from the published bundle.** They are readable and
  commented, but they are not an official source tree. Class names and DOM
  contracts are what the interactions rely on.
- **Images are full-resolution originals.** There are no responsive variants;
  `sized()` / `photoSize()` in `src/media.js` are no-ops kept as the hook for
  adding `srcset` or an image CDN later. The working tree is about 37 MB,
  mostly photographs and the 12 MB clip.
- **The grid is shuffled on every load.** Do not rely on DOM order for the
  grid. The lightbox's arrow keys follow the shuffled DOM order. Project NEXT
  follows index-row order instead.
- **The preloader waits for fonts and the first media**, capped at 2 seconds,
  then runs a photo cycle. With reduced motion it is skipped. First paint can
  take a few seconds on a cold load.
- **No per-route SSR or metadata.** Every path receives the same `index.html`;
  `router.js` changes `document.title` after load. Search engines and social
  cards see the home description for every route.
- **No Framer runtime, editor bar or analytics.** The "Edit Content" overlay
  and Framer badge are gone; the site also makes no third-party requests.
- **Disabled carousel switch:** `?project=stage` is a debugging/alternate
  layout switch, not part of the public navigation.
- **Accessibility is inherited from the original.** Focus management, ARIA
  labels, Escape handling and reduced-motion support are present, but there is
  no automated accessibility suite.
- **The local server is minimal.** It has no compression, TLS, cache busting,
  or security headers beyond `nosniff`. Use a real static host for production.

## Credit and provenance

- **Original site:** <https://smiling-listening-668328.framer.app/>
- **Photography, video, design and copy:** Dylan Calluy.
- **Platform:** [Framer](https://www.framer.com/) (the original custom
  component embedded the HTML/CSS/JS extracted here).
- **Typeface:** [Geist](https://vercel.com/font) by Vercel, bundled locally as
  five WOFF2 subsets under the SIL Open Font License 1.1.
- **This repository:** an unofficial mirror/extraction shared as a public
  reference and for study. No license is granted for the photographs, video,
  design or copy. Contact the original author before reusing them. If you are
  the rights holder and want content changed or removed, please open an issue.
