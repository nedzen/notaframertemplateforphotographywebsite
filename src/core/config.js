// JS mirrors of the SCSS tokens in scss/config/_tokens.scss. Change both
// when tuning motion or layout; CSS owns the visual values, this file only
// holds what scripts must know before a frame runs.

export const layout = {
  margin: 10,
  gutter: 4,
  columns: 12,
  touchMax: 1100,
  phoneMax: 600,
  lightboxMaxColumns: 8,
};

export const ratios = {
  portrait: 470 / 631,
  landscape: 945 / 631,
};

export const durations = {
  fade: 450,
  expand: 600,
  step: 700,
  exit: 300,
  hold: 120,
  sink: 500,
  sinkStagger: 40,
  preloadStep: 380,
  preloadStart: 200,
  preloadSettle: 700,
  preloadHold: 180,
  preloadExpand: 1200,
  countUp: 900,
};

export const easings = {
  smooth: "cubic-bezier(0.65, 0, 0.35, 1)",
};
