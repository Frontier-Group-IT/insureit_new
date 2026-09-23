"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export function VehicleCreatedActionPopup({
  customerId,
  vehicleId,
}: {
  customerId: string;
  vehicleId: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-[#07152D]/45 px-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-created-title"
      aria-describedby="vehicle-created-description"
    >
      <div className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_24px_70px_rgba(7,21,45,.28)]">
        <div className="px-5 pb-4 pt-5 text-center">
          <div className="mx-auto mb-2.5 grid h-12 w-12 place-items-center rounded-full bg-[#F4F8FD]">
            <VehicleCreatedIcon />
          </div>
          <h2
            id="vehicle-created-title"
            className="text-[14px] font-bold tracking-[0.03em] text-[#17203A]"
          >
            VEHICLE ADDED
          </h2>
          <p
            id="vehicle-created-description"
            className="mt-1 text-[11px] font-medium leading-4 text-[#667085]"
          >
            The vehicle has been successfully added.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#E8EEF6] bg-[#FBFCFE] px-4 py-3">
          <Link
            href="/vehicles?success=vehicle_created"
            className="grid h-10 place-items-center rounded-lg border border-[#BFD0E4] bg-white px-4 text-[10.5px] font-semibold text-[#17365D] transition hover:bg-[#F7FAFD]"
          >
            OK
          </Link>
          <Link
            href={`/policies/new?customer_id=${encodeURIComponent(customerId)}&vehicle_id=${encodeURIComponent(vehicleId)}`}
            className="grid h-10 place-items-center rounded-lg bg-[#17365D] px-4 text-[10.5px] font-semibold text-white shadow-[0_4px_10px_rgba(23,54,93,.18)] transition hover:bg-[#102A49]"
          >
            ADD POLICY
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VehicleCreatedIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="h-9 w-9"
      fill="none"
    >
      <path
        d="M32 7 49 13v13c0 12-6.8 21.8-17 27-10.2-5.2-17-15-17-27V13L32 7Z"
        stroke="#2F67B2"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M23.5 30.5h17l-2.2-6.1c-.5-1.4-1.8-2.4-3.3-2.4h-6c-1.5 0-2.8 1-3.3 2.4l-2.2 6.1Z"
        stroke="#17365D"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 31.5h21v8.5h-21v-8.5Z"
        fill="#2F67B2"
        stroke="#17365D"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="35.8" r="1.8" fill="white" />
      <circle cx="38" cy="35.8" r="1.8" fill="white" />
      <path d="M24 40v3M40 40v3" stroke="#17365D" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="46" cy="46" r="9" fill="#17365D" />
      <path
        d="m42.3 46 2.4 2.4 4.8-5.2"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
