"use client";

import { useState } from "react";

export type VehicleRegistrationMode = "registered" | "unregistered";

export function VehicleRegistrationFields({
  initialMode,
  initialVehicleNo,
  initialRegistrationDate,
}: {
  initialMode: VehicleRegistrationMode;
  initialVehicleNo?: string | null;
  initialRegistrationDate?: string | null;
}) {
  const [mode, setMode] = useState<VehicleRegistrationMode>(initialMode);
  const [vehicleNo, setVehicleNo] = useState(initialMode === "registered" ? initialVehicleNo ?? "" : "");
  const [registrationDate, setRegistrationDate] = useState(initialRegistrationDate ?? "");

  return (
    <>
      <div className="min-w-0">
        <span className="mb-1 block text-[10.5px] font-semibold text-[#344054]">Registration status *</span>
        <input type="hidden" name="registration_mode" value={mode} />
        <div className="grid h-10 grid-cols-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-1">
          <button
            type="button"
            onClick={() => setMode("registered")}
            className={`rounded-lg text-[10.5px] font-semibold transition ${mode === "registered" ? "bg-white text-[#17365D] shadow-sm" : "text-[#667085]"}`}
            aria-pressed={mode === "registered"}
          >
            Registered
          </button>
          <button
            type="button"
            onClick={() => setMode("unregistered")}
            className={`rounded-lg text-[10.5px] font-semibold transition ${mode === "unregistered" ? "bg-white text-[#17365D] shadow-sm" : "text-[#667085]"}`}
            aria-pressed={mode === "unregistered"}
          >
            Unregistered
          </button>
        </div>
      </div>

      {mode === "registered" ? (
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
      ) : (
        <div className="min-w-0">
          <span className="mb-1 block text-[10.5px] font-semibold text-[#344054]">Vehicle reference</span>
          <div className="flex h-10 items-center rounded-xl border border-[#D8E2EE] bg-[#F7FAFD] px-3 text-[10.5px] font-semibold text-[#667085]">
            Generated automatically from chassis number
          </div>
        </div>
      )}

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
          disabled={mode === "unregistered"}
          className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition disabled:bg-[#F7F9FC] disabled:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
        />
      </div>

      {initialMode === "registered" && mode === "unregistered" ? (
        <div className="md:col-span-2 lg:col-span-3 xl:col-span-6 rounded-xl border border-[#F5D7A8] bg-[#FFF9EF] px-3 py-2 text-[9.5px] leading-4 text-[#8A5A16]">
          Saving as Unregistered will replace the current registration number with a temporary chassis-based reference. Linked policies will remain attached to the same vehicle record.
        </div>
      ) : null}
    </>
  );
}
