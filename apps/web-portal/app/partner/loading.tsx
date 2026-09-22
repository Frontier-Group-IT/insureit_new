export default function PartnerLoading() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#10213D]" aria-busy="true" aria-live="polite">
      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-[#BFCDE0]/65 bg-[linear-gradient(90deg,#C7D8EC_0%,#D6E3F2_48%,#E8EEF6_100%)]">
          <div className="flex min-h-[66px] items-center justify-between gap-3 px-3 py-2 sm:px-4 lg:px-6">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[#9FB3CA]/45" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/75" />
          </div>
        </header>
        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:px-7 lg:py-6">
          <div className="mx-auto w-full max-w-[1480px]">
            <span className="sr-only">Loading Partner workspace</span>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="h-6 w-44 animate-pulse rounded-lg bg-[#DCE5EF]" />
              <div className="h-9 w-28 animate-pulse rounded-xl bg-[#E4EAF2]" />
            </div>
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-[94px] animate-pulse rounded-xl border border-[#E0E7F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
                  <div className="flex h-full items-center gap-3 px-4">
                    <div className="h-9 w-9 rounded-full bg-[#E6ECF4]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 w-20 rounded-full bg-[#DCE5EF]" />
                      <div className="h-5 w-24 rounded-full bg-[#E5EBF2]" />
                      <div className="h-2 w-28 rounded-full bg-[#EEF2F6]" />
                    </div>
                  </div>
                </div>
              ))}
            </section>
            <section className="mt-3 grid gap-3 xl:grid-cols-[1.55fr_.75fr]">
              <div className="h-[245px] animate-pulse rounded-xl border border-[#E0E7F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.04)]" />
              <div className="h-[245px] animate-pulse rounded-xl border border-[#E0E7F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.04)]" />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
