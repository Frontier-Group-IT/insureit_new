import { VehicleForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function NewVehiclePage() {
  return <AppShell><PageHeader title="Add vehicle" description="Register a commercial vehicle and attach it to a customer account." /><VehicleForm /></AppShell>;
}
