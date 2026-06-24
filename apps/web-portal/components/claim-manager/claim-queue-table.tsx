import type { ReactNode } from "react";
import Link from "next/link";
import { PageSizeSelect } from "@/components/claim-manager/page-size-select";
import { operationsQueueForStatus, type ClaimStatus } from "@/lib/claim-workflow";

export type QueueClaimRow = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  current_status: ClaimStatus;
  accident_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string } | null;
  insurance_companies: { name: string } | null;
  assignee?: { full_name: string } | null;
};

type BrandLogo = { src: string; label: string };

const pageSizeOptions = [5, 10, 20, 50, 100];

const vehicleBrandLogos: Record<string, BrandLogo> = {
  "ashok leyland": { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  leyland: { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  honda: { src: "/assets/vehicle-brands/honda.svg", label: "Honda" },
  toyota: { src: "/assets/vehicle-brands/toyota.svg", label: "Toyota" },
  kia: { src: "/assets/vehicle-brands/kia.svg", label: "Kia" },
  "kia motors": { src: "/assets/vehicle-brands/kia.svg", label: "Kia" },
  maruti: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  suzuki: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  "maruti suzuki": { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  mahindra: { src: "/assets/vehicle-brands/mahindra.svg", label: "Mahindra" },
  "mahindra and mahindra": { src: "/assets/vehicle-brands/mahindra.svg", label: "Mahindra" },
  tata: { src: "/assets/vehicle-brands/tata.svg", label: "Tata Motors" },
  "tata motors": { src: "/assets/vehicle-brands/tata.svg", label: "Tata Motors" },
  hyundai: { src: "/assets/vehicle-brands/hyundai.svg", label: "Hyundai" },
  "hyundai motors": { src: "/assets/vehicle-brands/hyundai.svg", label: "Hyundai" }
};

const insurerBrandLogos: Record<string, BrandLogo> = {
  "bajaj allianz": { src: "/assets/insurers/bajaj-allianz.png", label: "Bajaj Allianz" },
  bajaj: { src: "/assets/insurers/bajaj-allianz.png", label: "Bajaj Allianz" },
  "icici lombard": { src: "/assets/insurers/icici-lombard.png", label: "ICICI Lombard" },
  "hdfc ergo": { src: "/assets/insurers/hdfc-ergo.png", label: "HDFC ERGO" },
  "tata aig": { src: "/assets/insurers/tata-aig.png", label: "TATA AIG" },
  "new india": { src: "/assets/insurers/new-india-assurance.png", label: "New India Assurance" },
  oriental: { src: "/assets/insurers/oriental-insurance.png", label: "Oriental Insurance" },
  "united india": { src: "/assets/insurers/united-india-insurance.png", label: "United India" },
  national: { src: "/assets/insurers/national-insurance.png", label: "National Insurance" },
  reliance: { src: "/assets/insurers/reliance-general.png", label: "Reliance General" },
  "iffco tokio": { src: "/assets/insurers/iffco-tokio.png", label: "IFFCO Tokio" },
  "royal sundaram": { src: "/assets/insurers/royal-sundaram.png", label: "Royal Sundaram" },
  "sbi general": { src: "/assets/insurers/sbi-general.png", label: "SBI General" },
  "future generali": { src: "/assets/insurers/future-generali.png", label: "Future Generali" },
  "kotak general": { src: "/assets/insurers/kotak-general.png", label: "Kotak General" }
};

export function ClaimQueueTable({ rows, page, pageSize, baseParams }: { rows: QueueClaimRow[]; page: number; pageSize: number; baseParams: Record<string, string> }) {
  const safePageSize = pageSizeOptions.includes(pageSize) ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const visibleRows = rows.slice(startIndex, startIndex + safePageSize);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[#E1E7F0] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-separate border-spacing-y-0 text-left text-[11px] leading-tight text-[#071D49]">
            <thead>
              <tr className="bg-[#003A83] text-center text-[10.5px] font-medium tracking-[0.01em] text-white">
                <Head className="rounded-tl-lg">Sr. No.</Head>
                <Head>Customer Name /<br />Mobile No.</Head>
                <Head>Vehicle No.</Head>
                <Head>Vehicle<br />Manufacturer</Head>
                <Head>Model</Head>
                <Head>Loss Date</Head>
                <Head>Insurer Name</Head>
                <Head>Policy Number</Head>
                <Head>Control Number</Head>
                <Head>Claim Number</Head>
                <Head>Process</Head>
                <Head className="rounded-tr-lg">Action</Head>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((claim, index) => <ClaimQueueRow key={claim.id} claim={claim} serial={startIndex + index + 1} />) : (
                <tr><td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={12}>No matching claims found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <QueuePagination total={rows.length} page={safePage} pageSize={safePageSize} totalPages={totalPages} baseParams={baseParams} />
    </>
  );
}

function ClaimQueueRow({ claim, serial }: { claim: QueueClaimRow; serial: number }) {
  const process = operationsQueueForStatus(claim.current_status);
  const customer = claim.customers?.company_name ?? claim.customers?.contact_name ?? "-";
  const manufacturer = claim.vehicles?.make ?? "-";
  const insurerName = claim.insurance_companies?.name ?? "InsureIT";
  return (
    <tr className="group bg-white align-middle shadow-[0_1px_0_rgba(226,232,240,0.86)] transition hover:bg-[#F8FBFF]">
      <Cell className="text-center text-[11px] font-medium text-[#111827]">{serial}</Cell>
      <Cell><span className="block text-[11.5px] font-medium text-[#071D49]">{customer}</span><span className="mt-0.5 block text-[10.5px] font-normal text-[#344256]">{claim.customers?.phone ?? "-"}</span></Cell>
      <Cell className="text-center text-[11px] font-medium tracking-tight">{claim.vehicles?.vehicle_no ?? "-"}</Cell>
      <Cell className="text-center"><ManufacturerBadge name={manufacturer} /></Cell>
      <Cell className="text-center text-[11px] font-normal leading-4">{claim.vehicles?.model ?? "-"}</Cell>
      <Cell className="text-center text-[10.5px] font-normal text-[#344256]">{formatDate(claim.accident_at ?? claim.created_at)}</Cell>
      <Cell className="text-center"><div className="inline-flex items-center gap-1.5 font-medium"><InsurerLogo name={insurerName} />{insurerName}</div></Cell>
      <Cell className="text-center text-[10.5px] font-normal text-[#344256]">{claim.policies?.policy_no ?? "-"}</Cell>
      <Cell className="text-center text-[10.5px] font-medium">{claim.claim_no}</Cell>
      <Cell className="text-center text-[10.5px] font-medium">{claim.insurer_claim_no ?? "-"}</Cell>
      <Cell><ProcessCell label={process?.label ?? claim.current_status} keyName={process?.key ?? "default"} /></Cell>
      <td className="px-1.5 py-1 text-center"><Link href={`/claims/${claim.id}`} className="inline-flex h-6 items-center justify-center rounded-md bg-[#003A83] px-2.5 text-[10.5px] font-medium text-white shadow-[0_2px_6px_rgba(0,58,131,0.16)] transition hover:bg-[#071D49]">Proceed</Link></td>
    </tr>
  );
}

function Head({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-2 py-2 ${className}`}>{children}</th>;
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-r border-[#E7ECF3] px-2 py-1 ${className}`}>{children}</td>;
}

function ManufacturerBadge({ name }: { name: string }) {
  const normalized = normalizeBrand(name);
  const brand = vehicleBrandLogos[normalized] ?? Object.entries(vehicleBrandLogos).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1];
  if (brand) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        <div className="grid h-6 min-w-9 place-items-center rounded-md bg-white px-1 shadow-[0_0_0_1px_rgba(7,29,73,0.06)]">
          <img src={brand.src} alt={brand.label} className="max-h-4 max-w-[36px] object-contain" />
        </div>
        <span className="max-w-[74px] text-center text-[9.5px] font-normal leading-3 text-[#27364F]">{brand.label}</span>
      </div>
    );
  }
  const initial = name && name !== "-" ? name.charAt(0).toUpperCase() : "V";
  return <div className="flex flex-col items-center justify-center gap-0.5"><div className="grid h-6 min-w-9 place-items-center rounded-md bg-white text-[13px] font-semibold text-[#003A83] shadow-[0_0_0_1px_rgba(7,29,73,0.06)]">{initial}</div><span className="max-w-[74px] text-center text-[9.5px] font-normal leading-3 text-[#27364F]">{name}</span></div>;
}

function normalizeBrand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function InsurerLogo({ name }: { name: string }) {
  const normalized = normalizeBrand(name);
  const brand = insurerBrandLogos[normalized] ?? Object.entries(insurerBrandLogos).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1];
  if (!brand) return <span className="inline-flex h-3.5 w-8 shrink-0 items-center justify-center rounded-sm border border-[#D6E0EE] bg-[#F8FBFF] text-[6px] font-semibold uppercase tracking-tight text-[#003A83]">insureit</span>;
  return <img src={brand.src} alt={brand.label} className="h-4 w-8 shrink-0 object-contain object-left" />;
}

function ProcessCell({ label, keyName }: { label: string; keyName: string }) {
  const tone = processTone(keyName);
  return <div className="flex items-center gap-1.25"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] ${tone.bg} ${tone.text}`}>{tone.icon}</span><span className="text-[10.5px] font-normal leading-3 text-[#1C2A3E]">{label}</span></div>;
}

function processTone(keyName: string) {
  if (keyName === "spot-deputation") return { icon: "⌖", bg: "bg-[#FFF3E1]", text: "text-[#E27A12]" };
  if (keyName === "claim-intimation") return { icon: "▤", bg: "bg-[#F1ECFF]", text: "text-[#6B46C1]" };
  if (keyName === "work-approval") return { icon: "✓", bg: "bg-[#EAF8F1]", text: "text-[#0D8A5F]" };
  if (keyName === "reinspection") return { icon: "⌕", bg: "bg-[#EDF6FF]", text: "text-[#003A83]" };
  if (keyName === "delivery-order") return { icon: "▣", bg: "bg-[#F3F7FF]", text: "text-[#003A83]" };
  if (keyName === "payment") return { icon: "₹", bg: "bg-[#FFF1F1]", text: "text-[#C43B45]" };
  if (keyName === "closed-claims") return { icon: "✓", bg: "bg-[#E8F8F0]", text: "text-[#087F5B]" };
  return { icon: "▣", bg: "bg-[#EAF3FF]", text: "text-[#003A83]" };
}

function QueuePagination({ total, page, pageSize, totalPages, baseParams }: { total: number; page: number; pageSize: number; totalPages: number; baseParams: Record<string, string> }) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EAF2] bg-white px-3 py-2 text-[11px] font-normal text-[#344256] shadow-[0_6px_18px_rgba(7,29,73,0.03)]">
      <p>Showing {from} to {to} of {total} claims</p>
      <div className="flex items-center gap-1.5">
        <PageLink disabled={page <= 1} page={page - 1} pageSize={pageSize} baseParams={baseParams}>‹</PageLink>
        {paginationItems(page, totalPages).map((item, index) => item === "..." ? <span key={`ellipsis-${index}`} className="grid h-7 min-w-7 place-items-center rounded-md border border-[#DCE4EF] px-2 text-[11px]">...</span> : <PageLink key={item} active={item === page} page={item} pageSize={pageSize} baseParams={baseParams}>{item}</PageLink>)}
        <PageLink disabled={page >= totalPages} page={page + 1} pageSize={pageSize} baseParams={baseParams}>›</PageLink>
      </div>
      <div className="flex items-center gap-2">
        <span>Items per page:</span>
        <PageSizeSelect value={pageSize} />
      </div>
    </div>
  );
}

function PageLink({ children, page, pageSize, baseParams, active = false, disabled = false }: { children: ReactNode; page: number; pageSize: number; baseParams: Record<string, string>; active?: boolean; disabled?: boolean }) {
  const href = disabled ? "#" : `/claims?${new URLSearchParams({ ...baseParams, page: String(page), pageSize: String(pageSize) }).toString()}`;
  const className = `grid h-7 min-w-7 place-items-center rounded-md border px-2 text-[11px] font-medium ${active ? "border-[#003A83] bg-[#003A83] text-white" : disabled ? "pointer-events-none border-[#E4EAF2] bg-[#F8FAFD] text-[#B6C1D1]" : "border-[#DCE4EF] bg-white text-[#071D49] hover:border-[#174EA6] hover:bg-[#F2F7FF]"}`;
  return <Link href={href} aria-disabled={disabled} className={className}>{children}</Link>;
}

function paginationItems(page: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const middle = [Math.max(2, page - 1), page, Math.min(totalPages - 1, page + 1)].filter((value, index, array) => value > 1 && value < totalPages && array.indexOf(value) === index);
  return [1, ...(middle[0] && middle[0] > 2 ? ["..." as const] : []), ...middle, ...(middle[middle.length - 1] && middle[middle.length - 1] < totalPages - 1 ? ["..." as const] : []), totalPages];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
