"use client";

import Link from "next/link";
import { CarFront, FileText, Plus, ShieldAlert, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

type VehicleRow = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  permit_no: string | null;
  registration_status: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
  policies: { count: number }[];
  claims: { count: number }[];
};

type ViewKey = "all" | "registered" | "pending" | "uninsured" | "claims";
const PAGE_SIZE = 10;

export function VehicleWorkspace({ rows }: { rows: VehicleRow[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  const stats = useMemo(() => {
    const pending = rows.filter(isRegistrationPending).length;
    const uninsured = rows.filter((row) => policyCount(row) === 0).length;
    const claims = rows.reduce((total, row) => total + claimCount(row), 0);
    return { pending, uninsured, claims, registered: rows.length - pending };
  }, [rows]);

  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.vehicle_type).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = [row.vehicle_no, row.vehicle_type, row.make, row.model, row.permit_no, row.registration_status, row.customers?.company_name, row.customers?.contact_name].filter(Boolean).join(" ").toLowerCase();
    const matchesType = type === "all" || row.vehicle_type === type;
    const matchesView =
      view === "all" ||
      (view === "registered" && !isRegistrationPending(row)) ||
      (view === "pending" && isRegistrationPending(row)) ||
      (view === "uninsured" && policyCount(row) === 0) ||
      (view === "claims" && claimCount(row) > 0);
    return matchesType && matchesView && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [query, rows, type, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  return (
    <BrokerRegisterShell
      eyebrow="Fleet register"
      title="Vehicle Portfolio"
      description="Track registration status, customer linkage, coverage gaps and claim exposure across the fleet."
      icon={<CarFront className="h-5 w-5" />}
      metrics={[
        { label: "Vehicles", value: rows.length, hint: "Accessible fleet", tone: "navy" },
        { label: "Registered", value: stats.registered, hint: "RC available", tone: "green" },
        { label: "RC pending", value: stats.pending, hint: "New vehicles", tone: stats.pending ? "amber" : "slate" },
        { label: "Uninsured", value: stats.uninsured, hint: "No policy linked", tone: stats.uninsured ? "red" : "slate" }
      ]}
    >
      <BrokerRegisterToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        searchPlaceholder="Search registration, customer, permit, make or model"
        activeViewLabel={`${filtered.length} in current view`}
        action={<Link href="/vehicles/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Vehicle</Link>}
      >
        <RegisterViewTabs
          value={view}
          onChange={changeView}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "registered", label: "Registered", count: stats.registered },
            { value: "pending", label: "RC pending", count: stats.pending },
            { value: "uninsured", label: "Uninsured", count: stats.uninsured },
            { value: "claims", label: "Claims", count: rows.filter((row) => claimCount(row) > 0).length }
          ]}
        />
        <RegisterSelect value={type} onChange={(value) => { setType(value); setPage(1); }} label="Vehicle type">
          <option value="all">All vehicle types</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </RegisterSelect>
      </BrokerRegisterToolbar>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((vehicle) => <VehicleMobileCard key={vehicle.id} vehicle={vehicle} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching vehicles" description="Adjust the search, vehicle type or saved view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[180px] px-3 py-2">Vehicle</th>
              <th className="w-[210px] px-2.5 py-2">Customer</th>
              <th className="w-[190px] px-2.5 py-2">Make / model</th>
              <th className="w-[140px] px-2.5 py-2">Registration</th>
              <th className="w-[140px] px-2.5 py-2">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((vehicle) => (
              <tr key={vehicle.id} className="h-12 transition hover:bg-[#FAFCFF]">
                <td className="px-3">
                  <Link href={`/vehicles/${vehicle.id}/edit`} className="block truncate font-mono text-[12px] font-bold text-[#0F172A] hover:text-[#17365D]">{displayVehicleNo(vehicle)}</Link>
                  <p className="truncate text-[9px] leading-4 text-[#64748B]">{vehicle.vehicle_type || "Type not set"}</p>
                </td>
                <td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{vehicle.customers?.contact_name ?? "-"}</p></td>
                <td className="px-2.5"><p className="truncate font-semibold">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "-"}</p></td>
                <td className="px-2.5"><RegistrationPill vehicle={vehicle} /></td>
                <td className="px-2.5"><NextAction vehicle={vehicle} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching vehicles" description="Adjust the search, vehicle type or saved view." /> : null}
      </div>

      <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
    </BrokerRegisterShell>
  );
}

function VehicleMobileCard({ vehicle }: { vehicle: VehicleRow }) {
  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/vehicles/${vehicle.id}/edit`} className="block truncate font-mono text-[15px] font-extrabold text-[#12203B]">{displayVehicleNo(vehicle)}</Link>
          <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type}</p>
        </div>
        <RegistrationPill vehicle={vehicle} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
        <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{vehicle.customers?.contact_name ?? "Customer not linked"}</span>
        <div className="grid grid-cols-3 gap-2">
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{policyCount(vehicle)} policies</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{claimCount(vehicle)} claims</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold truncate">{vehicle.permit_no ?? "No permit"}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/vehicles/${vehicle.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111A35] px-3 text-[12px] font-bold text-white">Open vehicle</Link>
        <Link href="/policies/new" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#BFD3F7] bg-[#F0F6FF] px-3 text-[12px] font-bold text-[#174EA6]">Add policy</Link>
      </div>
    </article>
  );
}

function RegistrationPill({ vehicle }: { vehicle: VehicleRow }) {
  if (isRegistrationPending(vehicle)) return <RegisterStatusPill tone="amber">RC pending</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Registered</RegisterStatusPill>;
}

function NextAction({ vehicle }: { vehicle: VehicleRow }) {
  if (isRegistrationPending(vehicle)) return <span className="inline-flex items-center gap-1 font-bold text-amber-700"><ShieldAlert className="h-3.5 w-3.5" />Update RC</span>;
  if (policyCount(vehicle) === 0) return <Link href="/policies/new" className="inline-flex items-center gap-1 font-bold text-[#174EA6] hover:underline"><FileText className="h-3.5 w-3.5" />Add policy</Link>;
  return <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Wrench className="h-3.5 w-3.5" />Maintained</span>;
}

function displayVehicleNo(vehicle: VehicleRow) { return isRegistrationPending(vehicle) ? "Registration pending" : vehicle.vehicle_no; }
function isRegistrationPending(vehicle: VehicleRow) { return vehicle.registration_status === "registration_pending" || vehicle.vehicle_no.toUpperCase().startsWith("PENDING-"); }
function policyCount(row: VehicleRow) { return row.policies?.[0]?.count ?? 0; }
function claimCount(row: VehicleRow) { return row.claims?.[0]?.count ?? 0; }
