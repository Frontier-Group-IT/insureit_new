import { InsureItLoader } from "@/components/loading/insureit-loader";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[#101828]/12 px-4 backdrop-blur-[1.5px]" aria-live="polite" aria-busy="true">
      <div className="rounded-2xl border border-white/70 bg-white/82 px-5 py-4 shadow-[0_18px_60px_rgba(16,24,40,0.18)] backdrop-blur-md">
        <InsureItLoader label="Moving to the next workspace" compact />
      </div>
    </div>
  );
}
