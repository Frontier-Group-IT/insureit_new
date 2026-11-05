"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { StatusPill } from "@/components/customer-portal/customer-phase1";

type Props = {
  href: string;
  policyNo: string;
  insurerName: string;
  insurerLogo: string | null;
  validUntil: string;
  source: string;
  status: "active" | "due" | "expired" | "neutral";
};

export function VehicleInsuranceHistoryRow({
  href, policyNo, insurerName, insurerLogo, validUntil, source, status,
}: Props) {
  const router = useRouter();
  const openPolicy = () => router.push(href);

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`View insurance policy ${policyNo}`}
      onClick={openPolicy}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPolicy();
        }
      }}
      className="group cursor-pointer transition-colors hover:bg-[#EBF4FF] focus-visible:bg-[#EBF4FF] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1764C0]"
    >
      <td className="px-3 py-3 font-semibold text-[#17365F] group-hover:underline">{policyNo}</td>
      <td className="px-3 py-2.5">
        <span title={insurerName} className="inline-flex h-9 min-w-12 max-w-28 items-center justify-center rounded-md border border-[#DFE8F4] bg-white px-1.5">
          {insurerLogo
            ? <Image src={insurerLogo} alt={insurerName} width={100} height={32} unoptimized className="max-h-7 w-auto max-w-full object-contain" />
            : <ShieldCheck aria-label={insurerName} className="h-5 w-5 text-[#315987]" />}
        </span>
      </td>
      <td className="px-3 py-3">{validUntil}</td>
      <td className="px-3 py-3 text-[10px] font-semibold uppercase">{source}</td>
      <td className="px-3 py-3"><StatusPill tone={status}>{status}</StatusPill></td>
    </tr>
  );
}
