// Contact-sheet placement. Each row lists the columns its tiles start on —
// the six two-column slots (1, 3, 5, 7, 9, 11); the slots left out are the
// gaps that give the sheet its rhythm. A tile's shape comes from its own
// photo (data-orient): portrait or landscape. The pattern repeats for as
// many photos as there are.

export const SHEET_PATTERN = [
  [1, 3, 7, 11],
  [1, 3, 7, 9, 11],
  [1, 5, 7, 11],
  [3, 5, 9, 11],
  [1, 3, 7, 11],
  [1, 5, 9],
];

// Fisher–Yates, in place.
export function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function placePhotos(photos, { pattern = SHEET_PATTERN } = {}) {
  let row = 0;
  let slot = 0;
  photos.forEach((photo) => {
    const line = pattern[row % pattern.length];
    photo.style.setProperty("--c", line[slot]);
    photo.style.setProperty("--r", row + 1);
    photo.dataset.slot = slot; // position in its row, for the scroll-in stagger
    photo.tabIndex = 0;
    photo.setAttribute("role", "button");
    photo.setAttribute("aria-label", "Expand photo");
    photo.classList.toggle("photo--landscape", photo.dataset.orient === "l");
    slot += 1;
    if (slot >= line.length) {
      slot = 0;
      row += 1;
    }
  });
}
