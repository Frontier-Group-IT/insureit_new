import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebVehicleDetail } from "@/lib/partner-vehicles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function inputDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function displayValue(value: string | number | null | undefined) {
  if (value == null) return "Not recorded";
  const text = String(value).trim();
  return text || "Not recorded";
}

function ReadOnlyField({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string | number | null | undefined;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-medium text-[#334155]">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        readOnly
        value={displayValue(value)}
        className="h-[50px] w-full rounded-[15px] border border-[#D7E0ED] bg-white px-4 text-[12px] font-medium text-[#34435B] outline-none"
      />
    </label>
  );
}

function SelectLikeField({
  label,
  value,
  required = false,
  hint,
}: {
  label: string;
  value: string | number | null | undefined;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[#334155]">
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        {hint ? <span className="text-[8px] text-[#64748B]">{hint}</span> : null}
      </div>
      <div className="flex h-[50px] items-center justify-between rounded-[15px] border border-[#D7E0ED] bg-white px-4 text-[12px] font-medium text-[#34435B]">
        <span className="truncate">{displayValue(value)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#0F172A]" />
      </div>
    </div>
  );
}

function DateField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-medium text-[#334155]">{label}</span>
      <input
        type="date"
        readOnly
        value={inputDate(value)}
        className="h-[50px] w-full rounded-[15px] border border-[#D7E0ED] bg-white px-4 text-[12px] font-medium text-[#34435B] outline-none"
      />
    </label>
  );
}

function StepSection({
  number,
  title,
  children,
  action,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[15px] border border-[#D7E0ED] bg-white shadow-[0_8px_24px_rgba(30,64,175,0.04)]">
      <div className="flex min-h-[64px] items-center justify-between border-b border-[#DDE5EF] px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#173F70] text-[12px] font-extrabold text-white">
            {number}
          </span>
          <h2 className="text-[14px] font-bold text-[#18243A]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export default async function PartnerVehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPartnerWebVehicleDetail(id);
  const vehicle = data.vehicle;
  if (!vehicle) notFound();

  const registrationPending =
    !vehicle.vehicle_no ||
    vehicle.vehicle_no.toUpperCase().startsWith("NEW-") ||
    ["registration_pending", "pending", "rc_pending"].includes(
      (vehicle.registration_status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_"),
    );

  return (
    <PartnerPortalShell title="Vehicle Details">
      <div className="space-y-4 pb-5">
        <section className="overflow-hidden rounded-[16px] border border-[#D7E0ED] bg-white shadow-[0_10px_28px_rgba(30,64,175,0.05)]">
          <div className="flex min-h-[80px] items-center justify-between bg-[#234C7D] px-7 text-white">
            <h1 className="text-[20px] font-bold tracking-[-0.02em]">Vehicle Onboarding</h1>
            <Link
              href="/partner/vehicles"
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-white/25 px-5 text-[11px] font-semibold text-white transition hover:bg-white/10"
            >
              Back
            </Link>
          </div>

          <div className="grid min-h-[58px] divide-x divide-[#D7E0ED] md:grid-cols-3">
            {[
              ["01", "Vehicle Ownership"],
              ["02", "Vehicle Specification"],
              ["03", "Compliance & Permit"],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center justify-center gap-3 px-4 py-3 text-[#586A82]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EFF6FC] text-[10px] font-bold text-[#4B6481]">
                  {number}
                </span>
                <span className="text-[11px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <StepSection
          number="01"
          title="Vehicle Ownership"
          action={
            <div className="flex rounded-full border border-[#D0DBE8] bg-white p-0.5 shadow-[0_5px_16px_rgba(15,23,42,0.05)]">
              <span
                className={`inline-flex h-9 items-center rounded-full px-4 text-[10px] font-semibold ${
                  !registrationPending ? "bg-[#173F70] text-white" : "text-[#6B7B90]"
                }`}
              >
                ▣&nbsp;&nbsp;Registered
              </span>
              <span
                className={`inline-flex h-9 items-center rounded-full px-4 text-[10px] font-semibold ${
                  registrationPending ? "bg-[#173F70] text-white" : "text-[#6B7B90]"
                }`}
              >
                ◇&nbsp;&nbsp;Unregistered
              </span>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <ReadOnlyField label="Customer" value={data.customer.customer_name} required />
            <ReadOnlyField label="RC / Registration number" value={vehicle.vehicle_no || "Registration pending"} required />
            <DateField label="Registration date" value={vehicle.registration_date} />
            <SelectLikeField label="Manufacturer" value={vehicle.make} required />
            <SelectLikeField label="MFG Year" value={vehicle.year} />
            <ReadOnlyField label="Model" value={vehicle.model} />
          </div>
        </StepSection>

        <StepSection number="02" title="Vehicle Specification">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SelectLikeField
              label="Class"
              value={vehicle.vehicle_type}
              required
              hint={vehicle.vehicle_type ? "Goods Carrying Vehicle" : undefined}
            />
            <ReadOnlyField label="Chassis number" value={vehicle.chassis_no} />
            <ReadOnlyField label="Engine number" value={vehicle.engine_no} />
            <SelectLikeField label="Fuel Type" value={vehicle.fuel_type} />
            <ReadOnlyField label="Capacity (GVW)" value={vehicle.gvw_kg} />
          </div>
        </StepSection>

        <StepSection number="03" title="Compliance & Permit">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DateField label="Fitness expiry" value={vehicle.fitness_expiry_date} />
            <DateField label="PUC expiry" value={vehicle.puc_expiry_date} />
            <DateField label="Road tax expiry" value={vehicle.road_tax_expiry_date} />
            <DateField label="National permit expiry" value={vehicle.national_permit_expiry_date} />
            <DateField label="Local permit expiry" value={vehicle.local_permit_expiry_date} />
          </div>
        </StepSection>

        <details className="group overflow-hidden rounded-[15px] border border-[#D7E0ED] bg-white">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-5 text-[11px] font-semibold text-[#1F3B5F] [&::-webkit-details-marker]:hidden">
            <span>Activity Status</span>
            <ChevronDown className="h-4 w-4 rounded-full border border-[#D7E0ED] p-0.5 text-[#55708E] transition group-open:rotate-180" />
          </summary>
          <div className="grid border-t border-[#E1E7EF] bg-[#FAFCFF] md:grid-cols-3">
            <div className="border-b border-[#E1E7EF] px-5 py-4 md:border-b-0 md:border-r">
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#8493A7]">Policies</p>
              <p className="mt-1 text-[18px] font-extrabold text-[#173F70]">{data.activity.policies}</p>
            </div>
            <div className="border-b border-[#E1E7EF] px-5 py-4 md:border-b-0 md:border-r">
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#8493A7]">Claims</p>
              <p className="mt-1 text-[18px] font-extrabold text-[#173F70]">{data.activity.claims}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#8493A7]">Registration</p>
              <p className="mt-1 text-[12px] font-bold text-[#173F70]">
                {registrationPending ? "Pending" : "Registered"}
              </p>
            </div>
          </div>
        </details>
      </div>
    </PartnerPortalShell>
  );
}
