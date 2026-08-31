"use client";

import { useEffect, useRef, useState } from "react";

export function VehicleSaveActionChooser() {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

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
          <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(7,21,45,.28)]">
            <div className="border-b border-[#E2E8F0] px-5 py-4">
              <h2 id="vehicle-save-action-title" className="text-[15px] font-semibold text-[#0F172A]">Save vehicle</h2>
              <p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">
                Choose whether to save this vehicle only or continue directly to policy creation after saving.
              </p>
            </div>
            <div className="flex flex-col gap-2 bg-[#F8FAFC] px-5 py-4 sm:flex-row sm:justify-end">
              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">
                Cancel
              </button>
              <button type="submit" name="next_action" value="vehicle" className="h-10 rounded-lg border border-[#9FB4CF] bg-white px-4 text-[10.5px] font-semibold text-[#17365D] transition hover:bg-[#F4F8FC]">
                Save Vehicle
              </button>
              <button type="submit" name="next_action" value="policy" className="h-10 rounded-lg bg-[#17365D] px-4 text-[10.5px] font-semibold text-white transition hover:bg-[#102A49]">
                Save Vehicle &amp; Continue to Policy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
