"use client";

import { usePathname } from "next/navigation";

const ROOT = "/assets/Custom-Icons/optimized-128/";
const ICONS = [
  { prefix: "/customer/add-vehicle", label: "Add Vehicle", icon: "fleet-vehicle.png" },
  { prefix: "/customer/add-policy", label: "Add Policy", icon: "policy.png" },
  { prefix: "/customer/start-claim", label: "Start Claim", icon: "claim-intimation.png" },
  { prefix: "/customer/spot-intimation", label: "Spot Intimation", icon: "claim-survey.png" },
  { prefix: "/customer/e-challan", label: "E-Challan", icon: "receipts-posted.png" },
  { prefix: "/customer/insurance-quote", label: "Insurance Quote", icon: "policy-intake.png" },
  { prefix: "/customer/exchange", label: "Vehicle Exchange", icon: "fleet-vehicle.png" },
  { prefix: "/customer/renewals", label: "Renewals", icon: "renewal.png" },
  { prefix: "/customer/vehicles", label: "My Vehicles", icon: "fleet-vehicle.png" },
  { prefix: "/customer/policies", label: "My Policies", icon: "policy.png" },
  { prefix: "/customer/claims", label: "Claims", icon: "claims.png" },
  { prefix: "/customer/support", label: "Support", icon: "tasks-work-queue.png" },
  { prefix: "/customer/documents", label: "Documents", icon: "documents.png" },
  { prefix: "/customer/profile", label: "My Profile", icon: "customers.png" },
  { prefix: "/customer/settings", label: "Settings", icon: "kyc.png" },
  { prefix: "/customer/kyc", label: "KYC", icon: "kyc-completed.png" },
  { prefix: "/customer/home", label: "Home", icon: "policy-booked.png" },
] as const;

/** Decorative illustrated route identity; existing navigation and actions remain unchanged. */
export function CustomerPage3DIcon() {
  const pathname = usePathname();
  const page = ICONS.find(({ prefix }) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!page) return null;
  return (
    <div className="mb-2 flex items-center gap-2" aria-label={page.label}>
      <img
        src={ROOT + page.icon}
        alt=""
        aria-hidden="true"
        width={38}
        height={38}
        decoding="async"
        className="h-[38px] w-[38px] shrink-0 object-contain"
      />
      <span className="text-[12px] font-semibold text-[#17365D]">{page.label}</span>
    </div>
  );
}
