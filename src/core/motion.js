// Motion primitives shared by every component.

import { durations } from "./config.js";

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, reduceMotion.matches ? 0 : ms));

// Stiffness and damping for a spring that comes within ~2% of rest in
// `settle` seconds.
export function spring(settle, bounce) {
  const w = 5.8 / settle;
  return { k: w * w, c: 2 * Math.max(0.05, 1 - bounce) * w };
}

// A cubic-bezier as a function, for scroll or transforms that must run
// alongside a CSS flight.
export function cubicBezier(x1, y1, x2, y2) {
  const bez = (a, b) => (t) =>
    ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const bx = bez(x1, x2);
  const by = bez(y1, y2);
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = bx(t) - x;
      const slope =
        3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
      if (Math.abs(d) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= d / slope;
    }
    return by(Math.max(0, Math.min(1, t)));
  };
}

// Count from 0 to `n` over `duration` ms, starting after `delay`.
export function tickCount(el, n, delay = 0, duration = durations.countUp) {
  const start = performance.now() + delay;
  el.textContent = "0";
  function step(now) {
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - Math.pow(1 - t, 2.2);
    el.textContent = String(Math.round(eased * n));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
