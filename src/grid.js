/* Grid: placement, scroll reveal, MONO and the expanded-photo lightbox. */

import { Media } from "./media.js";
import {
  FADE_MS,
  GUTTER,
  mainTop,
  MARGIN,
  gridPanel,
  phoneLayout,
  rectFrame,
  reduceMotion,
  syncMainTop,
  touchLayout,
} from "./layout.js";
import { sheetOpen, sheets } from "./sheets.js";

let gridCleanup = () => {};

/* MONO drains the sheet to greyscale and back. The label never changes;
   its colour shows the state (aria-pressed in CSS). */
const monoButton = document.getElementById("nav-mono");
monoButton.addEventListener("click", () => {
  const on = gridPanel.classList.toggle("is-mono");
  monoButton.setAttribute("aria-pressed", String(on));
});

const photosBox = document.getElementById("photos");
const photos = Array.from(photosBox.querySelectorAll(".photo"));
for (let i = photos.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [photos[i], photos[j]] = [photos[j], photos[i]];
}
photos.forEach((photo) => photosBox.appendChild(photo));

/* Contact-sheet placement. Each row lists the columns its tiles start
   on — the six two-column slots (1, 3, 5, 7, 9, 11); the slots left out
   are the gaps that give the sheet its rhythm. A tile's shape comes from
   its own photo (data-orient): portrait 470:631, landscape 945:631, the
   site's two ratios. The pattern repeats for as many photos as there are. */
const SHEET = [
  [1, 3, 7, 11],
  [1, 3, 7, 9, 11],
  [1, 5, 7, 11],
  [3, 5, 9, 11],
  [1, 3, 7, 11],
  [1, 5, 9],
];

(function placePhotos() {
  let row = 0;
  let slot = 0;
  photos.forEach((photo) => {
    const pattern = SHEET[row % SHEET.length];
    photo.style.setProperty("--c", pattern[slot]);
    photo.style.setProperty("--r", row + 1);
    photo.dataset.slot = slot; // position in its row, for the scroll-in stagger
    photo.tabIndex = 0;
    photo.setAttribute("role", "button");
    photo.setAttribute("aria-label", "Expand photo");
    photo.classList.toggle("photo--landscape", photo.dataset.orient === "l");
    slot += 1;
    if (slot >= pattern.length) {
      slot = 0;
      row += 1;
    }
  });
})();

function revealPhotos() {
  syncMainTop();
  photos.forEach((p) => {
    p.classList.remove("is-in");
    p.style.removeProperty("--lead"); // the opening's beat again
  });
  const gridView = document.getElementById("grid");
  gridView.scrollTop = 0;
  void gridView.offsetWidth; // commit the hidden state so the reveal runs

  // The first screen is revealed right away with a stagger, in reading
  // order, without waiting on the observer.
  const bottom = gridView.getBoundingClientRect().bottom;
  const pending = new Set(photos);
  let order = 0;
  photos.forEach((p) => {
    if (p.getBoundingClientRect().top < bottom) {
      p.style.setProperty("--i", order++);
      p.classList.add("is-in");
      pending.delete(p);
    }
  });

  // Everything below arrives on its own as it scrolls into view, once a
  // tile is a little way past the bottom edge; tiles in the same row
  // cascade left to right. On touch sizes, where a flick travels far and
  // the rows are plain (two or three across, in order), a tile starts as
  // soon as it shows, without the opening's beat, so the sheet never
  // trails the finger with empty rows.
  const touch = touchLayout.matches;
  const perRow = phoneLayout.matches ? 2 : 3;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const p = entry.target;
        p.style.setProperty("--i", touch ? photos.indexOf(p) % perRow : p.dataset.slot);
        if (touch) p.style.setProperty("--lead", "0ms");
        p.classList.add("is-in");
        io.unobserve(p);
      });
    },
    touch
      ? { root: gridView, threshold: 0.05 }
      : { root: gridView, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
  );
  pending.forEach((p) => io.observe(p));
  const stopVideos = Media.playWhenVisible(gridView, gridView);
  gridCleanup = () => {
    io.disconnect();
    stopVideos();
    collapsePhoto(true);
    gridCleanup = () => {};
  };
}

/* ---------- Grid: expanded photo ----------
   A click lifts a copy of the tile's image into a fixed frame that moves
   to the centre and grows to the photo's full frame; a click anywhere,
   Escape, or leaving the grid sends it back. The copy travels on the
   soft in-out curve; the sheet behind it blurs and fades (styles.css). */
const EXPAND_MS = 600;
const EXPAND_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
// EXPAND_EASE as a function, for a scroll that runs alongside a flight.
function cubicBezier(x1, y1, x2, y2) {
  const bez = (a, b) => (t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const bx = bez(x1, x2);
  const by = bez(y1, y2);
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = bx(t) - x;
      const slope = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
      if (Math.abs(d) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= d / slope;
    }
    return by(Math.max(0, Math.min(1, t)));
  };
}
const expandEase = cubicBezier(0.65, 0, 0.35, 1);
const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.hidden = true;
gridPanel.appendChild(lightbox);
let expandedPhoto = null;


// The photo's frame: the site's two tile ratios only — a portrait in the
// 470:631 frame, a landscape in the 945:631 one (the photo is cropped to
// fit, as in the tiles) — at most 8 columns wide and the gallery's
// height, centred on the page both ways. On touch sizes (≤ 1100px) it
// uses the full width and centres under the sticky header.
const TOUCH_MAX = 1100;
const PORTRAIT = 470 / 631;
const LANDSCAPE = 945 / 631;
function expandedRect(media) {
  const touch = window.innerWidth <= TOUCH_MAX;
  const headerH = mainTop();
  const maxH = window.innerHeight - 2 * MARGIN - headerH;
  const col = (window.innerWidth - 2 * MARGIN - 11 * GUTTER) / 12;
  const maxW = touch ? window.innerWidth - 2 * MARGIN : col * 8 + 7 * GUTTER;
  // A lazy photo may not have loaded yet: its tile knows its shape.
  const natural = Media.size(media);
  const photo = media.closest(".photo");
  const wide = natural.width && natural.height ? natural.width > natural.height : !!photo && photo.dataset.orient === "l";
  const ratio = wide ? LANDSCAPE : PORTRAIT;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  const top = touch ? headerH + (window.innerHeight - headerH - height) / 2 : (window.innerHeight - height) / 2;
  return { left: (window.innerWidth - width) / 2, top, width, height };
}

function expandPhoto(photo) {
  if (expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  const media = photo.querySelector(Media.SELECTOR);
  const from = media.getBoundingClientRect();
  const to = expandedRect(media);
  const copy = Media.clone(media);
  lightbox.replaceChildren(copy);
  Object.assign(lightbox.style, rectFrame(from));
  lightbox.hidden = false;
  expandedPhoto = photo;
  photo.classList.add("is-source");
  gridPanel.classList.add("is-expanded");
  const timing = { duration: reduceMotion.matches ? 0 : EXPAND_MS, easing: EXPAND_EASE, fill: "forwards" };
  lightbox.animate([rectFrame(from), rectFrame(to)], timing);
}

function collapsePhoto(instant) {
  if (!expandedPhoto) return;
  const photo = expandedPhoto;
  expandedPhoto = null;
  gridPanel.classList.remove("is-expanded");
  const finish = () => {
    // The tile appears and the copy goes in the same frame — no fade
    // between them, so nothing can scroll one away from the other.
    photo.classList.add("is-landing"); // reveal without a transition
    photo.classList.remove("is-source");
    void photo.offsetWidth;
    if (!expandedPhoto) {
      lightbox.hidden = true;
      lightbox.replaceChildren(); // a video copy would play on unseen
    }
    gridPanel.classList.remove("is-collapsing");
    requestAnimationFrame(() => photo.classList.remove("is-landing"));
  };
  if (instant || reduceMotion.matches) {
    lightbox.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    lightbox.hidden = true;
    lightbox.replaceChildren();
    photo.classList.remove("is-source");
    return;
  }
  gridPanel.classList.add("is-collapsing");
  const from = lightbox.getBoundingClientRect();
  const source = photo.querySelector(Media.SELECTOR);
  let to = source.getBoundingClientRect();
  lightbox.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  // Only the visible (topmost) image flies back; anything left stacked
  // under it by an interrupted step goes now.
  const copies = Array.from(lightbox.children);
  copies.slice(0, -1).forEach((el) => el.remove());
  const timing = { duration: EXPAND_MS, easing: EXPAND_EASE, fill: "forwards" };
  // After stepping, the tile may be off screen. On desktop the sheet
  // comes to meet the photo (below); on touch sizes the frame fades out
  // where it is and the sheet lands on that tile under the blur.
  const offScreen = to.bottom < 0 || to.top > window.innerHeight;
  if (offScreen && touchLayout.matches) {
    photo.scrollIntoView({ block: "center" });
    to = source.getBoundingClientRect();
    const back = lightbox.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease", fill: "forwards" });
    back.onfinish = finish;
    return;
  }
  if (offScreen) {
    // The sheet scrolls to bring the tile to the centre while the photo
    // flies to it — on the flight's own curve and
    // duration, so the two arrive together. A tile that has not yet
    // been revealed (it would rise 24px as it came into view) is settled
    // in place first, so the photo lands where the tile will be.
    if (!photo.classList.contains("is-in")) {
      photo.classList.add("is-settled", "is-in");
      void photo.offsetWidth;
      photo.classList.remove("is-settled");
      to = source.getBoundingClientRect();
    }
    const gridView = document.getElementById("grid");
    const startTop = gridView.scrollTop;
    const viewTop = gridView.getBoundingClientRect().top;
    const centred = (window.innerHeight - to.height) / 2;
    const endTop = Math.max(0, Math.min(gridView.scrollHeight - gridView.clientHeight, startTop + to.top - viewTop - (centred - viewTop)));
    to = { left: to.left, top: to.top - (endTop - startTop), width: to.width, height: to.height };
    const t0 = performance.now();
    const scrollStep = (now) => {
      const p = Math.min(1, (now - t0) / EXPAND_MS);
      gridView.scrollTop = startTop + (endTop - startTop) * expandEase(p);
      if (p < 1 && gridPanel.classList.contains("is-collapsing")) requestAnimationFrame(scrollStep);
    };
    requestAnimationFrame(scrollStep);
  }
  // The frame shrinks onto the tile, the photo as the tile shows it.
  const back = lightbox.animate([rectFrame(from), rectFrame(to)], timing);
  back.onfinish = finish;
}

// The arrow keys and the wheel step the expanded photo through the
// sheet: the frame glides to the next photo's size while the image
// crossfades inside it. The sheet behind holds still; the return flight
// deals with a tile that has gone off screen (see collapsePhoto).
const STEP_MS = 700;
function stepExpanded(dir) {
  if (!expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  const next = photos[(photos.indexOf(expandedPhoto) + dir + photos.length) % photos.length];
  const media = next.querySelector(Media.SELECTOR);
  const previous = expandedPhoto;
  expandedPhoto = next;
  previous.classList.remove("is-source");
  next.classList.add("is-source");
  // Focus follows the photo on show, so closing lands the keyboard on it.
  next.focus({ preventScroll: true });

  const from = lightbox.getBoundingClientRect();
  const to = expandedRect(media);
  lightbox.getAnimations().forEach((a) => a.cancel());
  Object.assign(lightbox.style, rectFrame(from));
  const timing = { duration: reduceMotion.matches ? 0 : STEP_MS, easing: EXPAND_EASE, fill: "forwards" };
  lightbox.animate([rectFrame(from), rectFrame(to)], timing);

  const old = Array.from(lightbox.children);
  const copy = Media.clone(media);
  lightbox.appendChild(copy);
  copy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduceMotion.matches ? 0 : FADE_MS, easing: "ease", fill: "forwards" }).onfinish = () => {
    old.forEach((el) => el.remove());
  };
}

// The expanded photo follows a resize or a rotation.
window.addEventListener("resize", () => {
  if (!expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  lightbox.getAnimations().forEach((a) => a.cancel());
  Object.assign(lightbox.style, rectFrame(expandedRect(expandedPhoto.querySelector(Media.SELECTOR))));
});

// By keyboard: Enter or Space on a tile expands it.
gridPanel.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const photo = e.target.closest(".photo");
  if (!photo || expandedPhoto) return;
  e.preventDefault();
  expandPhoto(photo);
});

document.addEventListener("keydown", (e) => {
  if (!expandedPhoto || sheets.some(sheetOpen)) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    stepExpanded(1);
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    stepExpanded(-1);
  }
});

// Touch: while a photo is expanded the sheet holds still (styles.css,
// touch-action), a sideways swipe steps to the previous or next photo and
// a swipe down closes it; a tap closes it too (the click below).
let lightboxSwipe = null;
let lightboxSwiped = 0;
gridPanel.addEventListener("pointerdown", (e) => {
  if (!expandedPhoto || e.pointerType === "mouse") return;
  lightboxSwipe = { x: e.clientX, y: e.clientY };
});
gridPanel.addEventListener("pointerup", (e) => {
  const start = lightboxSwipe;
  lightboxSwipe = null;
  if (!start || !expandedPhoto) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    stepExpanded(dx < 0 ? 1 : -1); // swipe left: the next photo
    lightboxSwiped = performance.now();
  } else if (dy > 60 && dy > Math.abs(dx)) {
    collapsePhoto(false);
    lightboxSwiped = performance.now();
  }
});
gridPanel.addEventListener("pointercancel", () => (lightboxSwipe = null));

gridPanel.addEventListener("click", (e) => {
  if (performance.now() - lightboxSwiped < 500) return; // the swipe's own click
  if (expandedPhoto) {
    collapsePhoto(false);
    return;
  }
  const photo = e.target.closest(".photo");
  if (photo) expandPhoto(photo);
});

// The wheel steps the expanded photo by distance, like the arrow keys:
// every SCROLL_STEP px of travel is one photo, at most one every
// SCROLL_GAP ms, so a long scroll runs through several and a short one
// moves one. Either axis counts (a trackpad swipe sideways or a wheel).
const SCROLL_STEP = 100;
const SCROLL_GAP = 160;
const scroll = { acc: 0, at: 0, stepped: 0 };
function scrollExpanded(delta, now) {
  if (now - scroll.at > 200) scroll.acc = 0; // a fresh gesture starts clean
  scroll.at = now;
  scroll.acc += delta;
  if (Math.abs(scroll.acc) < SCROLL_STEP || now - scroll.stepped < SCROLL_GAP) return;
  stepExpanded(Math.sign(scroll.acc));
  scroll.acc = 0;
  scroll.stepped = now;
}

// While a photo is expanded the sheet holds still: the wheel is taken
// here (rather than by overflow: hidden, so the browser keeps the
// gesture on the sheet) and steps the photo; while the photo flies back
// the sheet waits for it to land. A click or Escape closes.
gridPanel.addEventListener("wheel", (e) => {
  if (gridPanel.classList.contains("is-collapsing")) {
    e.preventDefault();
    return;
  }
  if (!expandedPhoto) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
  scrollExpanded((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit, e.timeStamp);
}, { passive: false });



export { gridPanel, photos, monoButton, revealPhotos, collapsePhoto };
export const cleanupGrid = () => gridCleanup();
export const hasExpandedPhoto = () => !!expandedPhoto;
