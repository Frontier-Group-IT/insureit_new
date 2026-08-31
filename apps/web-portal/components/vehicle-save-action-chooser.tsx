"use client";

import { useCallback, useRef, useState } from "react";
import { AlertModal } from "@/components/ui-feedback";

export function VehicleSaveActionChooser() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [validationError, setValidationError] = useState<{ message: string; field?: HTMLElement } | null>(null);

  const closeValidation = useCallback(() => {
    const field = validationError?.field;
    setValidationError(null);
    if (!field) return;
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [validationError?.field]);

  function saveVehicle() {
    const form = triggerRef.current?.form;
    if (!form) return;

    if (!form.checkValidity()) {
      const invalid = form.querySelector<HTMLElement>(":invalid");
      const label = invalid?.id
        ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(invalid.id)}"]`)?.textContent
        : null;
      const fieldName = (label ?? invalid?.getAttribute("aria-label") ?? "Required field")
        .replace(/\*/g, "")
        .trim()
        .replace(/\s+/g, " ");
      setValidationError({
        message: `${fieldName} is required before the vehicle can be created.`,
        field: invalid ?? undefined,
      });
      return;
    }

    form.requestSubmit();
  }

  return (
    <>
      <input type="hidden" name="next_action" value="post_save" />
      <button
        ref={triggerRef}
        type="button"
        onClick={saveVehicle}
        className="rounded-lg bg-[#17365D] px-5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#102A49]"
      >
        Save Vehicle
      </button>
      <AlertModal
        open={Boolean(validationError)}
        message={validationError?.message ?? ""}
        onClose={closeValidation}
        autoCloseMs={5000}
      />
    </>
  );
}
