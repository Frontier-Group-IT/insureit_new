"use client";

import { useEffect, useRef, useState } from "react";

export function VehicleSaveActionChooser() {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => primaryActionRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openSaveChoices() {
    const form = triggerButtonRef.current?.form;
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={openSaveChoices}
        className="rounded-lg bg-[#17365D] px-5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#102A49]"
      >
        Save Vehicle
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[250] grid place-items-center bg-[#07152D]/55 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vehicle-save-action-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-[300px] rounded-xl border border-white/80 bg-white p-3 shadow-[0_20px_60px_rgba(7,21,45,.24)]">
            <h2 id="vehicle-save-action-title" className="sr-only">Save vehicle</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                ref={primaryActionRef}
                type="submit"
                name="next_action"
                value="vehicle"
                className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#17365D] transition hover:bg-[#F8FAFC]"
              >
                OK
              </button>
              <button
                type="submit"
                name="next_action"
                value="policy"
                className="h-9 rounded-lg bg-[#17365D] px-4 text-[10.5px] font-semibold text-white transition hover:bg-[#102A49]"
              >
                ADD POLICY
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
