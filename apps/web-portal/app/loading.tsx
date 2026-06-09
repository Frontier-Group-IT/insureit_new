export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4" aria-live="polite" aria-busy="true">
      <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-700 text-sm font-black text-white">II</div>
        <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-700" />
        <h1 className="mt-5 text-lg font-semibold text-navy-900">Loading InsureIt</h1>
        <p className="mt-2 text-sm text-slate-500">Preparing your workspace...</p>
      </section>
    </main>
  );
}
