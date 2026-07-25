import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingPolicies() {
  return <AppShell title="Policies"><PageSkeleton variant="list" /></AppShell>;
}
