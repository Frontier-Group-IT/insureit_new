import { FormSubmitButton } from "@/components/form-submit-button";
import { registerWithIcallProduction, syncIcallProductionStatus } from "./icall-training-actions";

type Props = {
  applicationId: string;
  partnerType: "posp" | "misp";
  loginId: string | null;
  trainingStatus: string | null;
  examStatus: string | null;
};

export function IcallProductionPanel({ applicationId, partnerType, loginId, trainingStatus, examStatus }: Props) {
  const accountLabel = partnerType.toUpperCase();
  return <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[8.5px] font-bold uppercase tracking-[.1em] text-blue-700">Production training integration</p>
        <h3 className="mt-1 text-[12px] font-semibold text-[#0F172A]">iCall {accountLabel} Training &amp; Examination</h3>
        <p className="mt-1 max-w-2xl text-[9.5px] leading-5 text-[#526178]">Start the real iCall production training from INSUREIT, then keep training and examination progress synchronized here.</p>
      </div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[8.5px] font-semibold text-emerald-700">Production</span>
    </div>

    {loginId ? <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <Fact label="Login ID" value={loginId} />
      <Fact label="Training status" value={trainingStatus || "Not synced"} />
      <Fact label="Exam status" value={examStatus || "Not allotted"} />
    </div> : <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white/80 px-3 py-3 text-[9.5px] text-[#526178]">Production training has not been started for this applicant yet.</div>}

    <div className="mt-4 flex flex-wrap gap-2">
      {!loginId ? <form action={registerWithIcallProduction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <FormSubmitButton label="Start Production Training" pendingLabel="Starting" className="h-10 rounded-xl bg-[#0F2A55] px-4 text-[10px] font-semibold text-white" />
      </form> : null}
      {loginId ? <form action={syncIcallProductionStatus}>
        <input type="hidden" name="application_id" value={applicationId} />
        <FormSubmitButton label="Sync iCall status" pendingLabel="Syncing" className="h-10 rounded-xl border border-blue-200 bg-white px-4 text-[10px] font-semibold text-blue-800" />
      </form> : null}
    </div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#DCE5EF] bg-white px-3 py-3"><p className="text-[8px] font-semibold uppercase tracking-[.06em] text-[#7A8798]">{label}</p><p className="mt-1 break-words text-[10px] font-semibold capitalize text-[#0F172A]">{value.replaceAll("_", " ")}</p></div>;
}
