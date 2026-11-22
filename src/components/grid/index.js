// Grid component: contact-sheet placement, scroll reveal, MONO and the
// expanded-photo lightbox, assembled from the parts next to this file.
//
// It only needs its own DOM: a scrolling root, a container of `.photo`
// figures with `data-orient="p" | "l"`, and optionally a MONO button. The
// app passes `isBlocked` to stop keyboard stepping while a sheet is over
// the grid, and `beforeReveal` to sync layout measurements.

import { qsa } from "../../core/dom.js";
import { touchLayout, phoneLayout } from "../../core/viewport.js";
import { createLightbox } from "./lightbox.js";
import { createMono } from "./mono.js";
import { placePhotos, shuffle } from "./placement.js";
import { createReveal } from "./reveal.js";

export function createGrid({
  root,
  photosRoot,
  monoButton = null,
  isBlocked = () => false,
  escape = true,
  beforeReveal = () => {},
  isTouch = () => touchLayout.matches,
  isPhone = () => phoneLayout.matches,
  getHeaderHeight = () => 0,
  pattern,
} = {}) {
  // The grid is shuffled on every load.
  const photos = shuffle(qsa(".photo", photosRoot));
  photos.forEach((photo) => photosRoot.appendChild(photo));
  placePhotos(photos, pattern ? { pattern } : undefined);

  const reveal = createReveal({
    container: root,
    photos,
    isTouch,
    perRow: () => (isPhone() ? 2 : 3),
    beforeReveal,
  });

  const lightbox = createLightbox({
    container: root,
    photos,
    isTouch,
    getHeaderHeight,
    canStep: () => !isBlocked(),
    escape,
  });

  const mono = createMono(monoButton, root);

  return {
    root,
    photos,
    monoButton,
    mono,
    lightbox,
    reveal: reveal.run,
    collapse: lightbox.collapse,
    hasExpanded: lightbox.isOpen,
    cleanup() {
      reveal.stop();
      lightbox.collapse(true);
    },
    destroy() {
      reveal.stop();
      lightbox.destroy();
      mono.destroy();
    },
  };
}
