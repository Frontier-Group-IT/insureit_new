import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Card } from "@/components/shell";
import {
  VERIFIED_VEHICLE_BRAND_LOGOS,
  VEHICLE_MANUFACTURER_LOGO_STATUSES,
  VEHICLE_MANUFACTURER_MARKET_STATUSES,
  VEHICLE_MANUFACTURER_SEGMENTS,
} from "@/lib/vehicle-manufacturer-master";

type ManufacturerValues = {
  manufacturer_code?: string | null;
  name?: string | null;
  display_name?: string | null;
  slug?: string | null;
  parent_group_name?: string | null;
  country_of_origin?: string | null;
  india_presence_type?: string | null;
  website_url?: string | null;
  market_status?: string | null;
  logo_path?: string | null;
  logo_source_url?: string | null;
  logo_status?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  source_verified_at?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

const inputClass = "h-11 w-full rounded-xl border border-[#D8DEEA] bg-white px-3 text-[12px] font-medium text-[#17213B] outline-none transition focus:border-[#6759ff] focus:ring-2 focus:ring-[#6759ff]/10";
const labelClass = "mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]";

export function ManufacturerForm({
  action,
  values = {},
  selectedSegments = [],
  brands = "",
  aliases = "",
  submitLabel = "Save manufacturer",
  cancelHref = "/master-data/vehicle-manufacturers",
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: ManufacturerValues;
  selectedSegments?: string[];
  brands?: string;
  aliases?: string;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const verifiedAt = values.source_verified_at ? values.source_verified_at.slice(0, 10) : "";

  return (
    <form action={action} className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6759ff]">Registered identity</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#161936]">Manufacturer identity</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#6C738A]">Keep the legal company identity separate from the shorter label shown in operational screens.</p>
          </div>
          {values.logo_path ? (
            <div className="grid h-16 w-28 place-items-center rounded-2xl border border-[#E1E6F0] bg-white p-2">
              <Image src={values.logo_path} alt="Manufacturer logo" width={92} height={44} className="max-h-11 w-auto object-contain" />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Registered legal name" required><input className={inputClass} name="name" required defaultValue={values.name ?? ""} placeholder="e.g. Mahindra & Mahindra Limited" /></Field>
          <Field label="Display name" required><input className={inputClass} name="display_name" required defaultValue={values.display_name ?? ""} placeholder="e.g. Mahindra" /></Field>
          <Field label="Manufacturer code" required><input className={inputClass} name="manufacturer_code" required defaultValue={values.manufacturer_code ?? ""} placeholder="OEM-MAHINDRA" /></Field>
          <Field label="Slug" required><input className={inputClass} name="slug" required defaultValue={values.slug ?? ""} placeholder="mahindra" /></Field>
          <Field label="Parent group"><input className={inputClass} name="parent_group_name" defaultValue={values.parent_group_name ?? ""} /></Field>
          <Field label="Country of origin"><input className={inputClass} name="country_of_origin" defaultValue={values.country_of_origin ?? ""} placeholder="India / Japan / Germany" /></Field>
          <Field label="India presence"><input className={inputClass} name="india_presence_type" defaultValue={values.india_presence_type ?? ""} placeholder="Indian OEM / Subsidiary / JV" /></Field>
          <Field label="Website"><input className={inputClass} type="url" name="website_url" defaultValue={values.website_url ?? ""} placeholder="https://..." /></Field>
          <Field label="Sort order"><input className={inputClass} type="number" name="sort_order" defaultValue={values.sort_order ?? 1000} min={0} /></Field>
          <Field label="Market status"><select className={inputClass} name="market_status" defaultValue={values.market_status ?? "pending_review"}>{VEHICLE_MANUFACTURER_MARKET_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Record status"><span className="flex h-11 items-center gap-2 rounded-xl border border-[#D8DEEA] bg-white px-3 text-[12px] font-semibold text-[#28344E]"><input type="checkbox" name="is_active" defaultChecked={values.is_active ?? true} /> Active for operational use</span></Field>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#17A7A9]">Operational matching</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#161936]">Segments, brands & aliases</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#6C738A]">Brands and aliases are also accepted by the vehicle make validator, so RC/OCR values do not have to equal the registered legal name.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <div>
            <span className={labelClass}>Vehicle segments</span>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {VEHICLE_MANUFACTURER_SEGMENTS.map(([value, label]) => (
                <label key={value} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#E2E7F0] bg-[#FBFCFE] px-3 text-[11px] font-semibold text-[#34405A]">
                  <input type="checkbox" name="segments" value={value} defaultChecked={selectedSegments.includes(value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <Field label="Brands / makes"><textarea className="min-h-28 w-full rounded-xl border border-[#D8DEEA] bg-white p-3 text-[12px] outline-none focus:border-[#6759ff] focus:ring-2 focus:ring-[#6759ff]/10" name="brands" defaultValue={brands} placeholder="One per line or comma separated" /></Field>
            <Field label="Aliases / RC variations"><textarea className="min-h-28 w-full rounded-xl border border-[#D8DEEA] bg-white p-3 text-[12px] outline-none focus:border-[#6759ff] focus:ring-2 focus:ring-[#6759ff]/10" name="aliases" defaultValue={aliases} placeholder="Bharat Benz, BharatBenz..." /></Field>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F59E0B]">Verification & branding</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#161936]">Source and logo provenance</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#6C738A]">Uploaded Master Data logos are authoritative. Repository logos remain fallback-only when no uploaded logo is configured.</p>
        </div>

        <div className="mb-4">
          <span className={labelClass}>Company logo / icon</span>
          <div className="flex flex-col gap-3 rounded-2xl border border-[#D8DEEA] bg-white p-3 sm:flex-row sm:items-center">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E1E6F0] bg-[#FBFCFE] p-2">
              {values.logo_path ? <Image src={values.logo_path} alt="Current manufacturer logo" width={48} height={48} className="max-h-12 max-w-12 object-contain" /> : <span className="text-[9px] font-bold uppercase tracking-wide text-[#98A2B3]">Logo</span>}
            </div>
            <div className="min-w-0 flex-1">
              <input className="block w-full rounded-xl border border-[#D8DEEA] bg-[#FBFCFE] px-3 py-2 text-[11px] text-[#34405A] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF3FF] file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-[#3446A8]" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
              <p className="mt-1.5 text-[9px] leading-4 text-[#8A94A8]">PNG, JPG or WebP, maximum 2 MB. A new upload replaces the current managed logo everywhere this manufacturer logo is used.</p>
              {values.logo_path ? <label className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-[#667085]"><input type="checkbox" name="remove_logo" /> Remove current uploaded logo and use fallback</label> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Repository fallback"><select className={inputClass} name="fallback_logo_path" defaultValue={values.logo_path?.startsWith("/assets/") ? values.logo_path : ""}>{VERIFIED_VEHICLE_BRAND_LOGOS.map(([value, label]) => <option key={value || "none"} value={value}>{label}</option>)}</select></Field>
          <Field label="Logo status"><select className={inputClass} name="logo_status" defaultValue={values.logo_status ?? "missing"}>{VEHICLE_MANUFACTURER_LOGO_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Logo source URL"><input className={inputClass} type="url" name="logo_source_url" defaultValue={values.logo_source_url ?? ""} /></Field>
          <Field label="Source name"><input className={inputClass} name="source_name" defaultValue={values.source_name ?? ""} placeholder="SIAM / TMA / ICEMA / OEM" /></Field>
          <Field label="Source URL"><input className={inputClass} type="url" name="source_url" defaultValue={values.source_url ?? ""} /></Field>
          <Field label="Verified on"><input className={inputClass} type="date" name="source_verified_at" defaultValue={verifiedAt} /></Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D7DDE8] bg-white px-4 text-[11px] font-bold text-[#44506A] hover:bg-[#F8FAFD]">Cancel</Link>
        <FormSubmitButton label={submitLabel} pendingLabel="Saving manufacturer" />
      </div>
    </form>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className={labelClass}>{label}{required ? " *" : ""}</span>{children}</label>;
}
