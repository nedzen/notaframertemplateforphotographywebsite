// Contact form: browser validation, then the success line. There is no
// backend; consumers wire a real endpoint through contact:submit.

export function initContactForm(form) {
  if (!form) return { destroy() {} };

  function submit(formEl, fields) {
    const send = formEl.querySelector(".contact__send");
    const note = formEl.querySelector(".contact__note");
    const detail = Object.fromEntries(fields.map((field) => [field.name, field.value]));
    formEl.classList.add("is-sent");
    if (send) {
      send.hidden = true;
      send.disabled = true;
    }
    if (note) note.hidden = false;
    formEl.dispatchEvent(new CustomEvent("contact:submit", { bubbles: true, detail }));
  }

  const onSubmit = (event) => {
    event.preventDefault();
    const fields = Array.from(form.querySelectorAll(".field__input"));
    fields.forEach((field) =>
      field.closest(".field").classList.toggle("is-invalid", !field.checkValidity())
    );
    const first = fields.find((field) => !field.checkValidity());
    if (first) {
      first.focus();
      return;
    }
    submit(form, fields);
  };

  const onInput = (event) => {
    event.target.closest(".field").classList.remove("is-invalid");
  };

  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", onInput);

  return {
    destroy() {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("input", onInput);
    },
  };
}
