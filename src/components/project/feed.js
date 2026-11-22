// Project page on phones: the vertical feed.

import { Media } from "../../core/media.js";
import { qs } from "../../core/dom.js";
import { layout } from "../../core/config.js";
import { reduceMotion, spring } from "../../core/motion.js";
import {
  UNFOLD,
  clamp01,
  feedEl,
  feedOn,
  makeMedia,
  projectMedia,
  projectPanel,
  projectPosition,
  stripReady,
} from "./context.js";

// Every photo of the project stacked full width at its own shape (a
// portrait 470:631, a landscape 945:631), `gutter` apart; the page scrolls
// through them and each fades in rising 24px as it arrives (the grid's
// reveal; the first screen staggered). Like the desktop row it never
// ends: nearing the end, the series is laid on again, and the header's
// count wraps with it. Videos play only while on screen.
let feedCleanup = () => {};
let feedNext = null;

function buildFeed(row) {
  feedCleanup();
  const data = projectMedia()[row.dataset.project];
  if (!data || !data.media.length) return;
  const n = data.media.length;
  const items = []; // every figure laid so far, in order
  const stops = []; // each pass's video watcher
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    io.unobserve(en.target);
  }), { root: projectPanel, rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  const first = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    first.unobserve(en.target);
  }), { root: projectPanel, rootMargin: "0px 0px 25% 0px" });

  // One more pass of the series.
  const lay = () => {
    const pass = document.createElement("div");
    pass.className = "feed__pass";
    data.media.forEach((item, i) => {
      const media = makeMedia(item);
      if (media.tagName === "VIDEO") {
        media.autoplay = false; // started while on screen
        media.preload = "metadata";
      } else if (items.length + i > 1) {
        media.loading = "lazy";
      }
      const fig = document.createElement("figure");
      fig.className = `feed__item feed__item--${item.o === "l" ? "l" : "p"}`;
      fig.appendChild(media);
      pass.appendChild(fig);
      items.push(fig);
      io.observe(fig);
    });
    feedEl.appendChild(pass);
    stops.push(Media.playWhenVisible(pass, projectPanel));
  };

  // The header line stays under the nav (scss/components/_project.scss);
  // the first photo starts 10px under it, where the header ends.
  const place = () =>
    (projectPanel.style.paddingTop = `${qs(".header").getBoundingClientRect().bottom}px`);
  place();
  feedEl.style.transform = "";
  lay();
  projectPanel.scrollTop = 0;

  // Keep a screen and a half laid ahead; count the photo crossing 40% of
  // the screen's height, within its pass.
  const pad = (k) => String(k).padStart(2, "0");
  const update = () => {
    if (!feedOn()) return; // on its way out: the layout just changed
    while (projectPanel.scrollTop + projectPanel.clientHeight * 2.5 > projectPanel.scrollHeight) {
      const before = projectPanel.scrollHeight;
      lay();
      if (projectPanel.scrollHeight <= before) break; // nothing laid out: never loop on it
    }
    const line = window.innerHeight * 0.4;
    let at = 0;
    for (let i = 0; i < items.length && items[i].getBoundingClientRect().top <= line; i++) at = i;
    projectPosition.textContent = `${pad((at % n) + 1)} / ${pad(n)}`;
  };
  let frame = 0;
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), update()));
  };
  projectPanel.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", place);
  update();
  if (feedNext) {
    // Arriving under the column that brought these photos in: laid out of
    // sight, already in place, and shown when the column has landed.
    feedEl.classList.add("is-under");
    items.forEach((f) => f.classList.add("is-in", "is-settled"));
    const show = () => {
      feedEl.classList.remove("is-under");
      requestAnimationFrame(() => dropFeedNext());
    };
    if (feedNext.landed) show();
    else feedNext.onLanded = show;
  } else {
    // The first screen arrives staggered — every photo with any part on
    // screen, however little (the scroll-in line, 8% up, would leave one
    // peeking at the bottom blank), with a quarter screen to spare: iOS
    // Safari can measure the screen short of its floating toolbar while
    // photos still show under it. The rest arrive as they scroll in.
    let order = 0;
    items.forEach((f) => {
      const onScreen = f.getBoundingClientRect().top < window.innerHeight * 1.25;
      f.style.setProperty("--i", onScreen ? order++ : 0);
      if (onScreen) first.observe(f);
    });
  }
  feedCleanup = () => {
    io.disconnect();
    first.disconnect();
    stops.forEach((stop) => stop());
    cancelAnimationFrame(frame);
    projectPanel.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", place);
    projectPanel.style.removeProperty("padding-top");
    feedEl.replaceChildren();
    feedEl.style.transform = "";
    feedEl.classList.remove("is-under");
    feedCleanup = () => {};
  };
}

// NEXT on the phone feed: the vertical twin of the desktop NEXT. The next
// project's photos are laid just below the last photo on screen, in a
// column of their own over the feed, and everything glides up on a spring
// (the scroll's kind, its pull building over 0.35s) until the next
// project's first photo rests under the header line. The incoming photos
// arrive unfolded — each held down by UNFOLD of its distance below the
// outgoing project's last photo — and close up as they travel; the
// outgoing ones fold away upward. Once the outgoing photos have passed
// under the header the page arrives (NEXT works again) while the column
// lands; the next project's feed is laid underneath and shown as the
// column goes. Resolves on the hand-over.
const SPRING_FEED_NEXT = spring(1.0, 0);

function dropFeedNext() {
  if (!feedNext) return;
  cancelAnimationFrame(feedNext.raf);
  feedNext.column.remove();
  feedEl.classList.remove("is-under");
  feedNext = null;
}

async function continueFeed(row, onArriving = () => {}) {
  const data = projectMedia()[row.dataset.project];
  if (!data || !data.media.length) return;
  dropFeedNext();
  const H = window.innerHeight;
  const rest = qs(".header").getBoundingClientRect().bottom; // where the first photo rests
  const width = feedEl.getBoundingClientRect().width;
  // The outgoing photos on screen, and where the last of them ends.
  const figs = [...feedEl.querySelectorAll(".feed__item")];
  let edge = H;
  let lastHeight = 0;
  const outgoing = [];
  figs.forEach((f) => {
    const r = f.getBoundingClientRect();
    if (r.top < H && r.bottom > rest - H) outgoing.push({ f, top: r.top });
    if (r.top < H && r.bottom >= edge - 0.5) {
      edge = r.bottom;
      lastHeight = r.height;
    }
  });
  // Past the junction the feed's own next photos would show through the
  // incoming gaps: they go.
  figs.forEach((f) => {
    if (f.getBoundingClientRect().top >= edge - 0.5) f.style.visibility = "hidden";
  });
  // The incoming column: as much of the next project as fills a screen.
  const column = document.createElement("div");
  column.className = "feed__incoming";
  Object.assign(column.style, { width: `${width}px`, transform: `translate3d(0, ${H * 2}px, 0)` });
  const tiles = [];
  for (let i = 0, filled = 0; i === 0 || filled < H; i++) {
    const item = data.media[i % data.media.length];
    const media = makeMedia(item);
    if (media.tagName === "VIDEO") {
      media.autoplay = false;
      media.preload = "auto";
    }
    const fig = document.createElement("figure");
    fig.className = `feed__item feed__item--${item.o === "l" ? "l" : "p"} is-in is-settled`;
    fig.appendChild(media);
    column.appendChild(fig);
    tiles.push({ fig, media });
    filled += width * (item.o === "l" ? 631 / 945 : 631 / 470) + layout.gutter;
  }
  projectPanel.appendChild(column);
  tiles.forEach((t) => (t.y = t.fig.offsetTop));
  const next = { column, tiles, raf: 0, onLanded: null, landed: false };
  feedNext = next;
  await stripReady(tiles);
  if (feedNext !== next) return;
  const start = edge + layout.gutter; // the incoming first photo, just below the last one
  const travel = start - rest;
  const from = lastHeight + layout.gutter;
  let handed = false;
  const render = (y) => {
    const out = clamp01(y / travel);
    // Once handed over the feed is the next project's own: hands off.
    if (!handed) {
      feedEl.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
      outgoing.forEach((o) => {
        const pull = UNFOLD * out * (edge + layout.gutter - o.top);
        o.f.style.transform = pull > 0.01 ? `translate3d(0, ${(-pull).toFixed(2)}px, 0)` : "";
      });
    }
    column.style.transform = `translate3d(0, ${(start - y).toFixed(2)}px, 0)`;
    tiles.forEach((t) => {
      const hold = UNFOLD * (1 - out) * (from + t.y);
      t.fig.style.transform = hold > 0.01 ? `translate3d(0, ${hold.toFixed(2)}px, 0)` : "";
    });
    // The junction (the last outgoing photo, folded away) under the header?
    return edge - y - UNFOLD * out * from <= rest;
  };
  render(0);
  if (reduceMotion.matches) {
    render(travel);
    onArriving();
    next.landed = true; // buildFeed shows the feed straight away
    return;
  }
  return new Promise((resolve) => {
    let y = 0;
    let v = 0;
    let last = 0;
    let t0 = 0;
    const step = (now) => {
      if (feedNext !== next) return resolve();
      if (!t0) t0 = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const ramp = Math.min(1, (now - t0) / 350);
      const k = SPRING_FEED_NEXT.k * ramp * ramp * (3 - 2 * ramp) + 0.02;
      for (let left = dt; left > 1e-6; left -= 1 / 240) {
        const h = Math.min(1 / 240, left);
        v += (k * (travel - y) - SPRING_FEED_NEXT.c * v) * h;
        y += v * h;
      }
      const landed = (Math.abs(travel - y) < 0.5 && Math.abs(v) < 20) || now - t0 > 3000;
      if (landed) y = travel;
      const gone = render(y);
      if (!handed && (gone || landed)) {
        handed = true;
        onArriving();
        resolve(); // the page arrives: the next project's feed is laid under the column
      }
      if (landed) {
        next.raf = 0;
        if (next.onLanded) next.onLanded();
        else next.landed = true;
        return;
      }
      next.raf = requestAnimationFrame(step);
    };
    next.raf = requestAnimationFrame(step);
  });
}

export { buildFeed, continueFeed, dropFeedNext };
export const cleanupFeed = () => feedCleanup();
