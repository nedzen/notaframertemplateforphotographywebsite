// Scroll reveal: the first screen arrives in reading order with a stagger;
// everything below rises in as it enters view. The sheet controls the
// scroll position, so the observer is rooted to it.

import { Media } from "../../core/media.js";

export function createReveal({
  container,
  photos,
  isTouch = () => false,
  perRow = 3,
  beforeReveal = () => {},
}) {
  let observer = null;
  let stopVideos = () => {};

  function stop() {
    if (observer) observer.disconnect();
    observer = null;
    stopVideos();
    stopVideos = () => {};
  }

  function run() {
    stop();
    beforeReveal();
    photos.forEach((p) => {
      p.classList.remove("is-in");
      p.style.removeProperty("--lead"); // the opening's beat again
    });
    container.scrollTop = 0;
    void container.offsetWidth; // commit the hidden state so the reveal runs

    // The first screen is revealed right away with a stagger, in reading
    // order, without waiting on the observer.
    const bottom = container.getBoundingClientRect().bottom;
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
    const touch = isTouch();
    const per = typeof perRow === "function" ? perRow() : perRow;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const p = entry.target;
          p.style.setProperty("--i", touch ? photos.indexOf(p) % per : p.dataset.slot);
          if (touch) p.style.setProperty("--lead", "0ms");
          p.classList.add("is-in");
          observer.unobserve(p);
        });
      },
      touch
        ? { root: container, threshold: 0.05 }
        : { root: container, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );
    pending.forEach((p) => observer.observe(p));
    stopVideos = Media.playWhenVisible(container, container);
  }

  return { run, stop };
}
