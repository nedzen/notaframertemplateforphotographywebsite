// Grid-only control: MONO drains the sheet to greyscale and back. The
// label never changes; its colour shows the state (aria-pressed in CSS).

export function createMono(button, root) {
  if (!button) return { destroy: () => {} };
  const onClick = () => {
    const on = root.classList.toggle("is-mono");
    button.setAttribute("aria-pressed", String(on));
  };
  button.addEventListener("click", onClick);
  return {
    setEnabled(enabled) {
      button.tabIndex = enabled ? 0 : -1;
    },
    destroy: () => button.removeEventListener("click", onClick),
  };
}
