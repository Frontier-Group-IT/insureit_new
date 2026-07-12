import { InsureItLoader } from "@/components/loading/insureit-loader";

export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#071D49]/12 px-4 backdrop-blur-[1.5px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="rounded-xl border border-white/80 bg-white/88 px-5 py-3 shadow-[0_16px_45px_rgba(7,29,73,0.18)] backdrop-blur-md">
        <InsureItLoader label="Loading workspace" compact />
      </div>
    </div>
  );
}
