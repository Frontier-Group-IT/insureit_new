import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingVehicles() {
  return <AppShell title="Vehicles"><PageSkeleton variant="list" /></AppShell>;
}
