import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingDashboard() {
  return <ClaimManagerShell title="Operations Dashboard" activeNav="dashboard"><PageSkeleton variant="dashboard" /></ClaimManagerShell>;
}
