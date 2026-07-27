"use client";

import { useEffect } from "react";

export function ProfessionalFormValidation() {
  useEffect(() => {
    function handleInvalid(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.required || target.value) return;
      const fieldLabel = resolveFieldLabel(target);
      target.setCustomValidity(fieldLabel ? `Please select a valid ${fieldLabel} from the list.` : "Please select a valid option from the list.");
    }

    function clearMessage(event: Event) {
      const target = event.target;
      if (target instanceof HTMLSelectElement) target.setCustomValidity("");
    }

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("change", clearMessage, true);
    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("change", clearMessage, true);
    };
  }, []);

  return null;
}

function resolveFieldLabel(select: HTMLSelectElement) {
  const explicitLabel = select.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(select.id)}"]`) : null;
  const wrappingLabel = select.closest("label");
  const raw = explicitLabel?.textContent ?? wrappingLabel?.textContent ?? select.getAttribute("aria-label") ?? "";
  return raw.replace(/\*/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}
