type Props = {
  message: string;
};

export function ClaimStageSuccessPopup({ message }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center px-4" role="presentation">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white px-5 py-5 text-center shadow-[0_18px_50px_rgba(7,29,73,0.22)]"
      >
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[2.4]">
            <path d="m6 12 4 4 8-9" />
          </svg>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-[#071D49]">{message}</p>
      </div>
    </div>
  );
}
