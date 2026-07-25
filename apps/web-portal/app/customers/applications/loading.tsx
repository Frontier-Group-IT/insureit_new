import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingKycApplications() {
  return <AppShell title="KYC Applications"><PageSkeleton variant="list" /></AppShell>;
}
