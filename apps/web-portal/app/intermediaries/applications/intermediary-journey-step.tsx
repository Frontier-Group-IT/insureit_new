type IntermediaryJourneyStepProps = {
  label: string;
  completed: boolean;
  active: boolean;
  index: number;
};

export function IntermediaryJourneyStep({ label, completed, active, index }: IntermediaryJourneyStepProps) {
  return (
    <span className="relative z-[1] inline-flex min-w-0 items-center justify-center gap-1.5 px-2">
      <span className={`whitespace-nowrap text-[11px] font-semibold ${completed ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</span>
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[8px] font-bold leading-none transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-transparent text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span>
    </span>
  );
}
