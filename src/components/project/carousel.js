/* Project page on desktop/tablet: the horizontal carousel. */

import { Media } from "../../core/media.js";
import { layout } from "../../core/config.js";
import { reduceMotion, spring } from "../../core/motion.js";
import { uprightLayout, wideSingle } from "../../core/viewport.js";
import {
  CONTINUE_TURN,
  UNFOLD,
  UNFOLD_RELEASE,
  clamp01,
  carouselEl,
  carouselTrack,
  makeMedia,
  projectEnv,
  projectMedia,
  projectPosition,
  pstate,
  stripReady,
} from "./context.js";

/* ---------- Project page: carousel ----------
   The desktop project page (?project=stage brings back the filmstrip and
   single stage). The project runs as one row across the width at the
   gallery's height: a portrait is half the gallery, a landscape all of
   it, 4px apart — the index tiles' own sizes — repeated so it never ends.
   Opening from the index, the row starts with the first photo exactly on
   the index tile and glides left until it rests on column 1, the rest of
   the series sliding in from the right as if scrolled; opening any other
   way, the whole row slides in from the right. The wheel (either axis), a
   drag or the arrow keys move a target; the row glides after it. Each
   photo is a touch larger than its frame and drifts against the movement
   by its distance from the centre — the parallax. The header counts the
   photo at the start of the row. */
// Motion. The row has mass: a spring pulls it toward its target with
// some velocity of its own, so a flick coasts and a drag's release speed
// carries on. Two numbers tune it: how long a scroll takes to settle (its
// weight) and how much it overshoots (0 = none). The opening is the same
// spring, softer, released from rest — any input mid-way just blends in.
const CAROUSEL_SETTLE = 0.6;      // s for a scroll to come within ~2% of rest
const CAROUSEL_BOUNCE = 0;        // 0 = no overshoot; 0.1–0.2 = a touch
const CAROUSEL_OPEN_SETTLE = 1.4; // the same, for the opening
const CAROUSEL_OPEN_RAMP = 0.5;   // s the opening's pull takes to build up, so it eases off the mark
// The way back is timed rather than a spring, so the
// page can promise its length: it always takes this long, from any photo.
const CAROUSEL_RETURN_MS = 1000;
const CAROUSEL_FLING = 0.28;      // s of the release speed a drag carries on for
// The unfold: in the opening the arriving series starts stretched out —
// the further a photo is behind the first, the wider its gap — and closes
// up as the row lands, so later photos visibly fall in after earlier ones.
const CAROUSEL_DRIFT = 3;   // % of a tile's width a photo drifts near the screen's edge
const CAROUSEL_OVERSCALE = 0.08; // photos sit at 108% in their frames, room for the drift

const SPRING_SCROLL = spring(CAROUSEL_SETTLE, CAROUSEL_BOUNCE);
const SPRING_OPEN = spring(CAROUSEL_OPEN_SETTLE, 0);
let car = null;

const mod = (n, m) => ((n % m) + m) % m;

// Builds the row and places it for its opening: the first photo starts on
// column 5 when it is carried over from the index (opts.keep), otherwise
// the whole row starts off to the right. glideCarousel() then brings it
// home — the first photo on column 1 — on the same follow as a scroll.
// The gallery's geometry inside the row: cols 5–12 of the 12-col grid.
// A portrait is half the gallery, a landscape all of it. Upright the gallery
// is one portrait, so a landscape is two, and a lone one is the whole row.
function carouselGeometry(data) {
  const col = (carouselEl.clientWidth - 11 * layout.gutter) / 12;
  const galleryWidth = col * 8 + 7 * layout.gutter;
  const wide = wideSingle(data);
  const anchor = wide ? 0 : col * 4 + 4 * layout.gutter; // where it rests alone: column 5
  const portrait = uprightLayout.matches ? galleryWidth : (galleryWidth - layout.gutter) / 2;
  const landscape = portrait * 2 + layout.gutter;
  const widths = wide ? [carouselEl.clientWidth] : data.media.map((m) => (m.o === "l" ? landscape : portrait));
  const setWidth = widths.reduce((a, b) => a + b, 0) + layout.gutter * widths.length;
  return { anchor, widths, setWidth, single: widths.length === 1 };
}

// A carousel tile for one item (a video waits for the row to start it,
// buffering meanwhile — see startCarouselVideos).
function carouselTile(item, width) {
  const tile = document.createElement("figure");
  tile.className = "carousel__tile";
  tile.style.width = `${width}px`;
  if (item.o === "l" && uprightLayout.matches && width === carouselEl.clientWidth) tile.style.height = `${(width * 631) / 945}px`; // its own shape, under the rule
  const media = makeMedia(item);
  media.draggable = false;
  if (media.tagName === "VIDEO") {
    media.autoplay = false;
    media.preload = "auto";
  }
  tile.appendChild(media);
  return { tile, media };
}

function buildCarousel(row, { keep = false, settled = false, handoff = null } = {}) {
  stopCarousel();
  const data = projectMedia()[row.dataset.project];
  if (!data || !data.media.length) return;
  // A project of one photo or video isn't a row: it rests on cols 5–12,
  // where the index shows it, and holds still.
  const { anchor, widths, setWidth, single } = carouselGeometry(data);
  const copies = single ? 1 : Math.ceil(carouselEl.clientWidth / setWidth) + 2;
  const tiles = [];
  carouselTrack.replaceChildren();
  // Coming from the index, the row stays invisible (the index tiles show
  // through the see-through panel) until its photos are decoded.
  carouselEl.classList.toggle("is-waiting", keep);
  carouselEl.classList.toggle("is-single", single);
  for (let c = 0; c < copies; c++) {
    data.media.forEach((item, i) => {
      const { tile, media } = carouselTile(item, widths[i]);
      carouselTrack.appendChild(tile);
      tiles.push({ tile, media, index: i, left: 0, width: widths[i] });
    });
  }
  tiles.forEach((t) => (t.left = t.tile.offsetLeft));
  // Home puts the first photo at the row's left edge (column 1); a single
  // one on column 5, which it already holds coming from the index.
  const home = single ? -anchor : 0;
  const offset = reduceMotion.matches || settled || (single && keep) ? 0 : keep ? anchor : carouselEl.clientWidth;
  // Coming from the index, the photos already on screen keep their exact
  // places: the unfold is measured from the last of them, so the first one
  // to arrive from the right is the first to be held out.
  let held = 0;
  if (keep) {
    for (let i = 0; anchor + held + widths[i] + layout.gutter < carouselEl.clientWidth; i++) held += widths[i] + layout.gutter;
  }
  car = {
    setWidth, single, home, anchor, widths, x: home - offset, target: home - offset, v: 0, spring: SPRING_SCROLL,
    tiles, raf: 0, last: 0, count: data.media.length, step: widths[0] + layout.gutter, at: -1,
    opening: offset > 0, unfold: offset > 0 && !reduceMotion.matches ? { amount: 1, from: offset, held, keep } : null,
    size: [carouselEl.clientWidth, carouselEl.clientHeight],
  };
  // Taking over a spring NEXT mid-motion: the row starts where the strip
  // that brought its photos in is, at its speed, unfolded as much, and
  // carries on to rest on the same spring; the strip rides along on top
  // until the row can paint.
  if (handoff) {
    const { remaining, v, d, strip } = handoff;
    Object.assign(car, {
      x: home - remaining, target: home, v, spring: SPRING_NEXT, opening: true, handedOff: true,
      unfold: { amount: remaining / d, from: d, held: -strip.from, keep: false },
      ghost: strip,
    });
    car.raf = requestAnimationFrame(runCarousel);
  }
  // A video handed over from the index plays on; one arriving from the
  // right shows its poster while it slides and starts as it lands.
  if (!car.opening || keep) startCarouselVideos();
  renderCarousel();
  if (keep) {
    // Pick a clip up where the index tile left it.
    const lead = tiles.find((t) => t.index === 0 && Math.abs(t.left - carouselPos(car.x) - anchor) < 1);
    const from = projectEnv().sets.get(row.dataset.project).querySelector("video");
    if (lead && from && lead.media.tagName === "VIDEO") lead.media.currentTime = from.currentTime;
  }
}

// Resolves when the photos that matter for the opening can paint: the
// ones on screen where the row starts and where it comes to rest (capped,
// so a slow file can't hold the page). Everything else decodes meanwhile.
function carouselReady() {
  if (!car) return Promise.resolve();
  const w = carouselEl.clientWidth;
  const onScreenAt = (x) => {
    const pos = carouselPos(x);
    return car.tiles.filter((t) => t.left - pos < w && t.left - pos + t.width > 0);
  };
  const key = new Set([...onScreenAt(car.x), ...onScreenAt(car.home)]);
  car.tiles.forEach((t) => key.has(t) || (t.media.decode && t.media.decode().catch(() => {})));
  // A video that isn't playing yet only needs its poster, not its first
  // frame (which can take a while to arrive).
  const ready = (m) => {
    if (m.tagName !== "VIDEO" || car.playing) return Media.ready(m, 900);
    const poster = new Image();
    poster.src = m.poster;
    return Media.ready(poster, 900);
  };
  return Promise.all([...key].map((t) => ready(t.media)));
}

// The opening: release the row toward home on the soft spring, and start
// the unfold's clock.
function glideCarousel() {
  if (!car) return;
  car.spring = SPRING_OPEN;
  car.target = car.home;
  car.v = 0;
  car.openAt = performance.now();
  if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
}

// The way back: the row rewinds — to the right, back through the photos
// you've seen — until the first photo rests on column 5, the index tile
// it came from (a project still arriving carries on onto it instead). The unfold runs in reverse (the overscale
// and drift ease out with it), so the photos land exactly as the index
// shows them; the end of the series, which would cross the index's
// columns 1–4, fades. Resolves once the row has landed.
function returnCarousel() {
  if (!car) return Promise.resolve();
  const { anchor, setWidth } = car;
  // Head for the first photo's place on the tile (x = -anchor) the short
  // way, within a lap: scrolled forward, the row rewinds right; still
  // arriving from the right (NEXT, a link), it carries on left. A single
  // photo goes straight to its place.
  const ahead = car.x + anchor;
  const target = car.single ? car.home : ahead >= 0 ? car.x - mod(ahead, setWidth) : car.x + mod(-ahead, setWidth);
  const from = Math.abs(car.x - target);
  let held = 0; // the photos the index shows: a pair or one landscape
  for (let i = 0; anchor + held + car.widths[i] + layout.gutter < carouselEl.clientWidth; i++) held += car.widths[i] + layout.gutter;
  Object.assign(car, {
    opening: false, target,
    unfold: { amount: 0, from: Math.max(1, from), held, keep: true },
  });
  carouselEl.classList.add("is-returning");
  return new Promise((resolve) => {
    // A cubic from where the row is, at its current speed, to rest on the
    // tile: soft at both ends, exactly CAROUSEL_RETURN_MS long. Its clock
    // starts on the first frame.
    car.returning = { from: Math.max(1, from), done: resolve, x0: car.x, v0: car.v, t0: 0 };
    if (from < 0.5 || reduceMotion.matches) {
      car.x = target;
      car.v = 0;
      landCarousel();
    } else if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  });
}

// Landed: the photos are the index's; a clip hands its moment back to
// the index tile it came from.
function landCarousel() {
  const { done } = car.returning;
  car.returning = null;
  car.landed = true;
  car.unfold.amount = 1;
  renderCarousel();
  const lead = car.tiles.find((t) => t.index === 0 && Math.abs(t.left - carouselPos(car.x) - car.anchor) < 1);
  const to = pstate.currentProject && projectEnv().sets.get(pstate.currentProject.dataset.project).querySelector("video");
  if (lead && to && lead.media.tagName === "VIDEO") to.currentTime = lead.media.currentTime;
  done();
}

// NEXT, on desktop, keeps scrolling: the next project's photos are laid
// on straight after the last photo now on screen, in a strip of their own
// over the row, and the row glides on, on a spring like the scroll's,
// until the next project's first photo rests where its own page puts it
// (column 1; a single one on column 5, with columns 1–4 empty). The
// incoming project arrives unfolded and the outgoing one folds out as it
// leaves. As soon as the outgoing photos have left the screen the next
// project's row takes over mid-motion (see buildCarousel's handoff) and
// the page arrives, so NEXT works again at once. Resolves on hand-over.
let nextStrip = null;
const SPRING_NEXT = spring(1.0, 0);

// How far a photo is held out (incoming, +) or pulled ahead (outgoing, −)
// at this point of the glide; `dist` is its distance from the junction.
function nextShift(nx, dist, incoming) {
  const out = clamp01((car.x - nx.x0) / nx.d);
  return incoming ? UNFOLD * (1 - out) * dist : -UNFOLD * out * dist;
}
function dropNextStrip() {
  if (nextStrip) nextStrip.remove();
  nextStrip = null;
  if (car) car.ghost = null;
}

// Ready to paint: a photo decoded, a video's poster (it plays once the
// next project's own row takes over). Capped, so a slow file can't hold
// the page.
async function continueCarousel(row, onArriving = () => {}, ctx = null) {
  const data = projectMedia()[row.dataset.project];
  if (!car || !data || !data.media.length) return;
  // A strip still waiting to hand over (NEXT pressed twice): let the row
  // under it paint first, so dropping it shows no gap.
  if (nextStrip) await carouselReady();
  dropNextStrip();
  const row0 = car;
  if (!row0) return;
  const { anchor, widths, single } = carouselGeometry(data);
  const w = carouselEl.clientWidth;
  // The strip: as much of the next project as its page shows at rest,
  // parked out of sight until its photos can paint (warmed in advance by
  // loadProject, so this is usually instant).
  const strip = document.createElement("div");
  strip.className = "carousel__next";
  const track = document.createElement("div");
  track.className = "carousel__track";
  track.style.transform = `translate3d(${w * 3}px, 0, 0)`;
  strip.appendChild(track);
  const tiles = [];
  for (let i = 0, filled = 0; i === 0 || (!single && filled < w); i++) {
    const k = i % widths.length;
    const t = carouselTile(data.media[k], widths[k]);
    track.appendChild(t.tile);
    tiles.push({ ...t, width: widths[k], left: 0 });
    filled += widths[k] + layout.gutter;
  }
  carouselEl.appendChild(strip);
  tiles.forEach((t) => (t.left = t.tile.offsetLeft));
  nextStrip = strip;
  await stripReady(tiles);
  if (car !== row0 || nextStrip !== strip) return;
  // Where the row's photos on screen end now, and how wide the last one is.
  const box = carouselEl.getBoundingClientRect();
  let edge = w;
  let lastWidth = 0;
  car.tiles.forEach((t) => {
    if (t.before) return;
    const r = t.tile.getBoundingClientRect();
    if (r.left - box.left < w && r.right - box.left > edge - 0.5) {
      edge = r.right - box.left;
      lastWidth = t.width;
    }
  });
  const travel = edge + layout.gutter;
  const home = single ? anchor : 0;
  // The row's own speed carries on, but never backwards and never so fast
  // that the spring would overshoot the landing.
  car.v = Math.max(0, Math.min(2 * travel, car.v));
  // The outgoing row's videos hold their frame: a clip decoding while it
  // is carried across the screen costs the glide its smoothness.
  stopCarouselVideos();
  stopCarouselVideos = () => {};
  return new Promise((resolve) => {
    car.continuing = {
      t0: 0, x0: car.x, d: travel, done: resolve, onArriving, turned: false, ctx,
      // Past here the outgoing row is hidden: its next photos would show
      // through the incoming strip's gaps.
      cut: edge,
      // The unfold is measured from the outgoing project's last photo, so
      // the gap between the projects opens and closes too.
      strip: { track, tiles, start: travel + home, depth: single ? 0 : 1, from: lastWidth + layout.gutter },
    };
    renderCarousel();
    renderNextStrip();
    if (reduceMotion.matches) {
      car.x += travel;
      renderCarousel();
      renderNextStrip();
      car.continuing = null;
      onArriving();
      resolve();
    } else if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  });
}

// The strip moves with the row and drifts the same way (a single photo,
// which never moves on its page, has no overscale or drift). It arrives
// unfolded, like an opening: each photo held out by a quarter (UNFOLD) of
// its distance behind the outgoing project's last photo, the stretch
// closing with the travel so it lands exactly.
function renderNextStrip() {
  const c = car.continuing;
  if (!c) return;
  const { track, tiles, start, depth, from } = c.strip;
  const travelled = car.x - c.x0;
  const x = start - travelled;
  track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  const half = carouselEl.clientWidth / 2;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  tiles.forEach((t) => {
    const shift = nextShift(c, from + t.left, true);
    t.tile.style.transform = shift > 0.01 ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const centre = x + t.left + shift + t.width / 2;
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    t.media.style.transform = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
  });
}

// After a spring NEXT hands over, the strip keeps riding over the row in
// step (same place, unfold and parallax) until the row can paint.
function renderGhost() {
  const { track, tiles, depth, from } = car.ghost;
  const x = -car.x; // the row's first photo
  track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  const half = carouselEl.clientWidth / 2;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  const amount = car.unfold ? car.unfold.amount : 0;
  tiles.forEach((t) => {
    const shift = UNFOLD * amount * (from + t.left);
    t.tile.style.transform = shift > 0.01 ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const centre = x + t.left + shift + t.width / 2;
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    t.media.style.transform = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
  });
}

// The track's offset for a row position: the row wraps, a single photo
// doesn't.
const carouselPos = (x) => (car.single ? x : mod(x, car.setWidth));

function renderCarousel() {
  const pos = carouselPos(car.x);
  carouselTrack.style.transform = `translate3d(${-pos}px, 0, 0)`;
  const w = carouselEl.clientWidth;
  const half = w / 2;
  // While opening, only the series from the arriving first photo onwards
  // shows: whatever would sit to its left (the end of the series) waits.
  // Going back, the series is read from the copy heading for column 5.
  const leadLeft = car.returning || car.landed ? car.anchor - (car.x - car.target) : -car.x;
  // NEXT, continued: the outgoing row ends where the incoming strip starts,
  // and folds out as it leaves — the mirror of the incoming unfold: each
  // photo pulled ahead by UNFOLD of its distance from the junction, growing
  // with the travel (the gap at the junction stays about the same, the
  // gaps behind it open as the ones ahead close).
  const nx = car.continuing;
  const cut = nx ? nx.cut - (car.x - nx.x0) - 0.5 : Infinity;
  const out = nx ? Math.max(0, Math.min(1, (car.x - nx.x0) / nx.d)) : 0;
  const ref = car.step / 2; // the counter follows the photo at the row's start
  let at = car.opening ? 0 : car.at; // arriving: the first photo
  // Handed over from the index, the photos start exactly as the index
  // shows them (100%, no drift); the overscale and the parallax grow in
  // with the row's travel, so nothing jumps.
  // A single photo never moves, so it has no overscale or drift at all —
  // unless it is leaving with NEXT, continued: then it eases into the
  // row's parallax over the first half of the travel.
  const leaving = Math.min(1, out / 0.5);
  const depth = car.landed ? 0
    : car.single ? leaving * leaving * (3 - 2 * leaving)
    : car.unfold && car.unfold.keep ? 1 - car.unfold.amount : 1;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  car.tiles.forEach((t) => {
    const left = t.left - pos;
    // Only photos at or near the screen are touched (the unfold only ever
    // pushes a photo further right, so one past the edge stays past it).
    if (left > w || left + t.width < -half) return;
    // The unfold: stretched by the distance behind the first photo (or the
    // last one handed over from the index).
    const u = car.unfold;
    let shift = u ? UNFOLD * u.amount * Math.max(0, left - leadLeft - u.held) : 0;
    if (nx && left < cut) shift += nextShift(nx, cut + layout.gutter - left, false);
    const centre = left + shift + t.width / 2;
    // Capped so the drift (≤ 3.6%) stays inside the photo's 8% overscale.
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    const tileT = shift ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const mediaT = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
    if (t.tileT !== tileT) t.tile.style.transform = t.tileT = tileT;
    if (t.mediaT !== mediaT) t.media.style.transform = t.mediaT = mediaT;
    // Always a boolean: classList.toggle with an undefined force flips the
    // class instead of setting it.
    const before = (!!(car.opening || car.returning || car.landed) && left < leadLeft - 0.5) || left >= cut;
    if (t.before !== before) t.tile.classList.toggle("is-before", (t.before = before));
    if (!car.opening && left <= ref && left + t.width + layout.gutter > ref) at = t.index;
  });
  if (car.ghost) renderGhost();
  if (at !== car.at && !nx) { // the outgoing count holds still as it turns over
    car.at = at;
    const pad = (n) => String(n).padStart(2, "0");
    projectPosition.textContent = `${pad(at + 1)} / ${pad(car.count)}`;
  }
}

function runCarousel(now) {
  if (!car) return;
  const dt = car.last ? Math.min(0.05, (now - car.last) / 1000) : 1 / 60;
  car.last = now;
  // The spring, in small fixed steps so it stays stable at any frame rate.
  let { k, c } = car.spring;
  if (car.spring === SPRING_OPEN) {
    // From rest a spring pulls hardest at once; the opening's pull builds
    // up instead (damping in step, so it stays just as smooth).
    const p = Math.min(1, (now - car.openAt) / 1000 / CAROUSEL_OPEN_RAMP);
    const ramp = Math.max(0.02, p * p * (3 - 2 * p));
    [k, c] = [k * ramp, c * Math.sqrt(ramp)];
  }
  const nx = car.continuing;
  if (nx) {
    // NEXT: the scroll's kind of spring, its pull building up over 0.35s.
    if (!nx.t0) nx.t0 = now;
    const elapsed = now - nx.t0;
    const target = nx.x0 + nx.d;
    const ramp = Math.min(1, elapsed / 350);
    const k = SPRING_NEXT.k * ramp * ramp * (3 - 2 * ramp) + 0.02;
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(1 / 240, left);
      car.v += (k * (target - car.x) - SPRING_NEXT.c * car.v) * h;
      car.x += car.v * h;
    }
    const landed = (Math.abs(target - car.x) < 0.5 && Math.abs(car.v) < 20) || elapsed > 3000;
    if (landed) {
      car.x = target;
      car.v = 0;
    }
    // Hand over as soon as the outgoing photos have left the screen (the
    // last one's right edge, pulled ahead by the fold, past the left edge):
    // the next project's row carries on with the same spring from here, so
    // the page arrives — and NEXT works again — without waiting for the
    // spring's last, slow pixels.
    const junction = nx.cut - (car.x - nx.x0);
    if (!landed && nx.ctx && junction - layout.gutter + nextShift(nx, nx.strip.from, false) <= 0) {
      nx.ctx.handoff = { remaining: target - car.x, v: car.v, d: nx.d, strip: nx.strip };
      if (!nx.turned) {
        nx.turned = true;
        nx.onArriving();
      }
      renderCarousel();
      renderNextStrip();
      car.raf = 0;
      car.continuing = null;
      nx.done();
      return;
    }
    if (!nx.turned && (landed || (car.x - nx.x0) / nx.d >= CONTINUE_TURN)) {
      nx.turned = true;
      nx.onArriving();
    }
    renderCarousel();
    renderNextStrip();
    if (!landed) {
      car.raf = requestAnimationFrame(runCarousel);
    } else {
      car.raf = 0;
      car.continuing = null;
      nx.done();
    }
    return;
  }
  const r = car.returning;
  if (r) {
    // The way back: a cubic Hermite from (x0, v0) to (target, 0).
    if (!r.t0) r.t0 = now;
    const T = CAROUSEL_RETURN_MS / 1000;
    const p = Math.min(1, (now - r.t0) / CAROUSEL_RETURN_MS);
    const d = car.target - r.x0;
    car.x = r.x0 + d * (3 * p * p - 2 * p * p * p) + r.v0 * T * (p - 2 * p * p + p * p * p);
    car.v = (d * (6 * p - 6 * p * p) + r.v0 * T * (1 - 4 * p + 3 * p * p)) / T;
  } else {
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(1 / 240, left);
      car.v += (k * (car.target - car.x) - c * car.v) * h;
      car.x += car.v * h;
    }
  }
  const settled = r ? now - r.t0 >= CAROUSEL_RETURN_MS : Math.abs(car.target - car.x) < 0.05 && Math.abs(car.v) < 2;
  if (settled) {
    car.x = car.target;
    car.v = 0;
    car.opening = false;
  }
  if (!car.playing && (!car.opening || Math.abs(car.home - car.x) < 40)) startCarouselVideos();
  // The unfold closes with the row's travel home; interrupted, it eases out.
  const u = car.unfold;
  if (u && car.returning) {
    u.amount = Math.max(0, Math.min(1, 1 - Math.abs(car.target - car.x) / car.returning.from));
  } else if (u && !car.landed) {
    u.amount = car.opening
      ? Math.max(0, Math.min(1, (car.home - car.x) / u.from))
      : u.amount * Math.exp(-dt / UNFOLD_RELEASE);
    if (u.amount < 0.001) car.unfold = null;
  }
  if (settled && car.returning) {
    landCarousel();
    car.raf = 0;
    return;
  }
  renderCarousel();
  const moving = !car.landed && (!settled || !!car.unfold);
  car.raf = moving ? requestAnimationFrame(runCarousel) : 0;
  if (!moving) car.last = 0;
}

// Scrolling and keys move the target; the row follows on the spring.
// Input during the opening takes over from where the row is, at its
// current speed.
function pushCarousel(dx) {
  if (!car || car.single || car.returning || car.landed || car.continuing) return;
  car.spring = SPRING_SCROLL;
  car.opening = false;
  car.target += dx;
  if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
}

// Arrow keys: one portrait tile's width.
function nudgeCarousel(dir) {
  if (car) pushCarousel(dir * car.step);
}

let stopCarouselVideos = () => {};
// Videos in the row play only while on screen.
function startCarouselVideos() {
  if (!car || car.playing) return;
  car.playing = true;
  stopCarouselVideos = Media.playWhenVisible(carouselTrack, carouselEl);
}

function stopCarousel() {
  if (car && car.raf) cancelAnimationFrame(car.raf);
  stopCarouselVideos();
  stopCarouselVideos = () => {};
  car = null;
  carouselEl.classList.remove("is-waiting", "is-returning");
  carouselTrack.replaceChildren();
  projectPosition.textContent = "";
}

// Drag: the row follows the pointer one to one; on release it keeps the
// pointer's speed and coasts on the spring to a stop.
let drag = null;
carouselEl.addEventListener("pointerdown", (e) => {
  if (!car || car.single || car.returning || car.landed || car.continuing || e.button !== 0) return;
  drag = { x: e.clientX, v: 0, t: performance.now() };
  carouselEl.setPointerCapture(e.pointerId);
  carouselEl.classList.add("is-dragging");
  car.spring = SPRING_SCROLL;
  car.opening = false;
  car.target = car.x;
  car.v = 0;
});
carouselEl.addEventListener("pointermove", (e) => {
  if (!drag || !car) return;
  const dx = drag.x - e.clientX;
  const now = performance.now();
  const dt = Math.max(1, now - drag.t) / 1000;
  drag.v = drag.v * 0.6 + (dx / dt) * 0.4; // px/s, smoothed
  [drag.x, drag.t] = [e.clientX, now];
  car.x += dx;
  car.target = car.x;
  car.v = 0;
  renderCarousel();
});
["pointerup", "pointercancel"].forEach((type) =>
  carouselEl.addEventListener(type, () => {
    if (!drag) return;
    // A pause before letting go means no fling; a hard flick carries about
    // a screen at most.
    const v = performance.now() - drag.t > 80 ? 0 : Math.max(-4000, Math.min(4000, drag.v));
    drag = null;
    carouselEl.classList.remove("is-dragging");
    if (!car) return;
    car.v = v;
    car.target = car.x + v * CAROUSEL_FLING;
    if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  })
);

// A real change of size rebuilds the row at rest (first photo on
// column 1); resize events that leave it the same size change nothing.
let carouselResize = 0;
window.addEventListener("resize", () => {
  clearTimeout(carouselResize);
  carouselResize = setTimeout(() => {
    if (!car || !pstate.currentProject || projectEnv().state.currentPage !== "project") return;
    if (car.returning || car.continuing) return; // a page change is waiting on it
    const [w, h] = car.size;
    if (carouselEl.clientWidth === w && carouselEl.clientHeight === h) return;
    buildCarousel(pstate.currentProject, { settled: true });
  }, 150);
});



export {
  buildCarousel,
  carouselReady,
  glideCarousel,
  continueCarousel,
  returnCarousel,
  stopCarousel,
  dropNextStrip,
  pushCarousel,
  nudgeCarousel,
  car,
  nextStrip,
};
