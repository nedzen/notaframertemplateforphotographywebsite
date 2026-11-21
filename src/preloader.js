/* Preloader and entrance: run the photo cycle, land on the first tile,
   then reveal the page and apply a deep-linked view. */

import { Media } from "./media.js";
import {
  count,
  defaultRow,
  gallery,
  phoneLayout,
  rectFrame,
  page,
  reduceMotion,
  rows,
  sets,
  tickCount,
} from "./layout.js";
import { applyRoute } from "./transitions.js";
import { routeHash } from "./router.js";
import { syncAutoplay } from "./index.js";

/* ---------- Preloader ----------
   A frame half the size of the first tile, centred on the page
   horizontally and on the gallery vertically, cycles its photos with a
   top-down reveal, then grows onto the first tile. The tile is revealed
   under it the moment it lands, so the hand-off is invisible. */
const preloader = document.getElementById("preloader");
const frame = preloader && preloader.querySelector(".preloader__frame");
const PRELOAD_START = 200;  // ms before the first photo arrives
const PRELOAD_STEP = 380;   // ms between photos (shorter than the 0.7s clip, so they cascade)
const PRELOAD_SETTLE = 700; // ms for the last photo's clip to open before the expand
const PRELOAD_HOLD = 180;   // ms the last photo rests before expanding
const PRELOAD_EXPAND = 1200;
// With six photos: 200 + 5 × 310 + 450 = 2.2s from start to the last
// clip opening, then the hold, then the expand.

// The other projects' photos may hold their file in data-src, so they
// don't compete with the preloader's first photo.
// Starting during the cycle gives them its length to arrive before the
// first hover.
function loadWaitingPhotos() {
  gallery.querySelectorAll("img[data-src]").forEach((img) => {
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}

// Each photo in its own clipped layer, revealed top-down while the photo
// zooms out (styles.css); the previous photo just sits underneath. New
// reveals start before the last zoom has settled. Resolves once the last
// photo's clip is open.
function runCycle(sources) {
  setTimeout(loadWaitingPhotos, PRELOAD_START + PRELOAD_STEP); // the first photo is on screen by then
  const layers = sources.map((src) => {
    const layer = document.createElement("div");
    layer.className = "preloader__layer";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    layer.appendChild(img);
    return frame.appendChild(layer);
  });
  return new Promise((resolve) => {
    layers.forEach((layer, i) => {
      setTimeout(() => layer.classList.add("is-shown"), PRELOAD_START + i * PRELOAD_STEP);
    });
    setTimeout(resolve, PRELOAD_START + (layers.length - 1) * PRELOAD_STEP + PRELOAD_SETTLE);
  });
}

function firstTileRect() {
  // A first project with no media yet lands on the gallery's box.
  const set = defaultRow && sets.get(defaultRow.dataset.project);
  return ((set && set.querySelector(".tile")) || gallery).getBoundingClientRect();
}

// Where the frame cycles. Desktop and tablet: half the first tile,
// centred on the page across and on the gallery down. Phone: the first
// tile there is small and near the top, so the frame takes 42% of the
// width at the tile's ratio, centred on the screen, then glides up into
// the tile.
function frameRect() {
  const t = firstTileRect();
  let w, h, left, top;
  if (phoneLayout.matches) {
    w = window.innerWidth * 0.42;
    h = (w * t.height) / t.width;
    [left, top] = [(window.innerWidth - w) / 2, (window.innerHeight - h) / 2];
  } else {
    [w, h] = [t.width / 2, t.height / 2];
    [left, top] = [window.innerWidth / 2 - w / 2, t.top + t.height / 2 - h / 2];
  }
  return { left, top, width: w, height: h };
}

function placeFrame() {
  Object.assign(frame.style, rectFrame(frameRect()));
}

function runPreloader() {
  if (!preloader) return Promise.resolve();
  // The preloader lands on the index's first tile, so it only makes
  // sense for the index: a URL with a hash skips it and opens its page.
  if (reduceMotion.matches || routeHash()) {
    preloader.remove();
    return Promise.resolve();
  }

  page.classList.add("is-preloading");
  placeFrame();
  window.addEventListener("resize", placeFrame);

  // The markup's images are only the source list; build the layers from it.
  const sources = Array.from(frame.querySelectorAll("img")).map((img) => img.getAttribute("src"));
  frame.replaceChildren();

  return runCycle(sources)
    .then(() => new Promise((r) => setTimeout(r, PRELOAD_HOLD)))
    .then(
      () =>
        new Promise((resolve) => {
          window.removeEventListener("resize", placeFrame);
          const grow = frame.animate([rectFrame(frame.getBoundingClientRect()), rectFrame(firstTileRect())], {
            duration: PRELOAD_EXPAND,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            fill: "forwards",
          });
          // A resize mid-grow re-aims it, from where the frame would cycle
          // now to where the tile now is, keeping its progress.
          const reaim = () => grow.effect.setKeyframes([rectFrame(frameRect()), rectFrame(firstTileRect())]);
          window.addEventListener("resize", reaim);
          grow.onfinish = () => {
            window.removeEventListener("resize", reaim);
            resolve();
          };
        })
    );
}

/* ---------- Entrance ----------
   Wait for the font and the preloader's images (capped so a slow network
   can't hold the page), run the preloader, then flip the class that lets
   the CSS transitions run. The count ticks up in the same window as
   INDEX rising. */
function enter() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadWaitingPhotos(); // no preloader ran, if they're still waiting
      page.inert = false;
      page.classList.add("is-loaded");
      syncAutoplay();
      // The first tile is now visible under the frame; drop the frame on
      // the next paint.
      if (preloader) {
        requestAnimationFrame(() => {
          preloader.remove();
          page.classList.remove("is-preloading");
        });
      }
      if (reduceMotion.matches) {
        count.textContent = String(rows.length);
      } else {
        tickCount(rows.length, 1100, 900);
      }
      // Past the end of the longest transition (the main hairline).
      setTimeout(() => page.classList.remove("is-entering"), 3000);
      // A hash on the URL opens its page straight away (no preloader ran).
      if (routeHash()) applyRoute({ direct: true });

      // Decode the other sets' images while idle so the first hover on a
      // project doesn't spend its opening frames decoding a JPEG.
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
      idle(() => {
        sets.forEach((set) => {
          if (set.classList.contains("is-active")) return;
          set.querySelectorAll("img").forEach((img) => img.decode().catch(() => {}));
        });
      });
    });
  });
}

const firstMedia = Array.from(
  (defaultRow ? sets.get(defaultRow.dataset.project).querySelectorAll(Media.SELECTOR) : [])
).concat(frame ? Array.from(frame.querySelectorAll("img")) : []);
const ready = Promise.all([
  document.fonts.ready,
  ...firstMedia.map((el) => Media.ready(el)),
]);
export const startEntrance = () =>
  Promise.race([ready, new Promise((r) => setTimeout(r, 2000))])
    .then(runPreloader)
    .then(enter);
