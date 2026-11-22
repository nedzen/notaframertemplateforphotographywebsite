// Shared project-page references, data shape, media builders and the
// services the project feature borrows from the app. Nothing here imports
// another feature: the composition root injects those.

import { byId, qs } from "../../core/dom.js";
import { phoneLayout } from "../../core/viewport.js";
import { Media, photoSize, sized } from "../../core/media.js";

export const projectPanel = byId("project");
export { Media };

export const strip = byId("project-strip");
export const stage = byId("project-stage");
export const projectPosition = byId("project-position");
export const carouselEl = byId("project-carousel");
export const carouselTrack = qs(".carousel__track", carouselEl);
export const feedEl = byId("project-feed");

let mediaData = {};
let env = {
  rows: [],
  sets: new Map(),
  state: { currentPage: "index", targetPage: "index", transitioning: false },
  setActive: () => {},
  closeSheets: () => {},
  isSheetOpen: () => false,
  isLightboxOpen: () => false,
  goTo: () => {},
  syncHash: () => {},
  pathFor: (hash) => hash,
};

export const setProjectMedia = (media) => {
  mediaData = media || {};
};

export const projectMedia = () => mediaData;

export const configureProject = (services) => {
  env = { ...env, ...services };
};

export const projectEnv = () => env;

// `currentProject` is the index row; the page, feed and carousel all read it.
export const pstate = { currentProject: null };
export const getCurrentProject = () => pstate.currentProject;

export const CAROUSEL =
  new URLSearchParams(location.search).get("project") !== "stage";
export const carouselOn = () => CAROUSEL && !phoneLayout.matches;
export const feedOn = () => phoneLayout.matches;

export const mediaSrc = (item) =>
  item.img ? sized(item.img, 1024) : item.poster;

export const tileSrc = (item) =>
  item.img ? sized(item.img, photoSize()) : item.poster;

export function makeMedia(item) {
  if (item.img) {
    const img = document.createElement("img");
    img.src = tileSrc(item);
    img.decoding = "async";
    img.alt = item.alt || "";
    return img;
  }
  const video = document.createElement("video");
  video.src = item.video;
  if (item.alt) video.setAttribute("aria-label", item.alt);
  video.poster = item.poster;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  return video;
}

export function stripReady(tiles, cap = 700) {
  return Promise.all(tiles.map(({ media }) => {
    if (media.tagName !== "VIDEO") return Media.ready(media, cap);
    const poster = new Image();
    poster.src = media.poster;
    return Media.ready(poster, cap);
  }));
}

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const UNFOLD = 0.25;        // stretch at the start of a transition
export const UNFOLD_RELEASE = 0.3; // s for the stretch to ease out

export const CONTINUE_TURN = 0.85; // NEXT turns the header at 85% of the travel
