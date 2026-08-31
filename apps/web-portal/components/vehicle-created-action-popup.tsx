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
      className="fixed inset-0 z-[300] grid place-items-center bg-[#07152D]/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vehicle saved actions"
    >
      <div className="w-full max-w-[320px] rounded-xl border border-white/80 bg-white p-3.5 shadow-[0_20px_60px_rgba(7,21,45,.24)]">
        <div className="mb-3 text-center text-[11px] font-bold tracking-[0.04em] text-[#17203A]">VEHICLE CREATED</div>
        <div className="grid grid-cols-2 gap-2">
        <Link
          href="/vehicles?success=vehicle_created"
          className="grid h-9 place-items-center rounded-lg border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#17365D] transition hover:bg-[#F8FAFC]"
        >
          OK
        </Link>
        <Link
          href={`/policies/new?customer_id=${encodeURIComponent(customerId)}&vehicle_id=${encodeURIComponent(vehicleId)}`}
          className="grid h-9 place-items-center rounded-lg bg-[#17365D] px-4 text-[10.5px] font-semibold text-white transition hover:bg-[#102A49]"
        >
          ADD POLICY
        </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
