export const Media = (() => {
  const SELECTOR = "img, video";
  const isVideo = (el) => el.tagName === "VIDEO";

  // Resolves once the element can paint: a decoded image or a video
  // with its first frame. Never rejects, and never waits longer than
  // `cap`, so a slow network can't hold a page.
  function ready(el, cap = 2000) {
    let wait;
    if (isVideo(el)) {
      wait =
        el.readyState >= 2
          ? Promise.resolve()
          : new Promise((resolve) => {
              el.addEventListener("loadeddata", resolve, { once: true });
              el.addEventListener("error", resolve, { once: true });
            });
    } else {
      wait = el.decode ? el.decode().catch(() => {}) : Promise.resolve();
    }
    return Promise.race([wait, new Promise((r) => setTimeout(r, cap))]);
  }

  // Natural size, for fitting a frame to the media's own ratio.
  function size(el) {
    if (isVideo(el)) return { width: el.videoWidth, height: el.videoHeight };
    return { width: el.naturalWidth, height: el.naturalHeight };
  }

  // A copy for an expanded view. It starts on the tile's own (already
  // decoded) file so nothing blanks; if the tile names a larger file in
  // data-full, that one is swapped in once it has decoded. A video copy
  // picks up from the same moment as the tile.
  function clone(el) {
    const copy = el.cloneNode();
    copy.removeAttribute("loading");
    if (isVideo(el)) {
      copy.muted = true;
      copy.currentTime = el.currentTime;
      copy.play().catch(() => {});
    } else if (el.dataset.full) {
      const full = new Image();
      full.src = el.dataset.full;
      full.decode().then(() => {
        if (copy.isConnected) copy.src = el.dataset.full;
      }).catch(() => {});
    }
    return copy;
  }

  const play = (v) => v.play().catch(() => {});
  const pause = (v) => v.pause();

  // Play the videos inside `container`, pause the rest of `others`.
  function playWithin(container, others = []) {
    others.forEach((o) => o !== container && o.querySelectorAll("video").forEach(pause));
    if (container) container.querySelectorAll("video").forEach(play);
  }

  // Videos under `container` play only while on screen (in `root`, or
  // the viewport). Returns a stop function.
  function playWhenVisible(container, root = null) {
    const videos = Array.from(container.querySelectorAll("video"));
    if (!videos.length) return () => {};
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? play : pause)(e.target)),
      { root, threshold: 0.01 }
    );
    videos.forEach((v) => io.observe(v));
    return () => {
      io.disconnect();
      videos.forEach(pause);
    };
  }

  return { SELECTOR, isVideo, ready, size, clone, playWithin, playWhenVisible };
})();

// The bundle ships full-resolution files, so the template's size hints are
// no-ops; they stay here as the single place to add variants later.
export const sized = (url) => url || "";
export const photoSize = () => 1024;


