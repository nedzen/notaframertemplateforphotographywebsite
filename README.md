# Dylan Calluy — portfolio template

An unofficial, standalone copy of the photographer portfolio published at
<https://smiling-listening-668328.framer.app/>.

The published site was built in Framer with a custom component that embedded
plain HTML, CSS and JavaScript. This repository contains that template,
extracted and cleaned: the Framer runtime, editor bar, analytics, CMS and
hosting wrappers are gone. What remains is a native ES-module front end with
SCSS sources, local fonts, photographs and video. Dart Sass is the only build
dependency; the browser runs plain ES modules with no runtime dependency.

> **Credit:** design, photography, video and copy belong to **Dylan Calluy**.
> Original site: <https://smiling-listening-668328.framer.app/>. Built with
> [Framer](https://www.framer.com/). This is not an official repository, and
> no permission to reuse the visual content is granted here.

## Quick start

```sh
npm install          # Dart Sass, dev only
npm start            # builds styles.css, then http://localhost:4321

npm run watch:css    # rebuild styles.css while editing SCSS
node server.mjs      # serve without rebuilding
PORT=5000 node server.mjs   # a different port
```

Node 18+. `npm start` runs `build:css` first (`prestart`). `server.mjs` is a
small static server with clean-URL fallback and byte-range support for the
video. It is for local use, not a hardened production server.

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
`#contact`, `#japan`). `src/app/router.js` maps between the two.

## Architecture

Plain ES modules in the browser, SCSS compiled ahead of time. Dart Sass is the
only dependency, and it is a dev dependency: `styles.css` is a build artifact,
so production needs no build step.

```
scss/
  main.scss              stylesheet entry; load order is the cascade
  config/
    _tokens.scss         every tunable value, declared with !default
    _breakpoints.scss    breakpoint map and media-query mixins
    _mixins.scss         focus ring, hairlines, media fill
  base/
    _fonts.scss          bundled Geist faces
    _reset.scss          element reset
    _root.scss           :root custom properties, theme, page shell
  layout/
    _header.scss         header and nav
    _main.scss           index list, headline, gallery
  components/
    _about.scss          _contact.scss   _form.scss
    _grid.scss           _lightbox.scss
    _preloader.scss      _entrance.scss
    _project.scss        _carousel.scss  _transitions.scss
  responsive/
    _tablet.scss  _upright.scss  _phone.scss  _phone-index.scss

src/
  main.js                composition root
  core/
    config.js            JS mirrors of SCSS tokens (durations, ratios)
    dom.js               selectors, px, rect frames
    media.js             readiness, cloning, autoplay
    motion.js            reduced motion, wait, spring, cubic-bezier, count-up
    viewport.js          breakpoint media queries
  app/
    context.js           app DOM refs, mutable state, hooks, mainTop
    router.js            clean URL <-> hash mapping and titles
    transitions.js       page state machine, URLs and Escape
  components/
    grid/
      index.js           createGrid
      placement.js       contact-sheet pattern and shuffle
      reveal.js          scroll reveal and video visibility
      lightbox.js        createLightbox
      mono.js            MONO toggle
    project/
      context.js         project refs, data builders, injected services
      page.js            header, filmstrip, stage, wheel/keys, swipe
      carousel.js        desktop/tablet row
      feed.js            phone vertical feed
      index.js           public API
    index-list.js        project rows, hover previews, autoplay
    sheets.js            About/Contact sheets
    preloader.js         preloader cycle and entrance
    contact-form.js      validation and success line
```

Dependency rule: a component imports only `src/core/*` and its own files.
Components never import the app or another component. `src/main.js` builds the
instances and injects what they need:

```
main.js
├── createIndexList(...)   rows, hover, autoplay
├── createSheets(...)      About/Contact
├── createGrid(...)        placement, reveal, lightbox, MONO
├── initProjectPage()      header, stage, feed/carousel
├── createTransitions(...) page machine, URLs, Escape
└── createPreloader(...)   entrance
```

`src/app/transitions.js` is the only module that knows `index`, `grid` and
`project` coexist. It receives the three instances and returns
`{ goTo, applyRoute, syncHash, syncCurrent, syncLayers }`. The project feature
gets callbacks through `configureProject({ rows, sets, state, setActive,
closeSheets, isSheetOpen, isLightboxOpen, goTo, syncHash, pathFor })`, so it
does not import the index, sheets or grid.

`src/app/context.js` holds the app's DOM refs, mutable state
(`state.activeRow`, `state.currentPage`, …) and navigation hooks.
`src/core/config.js` mirrors the JS-visible values in
`scss/config/_tokens.scss`: change both when tuning those values.

### Design tokens

`scss/config/_tokens.scss` declares every parameter with `!default`, so a
consumer can override the kit without editing it:

```scss
@use "config/tokens" with (
  $margin: 16px,
  $gutter: 6px,
  $color-text: #111
);
```

It covers margins, gutter, columns, header height, sheet gap, ratios,
breakpoints, palette (light and dark), type, easings, durations, the z-index
scale and component knobs (grid tile span, reveal stagger, form heights).
Values that change at runtime or from JS stay CSS custom properties in
`scss/base/_root.scss` (`--main-top`, `--i`, `--c`, `--r`, `--lead`, theme
colours).

### Reusing a component

Each component takes its own DOM and options and returns a small API:

```js
import { createGrid } from "/src/components/grid/index.js";

const grid = createGrid({
  root: document.querySelector("#grid"),
  photosRoot: document.querySelector("#photos"),
  monoButton: document.querySelector("#nav-mono"),
  beforeReveal: () => {},
  getHeaderHeight: () => 0,
});

grid.reveal();       // reveal the sheet when it becomes visible
grid.cleanup();      // disconnect observers, close the lightbox
grid.hasExpanded();  // is a photo open?
grid.collapse(true); // close without a flight
```

The grid markup contract is one scrolling root containing
`.photos > figure.photo[data-orient="p"|"l"]` with an `img` or `video` inside.
Its styles are `scss/components/_grid.scss` and `_lightbox.scss`; load
`scss/config/*` and those partials. For the lightbox alone, use
`createLightbox({ container, photos })` from
`src/components/grid/lightbox.js`.

### Project layouts

The project page has three rendering engines:

- `components/project/page.js` — header line, filmstrip, stage and the desktop
  wheel/keyboard controls when the carousel is off.
- `components/project/carousel.js` — the desktop/tablet horizontal row (spring
  motion, drag, NEXT handoff).
- `components/project/feed.js` — the phone vertical feed.

`carouselOn()` and `feedOn()` in `components/project/context.js` choose between
them. Append `?project=stage` to a project URL to disable the carousel and use
the plain stage layout.

## Editing

- **Copy, project rows, gallery, grid and About text:** `index.html`.
- **Project media:** `data.js`, grouped by project slug.
- **Colours, spacing, type and motion:** `scss/config/_tokens.scss`. Values
  scripts also read are mirrored in `src/core/config.js`.
- **Component styles:** `scss/components/*.scss`, `scss/layout/*.scss` and the
  breakpoint overrides in `scss/responsive/*.scss`.
- **Routing and titles:** `src/app/router.js`.
- **Page transitions and global keys:** `src/app/transitions.js`.
- **Grid, reveal and lightbox:** `src/components/grid/*`.
- **Project page, carousel and feed:** `src/components/project/*`.
- **After any SCSS change:** `npm run build:css` (`npm start` does it). Never
  hand-edit `styles.css`; it is generated.

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
- **`styles.css` is generated from `scss/`.** Edit the partials, not the CSS.
  `npm start` rebuilds it; use `npm run watch:css` while styling.
- **Images are full-resolution originals.** There are no responsive variants;
  `sized()` / `photoSize()` in `src/core/media.js` are no-ops kept as the hook
  for adding `srcset` or an image CDN later. The working tree is about 37 MB,
  mostly photographs and the 12 MB clip.
- **The grid is shuffled on every load.** Do not rely on DOM order for the
  grid. The lightbox's arrow keys follow the shuffled DOM order. Project NEXT
  follows index-row order instead.
- **The preloader waits for fonts and the first media**, capped at 2 seconds,
  then runs a photo cycle. With reduced motion it is skipped. First paint can
  take a few seconds on a cold load.
- **No per-route SSR or metadata.** Every path receives the same `index.html`;
  `src/app/router.js` changes `document.title` after load. Search engines and
  social cards see the home description for every route.
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
