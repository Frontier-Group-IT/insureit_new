"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Eye,
  FileCheck2,
  Fingerprint,
  Landmark,
  MapPin,
  RotateCw,
  Save,
  ShieldCheck,
  User,
  Users,
  type LucideIcon
} from "lucide-react";
import { IndianDateField } from "@/components/indian-date-field";

type PartnerType = "posp" | "misp";
type Option = { value: string; label: string };
type SalesManager = { id: string; fullName: string; employeeCode: string | null };

type Props = {
  partnerType: PartnerType;
  salesManagers: SalesManager[];
  oems: Option[];
  banks: Option[];
  masterDataAvailable: boolean;
};

type RequiredGroup = {
  label: string;
  fields: string[];
};

const controlClass =
  "h-10 w-full rounded-md border border-[#C7D1DF] bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#98A2B3] hover:border-[#9AA9BC] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";
const labelClass = "mb-1.5 block text-[11px] font-medium text-[#344054]";

export function PospMispOnboardingDesignReview({
  partnerType,
  salesManagers,
  oems,
  banks,
  masterDataAvailable
}: Props) {
  const isMisp = partnerType === "misp";
  const [filledFields, setFilledFields] = useState<Set<string>>(() => new Set(["partner_type"]));
  const [associateId, setAssociateId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const requiredGroups = useMemo<RequiredGroup[]>(
    () => [
      {
        label: "Assignment",
        fields: ["partner_type", "associate_employee_id", "external_onboarding_id"]
      },
      {
        label: isMisp ? "MISP registration" : "POSP registration",
        fields: isMisp
          ? ["misp_name", "pan_number", "oem_name"]
          : ["pos_first_name", "pos_last_name", "pan_number"]
      },
      {
        label: "Address",
        fields: ["address", "city", "state", "postal_code"]
      },
      {
        label: isMisp ? "Designated Person" : "POSP contact",
        fields: isMisp
          ? [
              "dp_first_name",
              "dp_last_name",
              "dp_phone",
              "dp_email",
              "dp_pan_number",
              "date_of_birth",
              "aadhaar_number"
            ]
          : ["applicant_phone", "applicant_email", "date_of_birth", "aadhaar_number"]
      },
      {
        label: "Bank details",
        fields: ["bank_id", "bank_account_number", "bank_ifsc_code"]
      }
    ],
    [isMisp]
  );

  const requiredFields = useMemo(
    () => requiredGroups.flatMap((group) => group.fields),
    [requiredGroups]
  );
  const completedFields = requiredFields.filter((field) => filledFields.has(field)).length;
  const completion = Math.round((completedFields / requiredFields.length) * 100);
  const selectedAssociate = salesManagers.find((manager) => manager.id === associateId) ?? null;
  const readiness = completion === 100 ? "Ready for PAN check" : "Incomplete";

  function updateSummary(form: HTMLFormElement) {
    const data = new FormData(form);
    const nextFilled = new Set<string>();
    for (const field of requiredFields) {
      const current = data.get(field);
      if (typeof current === "string" && current.trim()) nextFilled.add(field);
    }
    setFilledFields(nextFilled);
    setAssociateId(String(data.get("associate_employee_id") ?? ""));
    setExternalId(String(data.get("external_onboarding_id") ?? ""));
    setNotice(null);
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 pb-16">
      <section className="flex flex-col gap-3 border-b border-[#D8DEE8] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2C76E] bg-[#FFF8E8] px-2.5 py-1 text-[10px] font-semibold text-[#8A5A00]">
              <Eye className="h-3.5 w-3.5" />
              Design review
            </span>
            <span className="text-[11px] text-[#667085]">No application will be saved</span>
          </div>
          <h2 className="mt-2 text-[22px] font-semibold text-[#172033]">POSP / MISP Onboarding</h2>
        </div>

        <div className="flex items-center gap-1 border-b border-[#D8DEE8]">
          <span className="border-b-2 border-[#2563EB] px-3 py-2 text-[12px] font-semibold text-[#1D4ED8]">
            Manual onboarding
          </span>
          <Link
            href="/customers/posp-misp/import"
            className="px-3 py-2 text-[12px] font-medium text-[#667085] transition hover:text-[#172033]"
          >
            Excel upload
          </Link>
        </div>
      </section>

      <StageBar />

      {!masterDataAvailable ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-[#E8C97A] bg-[#FFF9E8] px-3.5 py-3 text-[11px] leading-4 text-[#76510A]"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Local preview mode: Sales associates, OEMs and banks are unavailable because the
            portal&apos;s Supabase admin credentials are not configured. The form remains available
            for visual review.
          </span>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onInput={(event) => updateSummary(event.currentTarget)}
          onInvalid={(event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement;
            const label = target.labels?.[0]?.textContent?.replace("*", "").trim();
            setNotice(`${label || "A required field"} needs attention.`);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            setNotice("Design preview only. The application was not saved or queued for PAN verification.");
          }}
          className="overflow-hidden rounded-lg border border-[#D8DEE8] bg-white"
        >
          <input type="hidden" name="partner_type" value={partnerType} />

          <section className="border-b border-[#D8DEE8] bg-[#F7F9FC] px-4 py-4 sm:px-5">
            <SectionHeading
              icon={Users}
              title="Assignment"
              description="Select the account type, responsible Sales associate and operational ID."
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[190px_minmax(240px,1fr)_220px_190px]">
              <div>
                <span className={labelClass}>Partner type *</span>
                <div className="grid h-10 grid-cols-2 rounded-md border border-[#C7D1DF] bg-[#E9EDF4] p-1">
                  <PartnerTypeLink active={!isMisp} partnerType="posp" label="POSP" />
                  <PartnerTypeLink active={isMisp} partnerType="misp" label="MISP" />
                </div>
              </div>

              <SelectField
                label="Associate (Sales)"
                name="associate_employee_id"
                required
                options={salesManagers.map((manager) => ({
                  value: manager.id,
                  label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}`
                }))}
                placeholder={masterDataAvailable ? "Select associate" : "Master data unavailable"}
                disabled={!masterDataAvailable}
              />

              <InputField
                label={isMisp ? "MISP ID" : "POSP ID"}
                name="external_onboarding_id"
                required
                placeholder="Enter operational ID"
              />

              <ReviewDateField label="Document received" name="document_received_at" />
            </div>
          </section>

          <FormSection
            icon={Building2}
            title={isMisp ? "MISP registration" : "POSP registration"}
            description={
              isMisp
                ? "Business identity and manufacturer affiliation."
                : "Applicant identity used for registration and PAN verification."
            }
          >
            {isMisp ? (
              <>
                <InputField label="MISP name" name="misp_name" required className="md:col-span-2" />
                <PanField
                  label="MISP PAN"
                  name="pan_number"
                  onCheck={() => setNotice("Design preview only. PAN verification was not started.")}
                />
                <SelectField
                  label="OEM name"
                  name="oem_name"
                  required
                  options={oems}
                  placeholder={masterDataAvailable ? "Select OEM" : "Master data unavailable"}
                  disabled={!masterDataAvailable}
                />
              </>
            ) : (
              <>
                <InputField label="POS first name" name="pos_first_name" required />
                <InputField label="POS middle name" name="pos_middle_name" />
                <InputField label="POS last name" name="pos_last_name" required />
                <PanField
                  label="PAN number"
                  name="pan_number"
                  onCheck={() => setNotice("Design preview only. PAN verification was not started.")}
                />
              </>
            )}
            <InputField
              label="GST number"
              name="gst_number"
              maxLength={15}
              placeholder="Optional"
            />
          </FormSection>

          <FormSection
            icon={MapPin}
            title="Registered address"
            description="Address recorded for onboarding and correspondence."
          >
            <InputField
              label="Address"
              name="address"
              required
              className="md:col-span-2 xl:col-span-2"
              placeholder="House, street and locality"
            />
            <InputField label="City" name="city" required />
            <InputField label="State" name="state" required />
            <InputField
              label="PIN code"
              name="postal_code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
            />
          </FormSection>

          {isMisp ? (
            <FormSection
              icon={User}
              title="Designated Person"
              description="Identity and contact details for the MISP designated person."
            >
              <InputField label="DP first name" name="dp_first_name" required />
              <InputField label="DP middle name" name="dp_middle_name" />
              <InputField label="DP last name" name="dp_last_name" required />
              <InputField
                label="DP contact"
                name="dp_phone"
                required
                inputMode="tel"
                pattern="(?:\+91)?[6-9][0-9]{9}"
              />
              <InputField label="DP email" name="dp_email" type="email" required />
              <PanField
                label="DP PAN number"
                name="dp_pan_number"
                onCheck={() => setNotice("Design preview only. PAN verification was not started.")}
              />
              <ReviewDateField label="DP date of birth" name="date_of_birth" required />
              <InputField
                label="DP Aadhaar number"
                name="aadhaar_number"
                required
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                minLength={12}
                placeholder="Enter all 12 digits"
              />
            </FormSection>
          ) : (
            <FormSection
              icon={User}
              title="POSP contact and identity"
              description="Contact and KYC information for the POSP applicant."
            >
              <InputField
                label="Mobile number"
                name="applicant_phone"
                required
                inputMode="tel"
                pattern="(?:\+91)?[6-9][0-9]{9}"
              />
              <InputField label="Email address" name="applicant_email" type="email" required />
              <ReviewDateField label="Date of birth" name="date_of_birth" required />
              <InputField
                label="Aadhaar number"
                name="aadhaar_number"
                required
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                minLength={12}
                placeholder="Enter all 12 digits"
              />
            </FormSection>
          )}

          <FormSection
            icon={Landmark}
            title="Bank details"
            description="Validated bank account for operational and payout records."
            last
          >
            <SelectField
              label="Bank name"
              name="bank_id"
              required
              options={banks}
              placeholder={masterDataAvailable ? "Select bank" : "Master data unavailable"}
              disabled={!masterDataAvailable}
              className="md:col-span-2"
            />
            <InputField
              label="Account number"
              name="bank_account_number"
              required
              inputMode="numeric"
              pattern="[0-9]{6,20}"
            />
            <InputField
              label="IFSC code"
              name="bank_ifsc_code"
              required
              maxLength={11}
              minLength={11}
              pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
            />
          </FormSection>

          <div className="sticky bottom-3 z-20 mx-3 mb-3 flex flex-col gap-3 rounded-lg border border-[#C7D1DF] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(23,32,51,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="min-h-5 text-[11px] text-[#667085]">
              {notice ? (
                <span className="inline-flex items-center gap-1.5 text-[#A23B32]">
                  <CircleAlert className="h-3.5 w-3.5" />
                  {notice}
                </span>
              ) : (
                "Documents become available after the IIB or Partner-route decision."
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setNotice("Design preview only. No draft was saved.")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#C7D1DF] bg-white px-4 text-[12px] font-semibold text-[#344054] transition hover:bg-[#F7F9FC]"
              >
                <Save className="h-4 w-4" />
                Save draft
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2563EB] px-4 text-[12px] font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                Save and check PAN
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>

        <aside className="sticky top-[86px] overflow-hidden rounded-lg border border-[#D8DEE8] bg-white">
          <div className="flex items-center gap-2 bg-[#071D49] px-4 py-3 text-white">
            <ShieldCheck className="h-4 w-4 text-[#74D6D1]" />
            <h3 className="text-[13px] font-semibold">Onboarding summary</h3>
          </div>

          <div className="space-y-4 p-4">
            <dl className="space-y-3 text-[11px]">
              <SummaryRow label="Partner type" value={partnerType.toUpperCase()} />
              <SummaryRow
                label="Associate"
                value={
                  selectedAssociate
                    ? `${selectedAssociate.fullName}${selectedAssociate.employeeCode ? ` - ${selectedAssociate.employeeCode}` : ""}`
                    : "Not selected"
                }
              />
              <SummaryRow
                label={isMisp ? "MISP ID" : "POSP ID"}
                value={externalId || "Not entered"}
              />
            </dl>

            <div className="border-t border-[#E4E9F0] pt-4">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-medium text-[#344054]">Required fields</span>
                <span className="font-semibold text-[#1D4ED8]">
                  {completedFields}/{requiredFields.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E9F0]">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-[width] duration-300"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <p className="mt-1.5 text-right text-[10px] text-[#667085]">{completion}% complete</p>
            </div>

            <div className="space-y-2 border-t border-[#E4E9F0] pt-4">
              {requiredGroups.map((group) => {
                const complete = group.fields.every((field) => filledFields.has(field));
                const count = group.fields.filter((field) => filledFields.has(field)).length;
                return (
                  <div
                    key={group.label}
                    className="flex items-center justify-between gap-3 text-[11px]"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[#475467]">
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                          complete
                            ? "bg-[#E7F7F2] text-[#087A5B]"
                            : "bg-[#F1F4F8] text-[#98A2B3]"
                        }`}
                      >
                        {complete ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-[#667085]">
                      {count}/{group.fields.length}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className={`rounded-md border px-3 py-2.5 ${
                completion === 100
                  ? "border-[#A7DDCD] bg-[#F0FAF7] text-[#087A5B]"
                  : "border-[#F0C7C2] bg-[#FFF4F2] text-[#A23B32]"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase">Readiness</p>
              <p className="mt-0.5 text-[12px] font-semibold">{readiness}</p>
            </div>

            <div className="flex gap-2 border-t border-[#E4E9F0] pt-4 text-[10px] leading-4 text-[#667085]">
              <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
              <span>Next: PAN result, IIB routing and pre-IIB document collection.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StageBar() {
  return (
    <ol className="grid overflow-hidden rounded-lg border border-[#D8DEE8] bg-white sm:grid-cols-3">
      <Stage active number="1" label="Primary and IIB" />
      <Stage number="2" label="Documents" />
      <Stage number="3" label="Review" />
    </ol>
  );
}

function Stage({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return (
    <li
      className={`flex h-12 items-center justify-center gap-2 border-b px-3 text-[11px] font-semibold last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
        active
          ? "border-[#BDD0F8] bg-[#EFF5FF] text-[#1D4ED8]"
          : "border-[#D8DEE8] text-[#98A2B3]"
      }`}
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-full border ${
          active ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#C7D1DF] bg-white"
        }`}
      >
        {number}
      </span>
      {label}
    </li>
  );
}

function PartnerTypeLink({
  active,
  partnerType,
  label
}: {
  active: boolean;
  partnerType: PartnerType;
  label: string;
}) {
  return (
    <Link
      href={`/customers/posp-misp/design-review?partner_type=${partnerType}`}
      aria-current={active ? "page" : undefined}
      className={`grid place-items-center rounded text-[11px] font-semibold transition ${
        active ? "bg-white text-[#1D4ED8] shadow-sm" : "text-[#667085] hover:text-[#172033]"
      }`}
    >
      {label}
    </Link>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
  last = false
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={`px-4 py-5 sm:px-5 ${last ? "" : "border-b border-[#D8DEE8]"}`}>
      <SectionHeading icon={icon} title={title} description={description} />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#C9D9F5] bg-[#EFF5FF] text-[#1D4ED8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-[13px] font-semibold text-[#172033]">{title}</h3>
        <p className="mt-0.5 text-[10.5px] leading-4 text-[#667085]">{description}</p>
      </div>
    </div>
  );
}

function InputField({
  label,
  name,
  required = false,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className={labelClass} htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </label>
      <input id={name} name={name} required={required} className={controlClass} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  required = false,
  options,
  placeholder,
  disabled = false,
  className = ""
}: {
  label: string;
  name: string;
  required?: boolean;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className={labelClass} htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        disabled={disabled}
        defaultValue=""
        className={`${controlClass} disabled:cursor-not-allowed disabled:bg-[#F1F4F8] disabled:text-[#7C8CA3]`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReviewDateField({
  label,
  name,
  required = false
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass} htmlFor={`${name}-date`}>
        {label}
        {required ? " *" : ""}
      </label>
      <IndianDateField name={name} required={required} inputClassName={`${controlClass} pr-9`} />
    </div>
  );
}

function PanField({
  label,
  name,
  onCheck
}: {
  label: string;
  name: string;
  onCheck: () => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass} htmlFor={name}>
        {label} *
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C8CA3]" />
          <input
            id={name}
            name={name}
            required
            maxLength={10}
            minLength={10}
            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
            className={`${controlClass} pl-9 font-mono uppercase`}
            placeholder="ABCDE1234F"
          />
        </div>
        <button
          type="button"
          onClick={onCheck}
          title="Check PAN"
          aria-label={`Check ${label}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#B9CCED] bg-[#EFF5FF] text-[#1D4ED8] transition hover:bg-[#E4EEFF]"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-[#E4E9F0] pb-2.5 last:border-b-0 last:pb-0">
      <dt className="text-[#667085]">{label}</dt>
      <dd className="break-words text-right font-medium text-[#172033]">{value}</dd>
    </div>
  );
}
