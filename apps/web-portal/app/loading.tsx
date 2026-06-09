export default function Loading() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-slate-100/20 backdrop-blur-[1px]" aria-live="polite" aria-busy="true">
      <div className="absolute inset-x-0 top-4 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-semibold text-navy-900 shadow-lg backdrop-blur">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700" aria-hidden="true" />
          Loading
        </div>
      </div>
    </div>
  );
}
