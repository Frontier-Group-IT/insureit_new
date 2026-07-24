import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingApplicationFile() {
  return <AppShell title="Review KYC Application"><PageSkeleton variant="file" /></AppShell>;
}
