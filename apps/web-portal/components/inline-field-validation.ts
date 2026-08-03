export type ValidatedControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FORMAT_MESSAGE = "Please match the requested format.";
const REQUIRED_MESSAGE = "This field is required.";

export function validateInlineControl(control: ValidatedControl, force = false) {
  if (control.disabled || control.type === "hidden") return true;

  const touched = control.dataset.validationTouched === "true";
  if (force) control.dataset.validationTouched = "true";
  if (!force && !touched && !control.value.trim()) {
    clearInlineError(control);
    return true;
  }

  control.setCustomValidity("");
  const required = control.required || control.dataset.required === "true";
  const missing = required && !control.value.trim();
  const valid = !missing && matchesConfiguredFormat(control);

  if (missing) {
    showInlineError(control, REQUIRED_MESSAGE);
    return false;
  }
  if (!valid) {
    showInlineError(control, FORMAT_MESSAGE);
    return false;
  }

  clearInlineError(control);
  return true;
}

export function validateInlineForm(form: HTMLFormElement) {
  const controls = formControls(form);
  let firstInvalid: ValidatedControl | null = null;

  for (const control of controls) {
    if (!validateInlineControl(control, true) && !firstInvalid) firstInvalid = control;
  }

  if (firstInvalid) {
    requestAnimationFrame(() => {
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return false;
  }
  return true;
}

export function handleInlineBlur(event: React.FocusEvent<HTMLFormElement>) {
  const control = asControl(event.target);
  if (!control) return;
  control.dataset.validationTouched = "true";
  validateInlineControl(control, true);
}

export function handleInlineInput(event: React.FormEvent<HTMLFormElement>) {
  const control = asControl(event.target);
  if (!control || control.dataset.validationTouched !== "true") return;
  validateInlineControl(control, true);
}

export function inlineFieldErrorId(name: string) {
  return `${name}-format-error`;
}

function matchesConfiguredFormat(control: ValidatedControl) {
  if (!control.value.trim()) return true;

  if (control instanceof HTMLInputElement) {
    if (control.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value)) return false;
    if (control.minLength > 0 && control.value.length < control.minLength) return false;
    if (control.maxLength > 0 && control.value.length > control.maxLength) return false;
    const source = control.pattern || control.dataset.pattern;
    if (source) {
      try {
        if (!new RegExp(`^(?:${source})$`).test(control.value)) return false;
      } catch {
        return false;
      }
    }
  }

  return true;
}

function showInlineError(control: ValidatedControl, message: string) {
  const container = control.closest<HTMLElement>("[data-field-container]");
  const error = container?.querySelector<HTMLElement>("[data-field-error]");
  container?.setAttribute("data-invalid", "true");
  control.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
    control.setAttribute("aria-describedby", error.id);
  }
}

function clearInlineError(control: ValidatedControl) {
  const container = control.closest<HTMLElement>("[data-field-container]");
  const error = container?.querySelector<HTMLElement>("[data-field-error]");
  container?.removeAttribute("data-invalid");
  control.removeAttribute("aria-invalid");
  if (error) {
    error.textContent = "";
    error.hidden = true;
    control.removeAttribute("aria-describedby");
  }
}

function formControls(form: HTMLFormElement) {
  return Array.from(form.elements).filter((item): item is ValidatedControl =>
    item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement,
  );
}

function asControl(target: EventTarget | null): ValidatedControl | null {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
    ? target
    : null;
}
