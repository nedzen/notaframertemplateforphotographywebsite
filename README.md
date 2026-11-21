# Dylan Calluy — Framer site mirror

Offline copy of <https://smiling-listening-668328.framer.app/> (published 21 Nov 2026),
mirrored with every runtime dependency on disk.

## Run

```sh
node server.mjs          # http://localhost:4321
# or
npm start
```

Requires Node 18+. A server is required: the site is an ES-module app, and
`file://` blocks module imports and routing. The port can be changed
(`PORT=5000 node server.mjs`); nothing in the mirror hardcodes it.

## What is included

- All 13 routes: `/`, `/grid`, `/about`, `/contact`, eight `/projects/<slug>`
  pages, and `/404` (unknown paths fall back to it).
- Framer runtime and page modules, CMS data chunks, search index.
- 94 gallery images plus all project media, poster frames and the mp4 video.
- Geist webfonts (Google Fonts CSS/Files) and the site's bundled woff2 files.
- Client-side routing, index hover previews, project strip/stage and keyboard
  paging, grid lightbox with MONO toggle, about/contact panels, form validation.

## Local-only substitutions

These are the only intentional differences from the published site:

| Published behaviour | Local behaviour |
| --- | --- |
| Framer editor-bar overlay (authoring UI, needs framer.com login) | `/stub/editorbar.mjs` no-op module |
| Framer analytics (`events.framer.com`) | empty `/stub/analytics.js` |
| Contact form POSTs to `api.framer.com/forms/...` | local `POST /api/forms/<id>/submit`, appended to `data/submissions.jsonl` |

The form's visible behaviour is unchanged: invalid fields are marked, and a
successful submit swaps SEND for “Thank you, I’ll be in touch.” No email is
sent from the local copy.

External links (Instagram, LinkedIn, X, the “Made in Framer” badge) still point
to their real destinations and need a connection.

## Layout

```
server.mjs          static server, route fallbacks, byte ranges, form endpoint
public/             the mirrored site
  index.html        / and the other route documents
  framerusercontent.com/   modules, CMS chunks, images, video, fonts
  fonts.googleapis.com/    Google Fonts CSS
  fonts.gstatic.com/       Google Fonts files
  stub/             local analytics and editor-bar stubs
data/               form submissions created at runtime (not served)
```

## Notes

This is a read-only reference copy for local development. The design, photography
and code belong to their original author; the Framer badge and external links are
kept for attribution.
