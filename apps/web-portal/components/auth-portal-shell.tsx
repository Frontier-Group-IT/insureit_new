import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand-lockup";

export function AuthPortalShell({ title, subtitle, eyebrow, icon, children }: { title: string; subtitle: string; eyebrow?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F9FF] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D8EBFF]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-96 rotate-[-12deg] rounded-[45%] bg-[#DDF6EC]" />
      <section className="relative w-full max-w-[470px] rounded-[28px] border border-[#D7E6F5] bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(11,55,105,0.14)] backdrop-blur sm:px-9 sm:py-9">
        <div className="mb-8 flex justify-center"><BrandLockup size="hero" className="max-w-full" /></div>
        <div className="border-t border-[#E3ECF6] pt-6 text-center">
          {icon ? <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF4FF] text-[#071D49]">{icon}</span> : null}
          {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{eyebrow}</p> : null}
          <h1 className={eyebrow ? "mt-2 text-[24px] font-extrabold tracking-[-0.025em] text-[#071D49]" : "text-[24px] font-extrabold tracking-[-0.025em] text-[#071D49]"}>{title}</h1>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#59687A]">{subtitle}</p>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
