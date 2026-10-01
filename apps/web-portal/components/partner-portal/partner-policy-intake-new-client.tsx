"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CircleCheck,
  CloudUpload,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  getPartnerPolicyIntakeSourcesWeb,
  linkExternalRenewalPolicyIntakeWeb,
  POLICY_INTAKE_ACCEPT,
  submitPartnerPolicyIntakeWeb,
  validatePolicyIntakeFile,
  type IntakeProgress,
  type PartnerPolicyIntakeSource,
} from "@/lib/partner-policy-intakes-client";

type ExternalRenewalPrefill = {
  opportunityId: string;
  mobile: string;
  customerLabel: string;
  vehicleLabel: string;
  policyLabel: string;
};

export function PartnerPolicyIntakeNewClient({ externalRenewal }: { externalRenewal?: ExternalRenewalPrefill | null }) {
  const router = useRouter();
  const [sources, setSources] = useState<PartnerPolicyIntakeSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [mobile, setMobile] = useState(externalRenewal?.mobile ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<IntakeProgress | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await getPartnerPolicyIntakeSourcesWeb();
        if (!active) return;
        setSources(result.sources);
        if (result.sources.length === 1) setSourceId(result.sources[0].id);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Lead sources could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const selectedSource = useMemo(() => sources.find((source) => source.id === sourceId) ?? null, [sourceId, sources]);
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const validMobile = /^[6-9][0-9]{9}$/.test(cleanMobile);
  const canSubmit = Boolean(file && sourceId && validMobile && !submitting);

  function chooseFile(nextFile?: File) {
    setError("");
    if (!nextFile) return;
    const fileError = validatePolicyIntakeFile(nextFile);
    if (fileError) {
      setFile(null);
      setError(fileError);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(nextFile);
  }

  async function submit() {
    if (!file || !canSubmit) return;
    setSubmitting(true);
    setProgress({ stage: "preparing" });
    setError("");
    try {
      const result = await submitPartnerPolicyIntakeWeb({
        leadSourceId: sourceId,
        customerMobile: cleanMobile,
        file,
        onProgress: setProgress,
      });
      if (externalRenewal) {
        await linkExternalRenewalPolicyIntakeWeb({ opportunityId: externalRenewal.opportunityId, intakeId: result.id });
      }
      const suffix = externalRenewal ? "?submitted=1&external_renewal=1" : "?submitted=1";
      router.replace("/partner/policy-intakes/" + encodeURIComponent(result.id) + suffix);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intake could not be submitted.");
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-175px)] items-start justify-center px-2 pb-10 pt-3 sm:px-4 sm:pt-5">
      <section className="w-full max-w-[650px] overflow-hidden rounded-[28px] border border-[#D8E2EE] bg-white shadow-[0_26px_70px_rgba(28,45,82,0.13)]">
        <div className="bg-gradient-to-r from-[#0D2A60] via-[#143B73] to-[#235B8B] px-6 py-5 text-white sm:px-7 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white/10 ring-1 ring-inset ring-white/10">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.1} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-extrabold tracking-[-0.02em] text-white sm:text-[19px]">New Policy Intake</h1>
              <p className="mt-1 text-[10.5px] font-medium text-white/86 sm:text-[11px]">Three details. Operations completes the onboarding.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7 sm:py-7">
          {externalRenewal ? (
            <div className="mb-5 rounded-[16px] border border-[#DCE5F0] bg-[#F7FAFD] px-4 py-3.5">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#2C5B8D]">External renewal opportunity</p>
              <p className="mt-1 text-[11px] font-extrabold text-[#183354]">{externalRenewal.customerLabel}</p>
              <p className="mt-1 break-words text-[9.5px] leading-5 text-[#6C7F96]">{externalRenewal.vehicleLabel} · {externalRenewal.policyLabel}</p>
            </div>
          ) : null}

          {error ? (
            <div className="mb-5 rounded-[14px] border border-[#F0D0D0] bg-[#FFF7F7] px-4 py-3 text-[10.5px] font-semibold text-[#9E3939]">{error}</div>
          ) : null}

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-[#526883]">
                <Search className="h-3.5 w-3.5" /> Lead Source
              </span>
              <span className="relative block">
                <select
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  disabled={loading || submitting || sources.length === 0}
                  className="h-[54px] w-full appearance-none rounded-[17px] border border-[#D3DDEA] bg-white px-4 pr-11 text-[11.5px] font-semibold text-[#1D3B61] outline-none transition focus:border-[#5A7AC7] focus:ring-2 focus:ring-[#5A7AC7]/10 disabled:cursor-not-allowed disabled:bg-[#FAFBFD] disabled:text-[#94A1B2]"
                >
                  <option value="">{loading ? "Loading assigned sources…" : "Select assigned Partner / POSP / MISP"}</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.display_name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#173B68]" />
              </span>
              {selectedSource?.intermediary_code ? (
                <span className="mt-1.5 block px-1 text-[9px] font-semibold text-[#8290A3]">{selectedSource.intermediary_type.toUpperCase()} · {selectedSource.intermediary_code}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-[9.5px] font-black uppercase tracking-[0.1em] text-[#526883]">Customer Mobile</span>
              <input
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10 digit mobile number"
                disabled={submitting}
                className="h-[54px] w-full rounded-[17px] border border-[#D3DDEA] bg-white px-4 text-[12px] font-semibold text-[#1D3B61] outline-none transition placeholder:text-[#A4AFBF] focus:border-[#5A7AC7] focus:ring-2 focus:ring-[#5A7AC7]/10 disabled:opacity-60"
              />
              {mobile && !validMobile ? <span className="mt-1.5 block px-1 text-[9px] font-semibold text-[#B54A4A]">Enter a valid Indian mobile number.</span> : null}
            </label>

            <div>
              <p className="mb-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-[#526883]">Policy Copy</p>
              <input
                ref={fileRef}
                type="file"
                accept={POLICY_INTAKE_ACCEPT}
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={submitting}
                className="flex min-h-[144px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed border-[#AFC2D9] bg-[#F8FBFD] px-5 text-center transition hover:border-[#3E6D9F] hover:bg-[#F5F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5A7AC7]/15 disabled:opacity-60"
              >
                <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#E9F7F5] text-[#13958B]">
                  <CloudUpload className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="mt-3 max-w-full truncate text-[11.5px] font-extrabold text-[#1B3C64]">{file ? file.name : "Upload policy PDF or image"}</span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[9.5px] font-medium text-[#7E8CA0]">
                  <FileText className="h-3.5 w-3.5" />
                  {file ? Math.max(1, Math.round(file.size / 1024)) + " KB selected" : "Camera or file · max 15 MB"}
                </span>
              </button>

              {progress ? <UploadProgress progress={progress} /> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="mt-5 inline-flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-[#173B68] px-5 text-[11.5px] font-extrabold text-white transition hover:bg-[#12335D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {submitting ? "Submitting…" : "Submit Policy Intake"}
          </button>

          <div className="mt-4 flex gap-3 rounded-[16px] bg-[#F5F8FC] px-4 py-3.5 text-[#7A8799]">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0AA47F]" />
            <p className="text-[9.5px] font-medium leading-5">Your policy copy and sales details are saved first. The request is accepted immediately while policy and vehicle details are fetched in the background.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function UploadProgress({ progress }: { progress: IntakeProgress }) {
  const percent = progress.stage === "preparing" ? 8 : progress.stage === "submitting" ? 96 : Math.max(12, Math.min(92, progress.percent ?? 12));
  const label = progress.stage === "preparing" ? "Preparing secure upload" : progress.stage === "submitting" ? "Sending to Operations" : "Uploading policy copy";
  return (
    <div className="mt-3 rounded-[14px] border border-[#E0E7EF] bg-white px-3.5 py-3">
      <div className="flex items-center justify-between text-[9.5px] font-semibold text-[#526680]"><span>{label}</span><span>{Math.round(percent)}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1F6]"><div className="h-full rounded-full bg-[#3156B8]" style={{ width: String(percent) + "%" }} /></div>
    </div>
  );
}
