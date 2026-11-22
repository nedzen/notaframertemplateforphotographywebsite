// Expanded-photo lightbox. A tile's media is cloned into a fixed frame
// that flies to the centre and grows to the photo's full frame; a click,
// Escape, a swipe or leaving the sheet sends it back. Arrow keys and the
// wheel step through the photos, crossfading inside the moving frame.
//
// The lightbox owns only its frame and gestures. It never reads app state:
// callers pass the photo list and, if they need layer precedence, whether
// stepping is allowed.

import { Media } from "../../core/media.js";
import { rectFrame } from "../../core/dom.js";
import { durations, easings, layout, ratios } from "../../core/config.js";
import { cubicBezier, reduceMotion } from "../../core/motion.js";

const EXPAND_EASE = easings.smooth;
const expandEase = cubicBezier(0.65, 0, 0.35, 1);
const SCROLL_STEP = 100; // px of wheel travel per photo
const SCROLL_GAP = 160; // ms minimum between wheel steps
const SWIPE_CLICK_GUARD = 500; // ms after a swipe in which its click is ignored

export function createLightbox({
  container,
  photos,
  margin = layout.margin,
  gutter = layout.gutter,
  columns = layout.columns,
  maxColumns = layout.lightboxMaxColumns,
  expandMs = durations.expand,
  stepMs = durations.step,
  fadeMs = durations.fade,
  isTouch = () => false,
  getHeaderHeight = () => 0,
  canStep = () => true,
  escape = false,
  onOpen = () => {},
  onClose = () => {},
}) {
  const controller = new AbortController();
  const el = document.createElement("div");
  el.className = "lightbox";
  el.hidden = true;
  container.appendChild(el);

  let expandedPhoto = null;
  let swipe = null;
  let swipedAt = 0;
  const scroll = { acc: 0, at: 0, stepped: 0 };

  // The photo's frame: the site's two tile ratios only — a portrait in the
  // 470:631 frame, a landscape in the 945:631 one (the photo is cropped to
  // fit, as in the tiles) — at most `maxColumns` wide and the gallery's
  // height, centred on the page both ways. On touch sizes it uses the full
  // width and centres under the sticky header.
  function expandedRect(media) {
    const touch = isTouch();
    const headerH = getHeaderHeight();
    const maxH = window.innerHeight - 2 * margin - headerH;
    const col = (window.innerWidth - 2 * margin - (columns - 1) * gutter) / columns;
    const maxW = touch
      ? window.innerWidth - 2 * margin
      : col * maxColumns + (maxColumns - 1) * gutter;
    // A lazy photo may not have loaded yet: its tile knows its shape.
    const natural = Media.size(media);
    const photo = media.closest(".photo");
    const wide =
      natural.width && natural.height
        ? natural.width > natural.height
        : !!photo && photo.dataset.orient === "l";
    const ratio = wide ? ratios.landscape : ratios.portrait;
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }
    const top = touch
      ? headerH + (window.innerHeight - headerH - height) / 2
      : (window.innerHeight - height) / 2;
    return { left: (window.innerWidth - width) / 2, top, width, height };
  }

  function expand(photo) {
    if (expandedPhoto || container.classList.contains("is-collapsing")) return;
    const media = photo.querySelector(Media.SELECTOR);
    if (!media) return;
    const from = media.getBoundingClientRect();
    const to = expandedRect(media);
    const copy = Media.clone(media);
    el.replaceChildren(copy);
    Object.assign(el.style, rectFrame(from));
    el.hidden = false;
    expandedPhoto = photo;
    photo.classList.add("is-source");
    container.classList.add("is-expanded");
    const timing = {
      duration: reduceMotion.matches ? 0 : expandMs,
      easing: EXPAND_EASE,
      fill: "forwards",
    };
    el.animate([rectFrame(from), rectFrame(to)], timing);
    onOpen(photo);
  }

  function collapse(instant = false) {
    if (!expandedPhoto) return;
    const photo = expandedPhoto;
    expandedPhoto = null;
    container.classList.remove("is-expanded");
    const finish = () => {
      // The tile appears and the copy goes in the same frame — no fade
      // between them, so nothing can scroll one away from the other.
      photo.classList.add("is-landing"); // reveal without a transition
      photo.classList.remove("is-source");
      void photo.offsetWidth;
      if (!expandedPhoto) {
        el.hidden = true;
        el.replaceChildren(); // a video copy would play on unseen
      }
      container.classList.remove("is-collapsing");
      requestAnimationFrame(() => photo.classList.remove("is-landing"));
      onClose(photo);
    };
    if (instant || reduceMotion.matches) {
      el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      el.hidden = true;
      el.replaceChildren();
      photo.classList.remove("is-source");
      container.classList.remove("is-collapsing");
      onClose(photo);
      return;
    }
    container.classList.add("is-collapsing");
    const from = el.getBoundingClientRect();
    const source = photo.querySelector(Media.SELECTOR);
    let to = source.getBoundingClientRect();
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    // Only the visible (topmost) image flies back; anything left stacked
    // under it by an interrupted step goes now.
    const copies = Array.from(el.children);
    copies.slice(0, -1).forEach((node) => node.remove());
    const timing = { duration: expandMs, easing: EXPAND_EASE, fill: "forwards" };
    // After stepping, the tile may be off screen. On desktop the sheet
    // comes to meet the photo; on touch sizes the frame fades out where it
    // is and the sheet lands on that tile under the blur.
    const offScreen = to.bottom < 0 || to.top > window.innerHeight;
    if (offScreen && isTouch()) {
      photo.scrollIntoView({ block: "center" });
      to = source.getBoundingClientRect();
      const back = el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: fadeMs,
        easing: "ease",
        fill: "forwards",
      });
      back.onfinish = finish;
      return;
    }
    if (offScreen) {
      // The sheet scrolls to bring the tile to the centre while the photo
      // flies to it — on the flight's own curve and duration, so the two
      // arrive together. A tile that has not yet been revealed (it would
      // rise 24px as it came into view) is settled in place first, so the
      // photo lands where the tile will be.
      if (!photo.classList.contains("is-in")) {
        photo.classList.add("is-settled", "is-in");
        void photo.offsetWidth;
        photo.classList.remove("is-settled");
        to = source.getBoundingClientRect();
      }
      const startTop = container.scrollTop;
      const viewTop = container.getBoundingClientRect().top;
      const centred = (window.innerHeight - to.height) / 2;
      const endTop = Math.max(
        0,
        Math.min(
          container.scrollHeight - container.clientHeight,
          startTop + to.top - viewTop - (centred - viewTop)
        )
      );
      to = { left: to.left, top: to.top - (endTop - startTop), width: to.width, height: to.height };
      const t0 = performance.now();
      const scrollStep = (now) => {
        const p = Math.min(1, (now - t0) / expandMs);
        container.scrollTop = startTop + (endTop - startTop) * expandEase(p);
        if (p < 1 && container.classList.contains("is-collapsing"))
          requestAnimationFrame(scrollStep);
      };
      requestAnimationFrame(scrollStep);
    }
    // The frame shrinks onto the tile, the photo as the tile shows it.
    const back = el.animate([rectFrame(from), rectFrame(to)], timing);
    back.onfinish = finish;
  }

  // The arrow keys and the wheel step the expanded photo through the
  // sheet: the frame glides to the next photo's size while the image
  // crossfades inside it. The sheet behind holds still; the return flight
  // deals with a tile that has gone off screen.
  function step(dir) {
    if (!expandedPhoto || container.classList.contains("is-collapsing")) return;
    const next = photos[(photos.indexOf(expandedPhoto) + dir + photos.length) % photos.length];
    if (!next) return;
    const media = next.querySelector(Media.SELECTOR);
    if (!media) return;
    const previous = expandedPhoto;
    expandedPhoto = next;
    previous.classList.remove("is-source");
    next.classList.add("is-source");
    // Focus follows the photo on show, so closing lands the keyboard on it.
    next.focus({ preventScroll: true });

    const from = el.getBoundingClientRect();
    const to = expandedRect(media);
    el.getAnimations().forEach((a) => a.cancel());
    Object.assign(el.style, rectFrame(from));
    const timing = {
      duration: reduceMotion.matches ? 0 : stepMs,
      easing: EXPAND_EASE,
      fill: "forwards",
    };
    el.animate([rectFrame(from), rectFrame(to)], timing);

    const old = Array.from(el.children);
    const copy = Media.clone(media);
    el.appendChild(copy);
    copy
      .animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: reduceMotion.matches ? 0 : fadeMs,
        easing: "ease",
        fill: "forwards",
      })
      .onfinish = () => old.forEach((node) => node.remove());
  }

  function scrollStep(delta, now) {
    if (now - scroll.at > 200) scroll.acc = 0; // a fresh gesture starts clean
    scroll.at = now;
    scroll.acc += delta;
    if (Math.abs(scroll.acc) < SCROLL_STEP || now - scroll.stepped < SCROLL_GAP) return;
    step(Math.sign(scroll.acc));
    scroll.acc = 0;
    scroll.stepped = now;
  }

  const on = (target, type, fn, options = {}) =>
    target.addEventListener(type, fn, { ...options, signal: controller.signal });

  // By keyboard: Enter or Space on a tile expands it.
  on(container, "keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const photo = e.target.closest(".photo");
    if (!photo || expandedPhoto) return;
    e.preventDefault();
    expand(photo);
  });

  on(document, "keydown", (e) => {
    if (e.key === "Escape" && escape && expandedPhoto) {
      e.preventDefault();
      collapse(false);
      return;
    }
    if (!expandedPhoto || !canStep()) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    }
  });

  // Touch: while a photo is expanded the sheet holds still
  // (scss/components/_grid.scss, touch-action), a sideways swipe steps and a swipe down closes.
  on(container, "pointerdown", (e) => {
    if (!expandedPhoto || e.pointerType === "mouse") return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  on(container, "pointerup", (e) => {
    const start = swipe;
    swipe = null;
    if (!start || !expandedPhoto) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1); // swipe left: the next photo
      swipedAt = performance.now();
    } else if (dy > 60 && dy > Math.abs(dx)) {
      collapse(false);
      swipedAt = performance.now();
    }
  });
  on(container, "pointercancel", () => (swipe = null));

  on(container, "click", (e) => {
    if (performance.now() - swipedAt < SWIPE_CLICK_GUARD) return; // the swipe's own click
    if (expandedPhoto) {
      collapse(false);
      return;
    }
    const photo = e.target.closest(".photo");
    if (photo) expand(photo);
  });

  // While a photo is expanded the sheet holds still: the wheel is taken
  // here and steps the photo; while the photo flies back the sheet waits
  // for it to land.
  on(
    container,
    "wheel",
    (e) => {
      if (container.classList.contains("is-collapsing")) {
        e.preventDefault();
        return;
      }
      if (!expandedPhoto) return;
      e.preventDefault();
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
      const axis = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      scrollStep(axis * unit, e.timeStamp);
    },
    { passive: false }
  );

  // The expanded photo follows a resize or a rotation.
  on(window, "resize", () => {
    if (!expandedPhoto || container.classList.contains("is-collapsing")) return;
    el.getAnimations().forEach((a) => a.cancel());
    Object.assign(el.style, rectFrame(expandedRect(expandedPhoto.querySelector(Media.SELECTOR))));
  });

  function destroy() {
    controller.abort();
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    el.remove();
    expandedPhoto = null;
  }

  return {
    element: el,
    expand,
    collapse,
    step,
    isOpen: () => !!expandedPhoto,
    destroy,
  };
}
