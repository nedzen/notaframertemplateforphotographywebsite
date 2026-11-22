// Responsive queries shared by components. A component may also accept
// explicit flags, so it stays usable outside this app.

import { layout } from "./config.js";

export const touchLayout = window.matchMedia(`(max-width: ${layout.touchMax}px)`);
export const phoneLayout = window.matchMedia(`(max-width: ${layout.phoneMax}px)`);
export const hoverInput = window.matchMedia("(hover: hover)");

// Where nothing can hover, one project shows at a time and the index moves
// on by itself: the phone, and a tablet. A narrow window with a mouse keeps
// the desktop's hover.
export const autoplayLayout = () =>
  phoneLayout.matches || (touchLayout.matches && !hoverInput.matches);

// A tablet held upright has room for one photo at a time.
export const uprightLayout = window.matchMedia(
  "(min-width: 601px) and (max-width: 1100px) and (orientation: portrait)"
);

// Upright, a project of one landscape shows whole, across the whole row.
export const wideSingle = (data) =>
  uprightLayout.matches && data.media.length === 1 && data.media[0].o === "l";
