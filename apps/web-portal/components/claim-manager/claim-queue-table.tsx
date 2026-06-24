import type { ReactNode } from "react";
import Link from "next/link";
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

type BrandLogo = {
  src: string;
  label: string;
};

const PAGE_SIZE = 7;

const vehicleBrandLogos: Record<string, BrandLogo> = {
  "ashok leyland": { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  leyland: { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  honda: { src: "/assets/vehicle-brands/honda.svg", label: "Honda" },
  toyota: { src: "/assets/vehicle-brands/toyota.svg", label: "Toyota" },
  kia: { src: "/assets/vehicle-brands/kia.svg", label: "Kia Motors" },
  "kia motors": { src: "/assets/vehicle-brands/kia.svg", label: "Kia Motors" },
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

export function ClaimQueueTable({ rows, page, baseParams }: { rows: QueueClaimRow[]; page: number; baseParams: Record<string, string> }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[#E1E7F0] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.055)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] border-separate border-spacing-y-0 text-left text-[13px] leading-tight text-[#071D49]">
            <thead>
              <tr className="bg-[#003A83] text-center text-[12px] font-semibold tracking-[0.01em] text-white">
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
                <tr><td className="px-3 py-10 text-center text-sm text-slate-500" colSpan={12}>No matching claims found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <QueuePagination total={rows.length} page={safePage} totalPages={totalPages} baseParams={baseParams} />
    </>
  );
}

function ClaimQueueRow({ claim, serial }: { claim: QueueClaimRow; serial: number }) {
  const process = operationsQueueForStatus(claim.current_status);
  const customer = claim.customers?.company_name ?? claim.customers?.contact_name ?? "-";
  const manufacturer = claim.vehicles?.make ?? "-";
  return (
    <tr className="group bg-white align-middle shadow-[0_1px_0_rgba(226,232,240,0.9)] transition hover:bg-[#F8FBFF]">
      <Cell className="text-center text-[14px] font-medium text-[#111827]">{serial}</Cell>
      <Cell><span className="block text-[13px] font-semibold text-[#071D49]">{customer}</span><span className="mt-0.5 block text-[12px] font-normal text-[#344256]">{claim.customers?.phone ?? "-"}</span></Cell>
      <Cell className="text-center text-[13px] font-medium tracking-tight">{claim.vehicles?.vehicle_no ?? "-"}</Cell>
      <Cell className="text-center"><ManufacturerBadge name={manufacturer} /></Cell>
      <Cell className="text-center text-[13px] font-medium leading-5">{claim.vehicles?.model ?? "-"}</Cell>
      <Cell className="text-center text-[12px] font-normal text-[#344256]">{formatDate(claim.accident_at ?? claim.created_at)}</Cell>
      <Cell className="text-center"><div className="inline-flex items-center gap-1.5 font-semibold"><MiniShield />{claim.insurance_companies?.name ?? "InsureIT"}</div></Cell>
      <Cell className="text-center text-[12px] font-normal text-[#344256]">{claim.policies?.policy_no ?? "-"}</Cell>
      <Cell className="text-center text-[12px] font-medium">{claim.claim_no}</Cell>
      <Cell className="text-center text-[12px] font-medium">{claim.insurer_claim_no ?? "-"}</Cell>
      <Cell><ProcessCell label={process?.label ?? claim.current_status} keyName={process?.key ?? "default"} /></Cell>
      <td className="px-3 py-2.5 text-center"><Link href={`/claims/${claim.id}`} className="inline-flex h-8 items-center justify-center rounded-md bg-[#003A83] px-4 text-[12px] font-medium text-white shadow-[0_3px_8px_rgba(0,58,131,0.18)] transition hover:bg-[#071D49]">Proceed</Link></td>
    </tr>
  );
}

function Head({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-3 py-3 ${className}`}>{children}</th>;
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-r border-[#E7ECF3] px-3 py-2.5 ${className}`}>{children}</td>;
}

function ManufacturerBadge({ name }: { name: string }) {
  const normalized = normalizeBrand(name);
  const brand = vehicleBrandLogos[normalized] ?? Object.entries(vehicleBrandLogos).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1];
  if (brand) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        <div className="grid h-9 min-w-12 place-items-center rounded-lg bg-white px-1.5 shadow-[0_0_0_1px_rgba(7,29,73,0.07)]">
          <img src={brand.src} alt={brand.label} className="max-h-7 max-w-[58px] object-contain" />
        </div>
        <span className="max-w-[94px] text-center text-[11px] font-medium leading-3 text-[#27364F]">{brand.label}</span>
      </div>
    );
  }
  const initial = name && name !== "-" ? name.charAt(0).toUpperCase() : "V";
  return <div className="flex flex-col items-center justify-center gap-0.5"><div className="grid h-9 min-w-12 place-items-center rounded-lg bg-white text-[18px] font-semibold text-[#003A83] shadow-[0_0_0_1px_rgba(7,29,73,0.07)]">{initial}</div><span className="max-w-[94px] text-center text-[11px] font-medium leading-3 text-[#27364F]">{name}</span></div>;
}

function normalizeBrand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function MiniShield() {
  return <span className="grid h-5 w-5 place-items-center rounded-[5px] border border-[#D8A52A] bg-[#071D49] text-[9px] font-semibold text-white">i</span>;
}

function ProcessCell({ label, keyName }: { label: string; keyName: string }) {
  const tone = processTone(keyName);
  return <div className="flex items-center gap-2"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] ${tone.bg} ${tone.text}`}>{tone.icon}</span><span className="text-[12px] font-medium leading-4 text-[#1C2A3E]">{label}</span></div>;
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

function QueuePagination({ total, page, totalPages, baseParams }: { total: number; page: number; totalPages: number; baseParams: Record<string, string> }) {
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EAF2] bg-white px-4 py-3 text-[12px] font-normal text-[#344256] shadow-[0_6px_18px_rgba(7,29,73,0.035)]">
      <p>Showing {from} to {to} of {total} claims</p>
      <div className="flex items-center gap-2">
        <PageLink disabled={page <= 1} page={page - 1} baseParams={baseParams}>‹</PageLink>
        {paginationItems(page, totalPages).map((item, index) => item === "..." ? <span key={`ellipsis-${index}`} className="grid h-8 min-w-8 place-items-center rounded-md border border-[#DCE4EF] px-2 text-[12px]">...</span> : <PageLink key={item} active={item === page} page={item} baseParams={baseParams}>{item}</PageLink>)}
        <PageLink disabled={page >= totalPages} page={page + 1} baseParams={baseParams}>›</PageLink>
      </div>
      <div className="flex items-center gap-2"><span>Items per page:</span><span className="flex h-8 min-w-[64px] items-center justify-center gap-1 rounded-md border border-[#DCE4EF] bg-white text-[12px] font-medium">7</span></div>
    </div>
  );
}

function PageLink({ children, page, baseParams, active = false, disabled = false }: { children: ReactNode; page: number; baseParams: Record<string, string>; active?: boolean; disabled?: boolean }) {
  const href = disabled ? "#" : `/claims?${new URLSearchParams({ ...baseParams, page: String(page) }).toString()}`;
  const className = `grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[12px] font-medium ${active ? "border-[#003A83] bg-[#003A83] text-white" : disabled ? "pointer-events-none border-[#E4EAF2] bg-[#F8FAFD] text-[#B6C1D1]" : "border-[#DCE4EF] bg-white text-[#071D49] hover:border-[#174EA6] hover:bg-[#F2F7FF]"}`;
  return <Link href={href} aria-disabled={disabled} className={className}>{children}</Link>;
}

function paginationItems(page: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const middle = [Math.max(2, page - 1), page, Math.min(totalPages - 1, page + 1)].filter((value, index, array) => value > 1 && value < totalPages && array.indexOf(value) === index);
  return [1, ...(middle[0] && middle[0] > 2 ? ["..." as const] : []), ...middle, ...(middle[middle.length - 1] && middle[middle.length - 1] < totalPages - 1 ? ["..." as const] : []), totalPages];
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}
