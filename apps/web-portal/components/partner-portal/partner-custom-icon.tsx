import Image from "next/image";

export type PartnerCustomIconName =
  | "home"
  | "business"
  | "customers"
  | "vehicle"
  | "policies"
  | "renewals"
  | "claims"
  | "policy-intake"
  | "payout"
  | "network"
  | "search"
  | "activity"
  | "account"
  | "support";

const iconAssets: Record<PartnerCustomIconName, string> = {
  home: "/assets/Custom-Icons/optimized-128/tasks-work-queue.png",
  business: "/assets/Custom-Icons/optimized-128/reports-analytics.png",
  customers: "/assets/Custom-Icons/optimized-128/customers.png",
  vehicle: "/assets/Custom-Icons/optimized-128/fleet-vehicle.png",
  policies: "/assets/Custom-Icons/optimized-128/policy.png",
  renewals: "/assets/Custom-Icons/optimized-128/renewal.png",
  claims: "/assets/Custom-Icons/optimized-128/claims.png",
  "policy-intake": "/assets/Custom-Icons/optimized-128/policy-intake.png",
  payout: "/assets/Custom-Icons/optimized-128/accounts-finance.png",
  network: "/assets/Custom-Icons/optimized-128/distribution-network.png",
  search: "/assets/Custom-Icons/optimized-128/ocr-manual-review.png",
  activity: "/assets/Custom-Icons/optimized-128/tasks-completed.png",
  account: "/assets/Custom-Icons/optimized-128/partner-intermediary.png",
  support: "/assets/Custom-Icons/optimized-128/documents.png",
};

export function PartnerCustomIcon({
  name,
  size = 20,
  className = "",
  priority = false,
}: {
  name: PartnerCustomIconName;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={iconAssets[name]}
      alt=""
      width={size}
      height={size}
      priority={priority}
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
