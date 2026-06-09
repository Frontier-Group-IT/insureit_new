import { VehicleForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function EditVehiclePage() {
  return <AppShell><PageHeader title="Edit vehicle" description="Update vehicle registration, permit, and identification details." /><VehicleForm /></AppShell>;
}
