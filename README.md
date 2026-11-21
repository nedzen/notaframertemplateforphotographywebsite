# Dylan Calluy — portfolio template

A standalone copy of the published photographer portfolio, extracted from its
Framer page and stripped of the Framer runtime. Plain HTML, CSS, and vanilla
JavaScript — no framework, no build step, no external requests.

## Run

```sh
npm start            # http://localhost:4321
# or
node server.mjs
```

Node 18+. The server only serves files and falls back to `index.html` for the
clean routes. Any static host will work if it has the same SPA fallback
(`/about`, `/grid`, `/contact`, `/projects/*` → `index.html`).

## Routes

| URL | View |
| --- | --- |
| `/` | Project index with hover previews |
| `/grid` | Photo grid, lightbox, MONO toggle |
| `/about` | About panel |
| `/contact` | Contact panel |
| `/projects/<slug>` | Project strip, stage, carousel and Next |

Navigation uses the History API, so the back/forward buttons and deep links
work. Every view also has a hash route (`#about`, `#grid`, `#contact`,
`#japan`) used internally by the template.

## Files

```
index.html     markup: navigation, index, gallery, grid, about, contact, project
styles.css     the template's CSS (desktop, tablet, phone, reduced motion)
script.js      media helpers, routing, transitions, preloader, grid, projects
data.js        project media, grouped by project slug
fonts.css      Geist 300, five unicode subsets
assets/images  95 photographs and poster frames
assets/video   the project clip
assets/fonts   Geist woff2 files
server.mjs     tiny static server with clean-URL fallback
```

## Editing

- Copy, project names, gallery, grid and about text live in `index.html`.
- Project media (images, clip, poster, orientation, alt text) lives in `data.js`.
- Colours, spacing, type and motion live in `styles.css` (`:root` at the top).
- The grid is shuffled on every load by design.

The contact form validates in the browser, then shows the thank-you line and
emits `contact:submit` with `{ name, email, message }`. There is no backend:

```js
document.addEventListener("contact:submit", (event) => {
  // send event.detail to your API
});
```

## Notes

The original page was a Framer site whose custom component embedded this
template. The Framer wrapper, editor bar, analytics, CMS runtime and hosting
assets have been removed; the template's own markup, styles and interaction
code are kept. Design, photography and copy belong to Dylan Calluy.
