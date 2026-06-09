import Link from "next/link";
import { AppShell, Card, PageHeader } from "@/components/shell";

const vehicles = ["MH12AB1234", "KA05TR8821", "DL01GC4567", "GJ18XX9012"];

export default function VehiclesPage() {
  return <AppShell><PageHeader title="Vehicles" description="Maintain commercial vehicle registration, permit, chassis, and engine records." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white" href="/vehicles/new">Add vehicle</Link>} /><Card><div className="grid gap-3 md:grid-cols-2">{vehicles.map((vehicle, index) => <Link className="rounded-xl border border-slate-100 p-4 hover:border-navy-100" href={`/vehicles/${index + 1}/edit`} key={vehicle}><p className="font-semibold text-navy-900">{vehicle}</p><p className="text-sm text-slate-500">Goods carrier · Active policy linked</p></Link>)}</div></Card></AppShell>;
}
