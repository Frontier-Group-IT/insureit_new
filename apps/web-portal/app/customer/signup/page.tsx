import Link from "next/link";
import { FileText, Headphones, LockKeyhole, ShieldCheck, Star, LogIn } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { CustomerSignupForm } from "./customer-signup-form";

/** Signup presentation matches the existing Customer Login page; authentication logic remains in CustomerSignupForm. */
export default function CustomerSignupPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#071D3C]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_64%,rgba(45,154,222,0.36),transparent_45%),linear-gradient(118deg,#061B3E_0%,#0C3867_48%,#DBEBFA_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(129deg,transparent_35%,rgba(61,189,246,0.25)_35.1%,rgba(61,189,246,0.05)_47%,transparent_47.1%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1800px] lg:grid-cols-[minmax(0,1.08fr)_minmax(470px,0.92fr)]">
        <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden px-6 pb-8 pt-8 text-white sm:px-10 lg:min-h-screen lg:px-12 lg:pb-12 lg:pt-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,20,47,0.68),rgba(5,29,61,0.13))]" />
          <div className="relative z-10">
            <BrandLockup inverse size="default" />
            <div className="mt-12 max-w-[620px] lg:mt-20">
              <p className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.32em] text-blue-100 sm:text-xs">
                Driving a safer tomorrow <span aria-hidden="true" className="h-px w-12 bg-cyan-300" />
              </p>
              <h1 className="mt-5 text-[clamp(2.2rem,4vw,4.1rem)] font-extrabold leading-[1.06] tracking-[-0.045em]">
                Your Vehicles.<br />Our Protection.<br /><span className="text-[#53DAF5]">A Safer Tomorrow.</span>
              </h1>
              <p className="mt-5 max-w-[480px] text-sm leading-7 text-[#D5E3F2] sm:text-lg">
                Comprehensive insurance solutions for your business. Manage policies, handle claims, and keep your fleet moving — all with INSUREIT.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-10 grid max-w-[680px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mt-16">
            {[
              { label: "Vehicle Protection", description: "Coverage for what keeps you moving", icon: ShieldCheck, color: "bg-blue-600" },
              { label: "Policy Management", description: "All your policies in one place", icon: FileText, color: "bg-teal-600" },
              { label: "Claims Support", description: "Reliable assistance when you need it", icon: Headphones, color: "bg-indigo-600" },
            ].map(({ label, description, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-white/20 bg-[#113A6A]/45 p-3 shadow-lg backdrop-blur-lg sm:p-4">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${color}`}><Icon aria-hidden="true" className="h-5 w-5" /></div>
                <h2 className="text-xs font-bold sm:text-sm">{label}</h2>
                <p className="mt-1 text-[11px] leading-5 text-[#DBE7F6]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative flex flex-col items-center justify-center bg-[linear-gradient(145deg,rgba(218,235,250,0.62),rgba(246,250,255,0.98))] px-4 py-10 sm:px-7 lg:min-h-screen lg:bg-[linear-gradient(120deg,rgba(228,240,253,0.35),#EFF7FF_85%)]">
          <div className="w-full max-w-[520px] rounded-[26px] border border-[#E0E9F4] bg-white px-5 py-8 shadow-[0_30px_90px_rgba(8,31,65,0.16)] sm:px-10 sm:py-10">
            <div className="flex justify-center"><BrandLockup size="default" /></div>
            <div className="mt-6"><CustomerSignupForm /></div>
            <div className="mt-6 flex items-center gap-4 text-xs font-semibold text-[#8B9DB4]">
              <span className="h-px flex-1 bg-[#DCE5F0]" /><span>OR</span><span className="h-px flex-1 bg-[#DCE5F0]" />
            </div>
            <Link href="/customer/login" className="mt-5 flex items-center gap-3 rounded-2xl bg-[#EAF3FF] p-3.5 transition hover:bg-[#DAEAFE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245A9A]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9EAFE] text-[#1554A3]"><LogIn aria-hidden="true" className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#102747]">Already registered?</span><span className="block text-xs text-[#61758D]">Login with your mobile number.</span></span>
              <span className="shrink-0 rounded-xl bg-[#133F78] px-4 py-3 text-xs font-extrabold text-white">Login →</span>
            </Link>
          </div>
          <div className="mt-7 flex w-full max-w-[540px] flex-wrap justify-center gap-4 text-[10px] font-medium text-[#3C577A] sm:gap-7">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Protected access</span>
            <span className="inline-flex items-center gap-1.5"><Star className="h-5 w-5" aria-hidden="true" /> Secure authentication</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-5 w-5" aria-hidden="true" /> Privacy focused</span>
          </div>
        </section>
      </div>
    </main>
  );
}
