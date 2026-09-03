"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, Loader2, ShieldCheck } from "lucide-react";
import {
  getPartnerPolicyIntakeSourcesWeb,
  POLICY_INTAKE_ACCEPT,
  submitPartnerPolicyIntakeWeb,
  validatePolicyIntakeFile,
  type IntakeProgress,
  type PartnerPolicyIntakeSource,
} from "@/lib/partner-policy-intakes-client";

export function PartnerPolicyIntakeNewClient() {
  const router = useRouter();
  const [sources, setSources] = useState<PartnerPolicyIntakeSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [mobile, setMobile] = useState("");
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
    return () => { active = false; };
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
      router.replace("/partner/policy-intakes/" + encodeURIComponent(result.id) + "?submitted=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intake could not be submitted.");
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        disabled={submitting}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] disabled:opacity-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">New Policy Intake</p>
        <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">Send policy to Operations</h2>
        <p className="mt-1 text-[11px] font-medium text-[#74839A]">Review the lead source and customer mobile, attach the policy copy, then submit it into the same Operations intake queue as the Partner app.</p>

        {error ? <div className="mt-4 rounded-2xl border border-[#F0D0D0] bg-[#FFF7F7] px-4 py-3 text-[10.5px] font-semibold text-[#9E3939]">{error}</div> : null}

        {loading ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#F8FAFD] px-4 py-5 text-[10.5px] font-semibold text-[#526680]">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing authorized lead sources…
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#72809A]">Lead Source</label>
                {sources.length > 1 ? (
                  <div className="mt-2 space-y-2">
                    {sources.map((source) => {
                      const active = source.id === sourceId;
                      return (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => setSourceId(source.id)}
                          className={"flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left " + (active ? "border-[#3156B8] bg-[#EEF4FF]" : "border-[#DCE3EC] bg-white")}
                        >
                          <span>
                            <span className="block text-[11px] font-extrabold text-[#1B2F4E]">{source.display_name}</span>
                            <span className="mt-0.5 block text-[9.5px] text-[#74839A]">{source.intermediary_type.toUpperCase()}{source.intermediary_code ? " · " + source.intermediary_code : ""}</span>
                          </span>
                          {active ? <ShieldCheck className="h-4 w-4 text-[#3156B8]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 rounded-2xl border border-[#DCE3EC] bg-[#F8FAFD] px-4 py-3">
                    <p className="text-[11px] font-extrabold text-[#1B2F4E]">{selectedSource?.display_name || "No active lead source available"}</p>
                    {selectedSource ? <p className="mt-0.5 text-[9.5px] text-[#74839A]">{selectedSource.intermediary_type.toUpperCase()}{selectedSource.intermediary_code ? " · " + selectedSource.intermediary_code : ""}</p> : null}
                  </div>
                )}
              </div>

              <label className="grid gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#72809A]">Customer Mobile</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10 digit mobile number"
                  className="h-11 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[11px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]"
                />
                {mobile && !validMobile ? <span className="text-[9px] font-semibold text-[#B54A4A]">Enter a valid Indian mobile number.</span> : null}
              </label>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#72809A]">Policy Copy</p>
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
                className="mt-2 flex min-h-[180px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed border-[#BFCBDD] bg-[#F8FAFD] px-5 text-center transition hover:border-[#3156B8] hover:bg-[#F4F7FF] disabled:opacity-50"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#3156B8] shadow-sm"><FileUp className="h-5 w-5" /></span>
                <span className="mt-3 text-[11px] font-extrabold text-[#1B2F4E]">{file ? file.name : "Choose policy PDF or image"}</span>
                <span className="mt-1 text-[9.5px] font-medium text-[#74839A]">{file ? Math.max(1, Math.round(file.size / 1024)) + " KB selected" : "PDF, JPG, PNG or WebP · maximum 15 MB"}</span>
              </button>

              {progress ? <UploadProgress progress={progress} /> : null}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#E6ECF3] pt-4">
          <button type="button" onClick={() => router.back()} disabled={submitting} className="h-10 rounded-xl border border-[#D2DCE9] bg-white px-4 text-[10.5px] font-bold text-[#203653] disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#111A35] px-5 text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {submitting ? "Submitting…" : "Submit to Operations"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UploadProgress({ progress }: { progress: IntakeProgress }) {
  const percent = progress.stage === "preparing" ? 8 : progress.stage === "submitting" ? 96 : Math.max(12, Math.min(92, progress.percent ?? 12));
  const label = progress.stage === "preparing" ? "Preparing secure upload" : progress.stage === "submitting" ? "Sending to Operations" : "Uploading policy copy";
  return (
    <div className="mt-3 rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3">
      <div className="flex items-center justify-between text-[9.5px] font-semibold text-[#526680]"><span>{label}</span><span>{Math.round(percent)}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1F6]"><div className="h-full rounded-full bg-[#3156B8]" style={{ width: String(percent) + "%" }} /></div>
    </div>
  );
}
