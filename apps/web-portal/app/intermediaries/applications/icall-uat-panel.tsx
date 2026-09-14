export { IcallProductionPanel } from "./icall-production-panel";

type Props = {
  applicationId: string;
  partnerType: "posp" | "misp";
  loginId: string | null;
  trainingStatus: string | null;
  examStatus: string | null;
};

export function IcallUatPanel({ partnerType, loginId, trainingStatus, examStatus }: Props) {
  const accountLabel = partnerType.toUpperCase();
  return <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[8.5px] font-bold uppercase tracking-[.1em] text-amber-700">Legacy UAT diagnostics</p>
        <h3 className="mt-1 text-[12px] font-semibold text-[#0F172A]">iCall {accountLabel} UAT snapshot</h3>
        <p className="mt-1 max-w-2xl text-[9.5px] leading-5 text-[#526178]">UAT mutations are disabled during the Production cutover. This panel is read-only so an operator cannot accidentally create or modify a UAT training account while the live workflow uses Production.</p>
      </div>
      <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[8.5px] font-semibold text-amber-700">Read only</span>
    </div>

    {loginId ? <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <Fact label="Login ID" value={loginId} />
      <Fact label="Training status" value={trainingStatus || "Not synced"} />
      <Fact label="Exam status" value={examStatus || "Not allotted"} />
    </div> : <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-white/80 px-3 py-3 text-[9.5px] text-[#526178]">No UAT training snapshot is linked to this applicant.</div>}

    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9.5px] leading-4 text-amber-900">Use the normal POSP/MISP workflow to start Production training. UAT gateway routes remain available only for controlled rollback and diagnostics.</div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#DCE5EF] bg-white px-3 py-3"><p className="text-[8px] font-semibold uppercase tracking-[.06em] text-[#7A8798]">{label}</p><p className="mt-1 break-words text-[10px] font-semibold capitalize text-[#0F172A]">{value.replaceAll("_", " ")}</p></div>;
}
