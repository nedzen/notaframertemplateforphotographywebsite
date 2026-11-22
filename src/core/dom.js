// DOM lookups and geometry helpers. No app state, no side effects.

export const qs = (selector, root = document) => root.querySelector(selector);

export const qsa = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export const byId = (id) => document.getElementById(id);

export const px = (n) => `${n}px`;

// A DOMRect as the CSS frame an element can animate to.
export const rectFrame = (r) => ({
  left: px(r.left),
  top: px(r.top),
  width: px(r.width),
  height: px(r.height),
});

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
