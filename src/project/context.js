/* Shared project-page references, data shape and media builders. */

import { PROJECT_MEDIA, phoneLayout, projectPanel } from "../layout.js";
import { Media, photoSize, sized } from "../media.js";

export { PROJECT_MEDIA, projectPanel };

export const strip = document.getElementById("project-strip");
export const stage = document.getElementById("project-stage");
export const projectPosition = document.getElementById("project-position");
export const carouselEl = document.getElementById("project-carousel");
export const carouselTrack = carouselEl.querySelector(".carousel__track");
export const feedEl = document.getElementById("project-feed");

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

export { Media };

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
