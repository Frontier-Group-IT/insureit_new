import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingClaims() {
  return <ClaimManagerShell title="Claims" activeNav="claims"><PageSkeleton variant="list" /></ClaimManagerShell>;
}
