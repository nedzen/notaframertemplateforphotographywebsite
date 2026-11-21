/* Contact form: browser validation, then the success line. There is no
   backend; consumers wire a real endpoint through contact:submit. */

const contactForm = document.getElementById("contact-form");

function submitContact(form, fields) {
  const send = form.querySelector(".contact__send");
  const note = form.querySelector(".contact__note");
  const detail = Object.fromEntries(
    fields.map((field) => [field.name, field.value])
  );
  form.classList.add("is-sent");
  if (send) {
    send.hidden = true;
    send.disabled = true;
  }
  if (note) note.hidden = false;
  form.dispatchEvent(
    new CustomEvent("contact:submit", { bubbles: true, detail })
  );
}

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = Array.from(contactForm.querySelectorAll(".field__input"));
  fields.forEach((field) =>
    field.closest(".field").classList.toggle("is-invalid", !field.checkValidity())
  );
  const first = fields.find((field) => !field.checkValidity());
  if (first) {
    first.focus();
    return;
  }
  submitContact(contactForm, fields);
});

contactForm.addEventListener("input", (event) => {
  event.target.closest(".field").classList.remove("is-invalid");
});
