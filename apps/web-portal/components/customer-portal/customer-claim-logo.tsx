"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { getVehicleBrandLogo } from "@/lib/vehicle-brand-logo";

/** Resolve customer claim header marks from Master Data first, not hardcoded name lists. */
export function CustomerClaimLogo({ value, kind = "vehicle", size = 48 }: {
  value: string | null | undefined;
  kind?: "vehicle" | "insurer";
  size?: number;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = kind === "insurer" ? getInsurerLogo(value) : getVehicleBrandLogo(value);
  const showLogo = Boolean(src && failedSource !== src);

  return <span className="inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white" style={{ width: size, height: size }}>
    {showLogo
      ? <img key={src} src={src!} alt={value || (kind === "insurer" ? "Insurer" : "Manufacturer")} loading="lazy" onError={() => setFailedSource(src!)} className="max-h-[85%] max-w-[85%] object-contain" />
      : kind === "insurer"
        ? <Shield aria-label="Insurer not assigned or logo unavailable" className="h-5 w-5 text-[#174EA6]" />
        : <span className="text-lg font-black text-[#174EA6]">{(value || "V").slice(0, 1).toUpperCase()}</span>}
  </span>;
}
