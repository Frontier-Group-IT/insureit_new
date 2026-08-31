"use client";

import { useEffect, useState, type ReactNode } from "react";

export type VehicleRegistrationMode = "registered" | "unregistered";

export function VehicleRegistrationFields({
  initialMode,
  initialVehicleNo,
  initialRegistrationDate,
  children,
}: {
  initialMode: VehicleRegistrationMode;
  initialVehicleNo?: string | null;
  initialRegistrationDate?: string | null;
  children?: ReactNode;
}) {
  const [mode, setMode] = useState<VehicleRegistrationMode>(initialMode);
  const [vehicleNo, setVehicleNo] = useState(initialMode === "registered" ? initialVehicleNo ?? "" : "");
  const [registrationDate, setRegistrationDate] = useState(initialRegistrationDate ?? "");

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("insureit:vehicle-registration-mode", { detail: { mode } }));
  }, [mode]);

  return (
    <>
      <div className="absolute right-4 top-2.5 z-10 flex items-center gap-2 max-sm:left-3 max-sm:right-3 max-sm:top-[56px] max-sm:justify-end">
        <input type="hidden" name="registration_mode" value={mode} />
        <div
          className="inline-flex h-8 items-center rounded-full border border-[#D5E0EF] bg-white p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_14px_rgba(15,23,42,.06)]"
          role="radiogroup"
          aria-label="Vehicle registration status"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "registered"}
            onClick={() => setMode("registered")}
            className={`relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[8.5px] font-bold transition ${mode === "registered" ? "bg-[#17365D] text-white shadow-[0_5px_12px_rgba(23,54,93,.22)]" : "text-[#667085] hover:bg-[#F5F8FC]"}`}
          >
            <RegistrationBadgeIcon active={mode === "registered"} />
            <span>Registered</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "unregistered"}
            onClick={() => setMode("unregistered")}
            className={`relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[8.5px] font-bold transition ${mode === "unregistered" ? "bg-[linear-gradient(135deg,#315B9A,#19A7A0)] text-white shadow-[0_5px_12px_rgba(25,167,160,.22)]" : "text-[#667085] hover:bg-[#F5F8FC]"}`}
          >
            <PendingBadgeIcon active={mode === "unregistered"} />
            <span>Unregistered</span>
          </button>
        </div>
      </div>

      {mode === "registered" ? (
        <>
          <div className="min-w-0">
            <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor="vehicle_no">
              RC / Registration number *
            </label>
            <input
              id="vehicle_no"
              name="vehicle_no"
              value={vehicleNo}
              onChange={(event) => setVehicleNo(event.target.value)}
              placeholder="MP20CM6416"
              required
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] uppercase text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor="registration_date">
              Registration date
            </label>
            <input
              id="registration_date"
              name="registration_date"
              type="date"
              value={registrationDate}
              onChange={(event) => setRegistrationDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
            />
          </div>

          {children}
        </>
      ) : (
        children
      )}

      {initialMode === "registered" && Boolean(initialVehicleNo) && mode === "unregistered" ? (
        <div className="md:col-span-2 lg:col-span-3 xl:col-span-6 rounded-xl border border-[#F5D7A8] bg-[#FFF9EF] px-3 py-2 text-[9.5px] leading-4 text-[#8A5A16]">
          Saving as Unregistered will replace the current registration number with a temporary chassis-based reference. Linked policies will remain attached to the same vehicle record.
        </div>
      ) : null}
    </>
  );
}


function RegistrationBadgeIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="13" height="10" rx="2.2" />
      <path d="M6.5 8h7" />
      <path d="M6.5 11h3.5" />
      <path d="m12 12 1.1 1.1 2.2-2.7" />
    </svg>
  );
}

function PendingBadgeIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6.5 10 3l5 3.5v7L10 17l-5-3.5z" />
      <path d="M10 7.2v3.3" />
      <path d="M10 13.5h.01" />
    </svg>
  );
}
