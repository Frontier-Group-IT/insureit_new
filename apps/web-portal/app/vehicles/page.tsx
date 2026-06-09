import Link from "next/link";
import { sampleVehicles } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

export default function VehiclesPage() {
  return (
    <AppShell>
      <PageHeader title="Vehicles" description="Maintain commercial vehicle registration, permit, chassis, engine, fitness, and policy linkage records." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/vehicles/new">Add vehicle</Link>} />
      <SearchFilterBar searchPlaceholder="Search vehicles by registration, customer, policy, or vehicle type" filterLabel="Vehicle status" />
      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sampleVehicles.map((vehicle, index) => <Link className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-navy-200 hover:shadow-soft" href={`/vehicles/${index + 1}/edit`} key={vehicle.vehicleNo}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold text-navy-900">{vehicle.vehicleNo}</p><p className="mt-1 text-sm text-slate-500">{vehicle.customer}</p></div><StatusBadge status={vehicle.status} /></div><div className="mt-5 space-y-2 text-sm"><p className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium text-slate-700">{vehicle.type}</span></p><p className="flex justify-between"><span className="text-slate-500">Policy</span><span className="font-medium text-slate-700">{vehicle.policy}</span></p><p className="flex justify-between"><span className="text-slate-500">Fitness</span><StatusBadge status={vehicle.fitness} /></p></div></Link>)}
        </div>
        <div className="mt-4"><EmptyState className="hidden" title="No vehicles found" description="Vehicle search results will appear here after changing filters or onboarding vehicles." /></div>
      </Card>
    </AppShell>
  );
}
