import Link from "next/link";
import { LogIn, UserRoundPlus } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { CustomerSignupForm } from "./customer-signup-form";

export default function CustomerSignupPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#EFF5FB_0%,#F7FAFD_48%,#E8F1FA_100%)] px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1080px] items-center justify-center">
        <div className="w-full max-w-[520px]">
          <section className="rounded-[28px] border border-[#D8E2EF] bg-white p-5 shadow-[0_24px_70px_rgba(17,38,70,0.12)] sm:p-8">
            <div className="mb-6 flex justify-center"><BrandLockup size="hero" /></div>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7F7F0] text-[#0F9F6E]">
                <UserRoundPlus className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-[25px] font-semibold tracking-[-0.03em] text-[#10213D]">Create customer account</h1>
                <p className="mt-1 text-sm leading-5 text-[#66758A]">Create your INSUREIT login with your mobile number.</p>
              </div>
            </div>
            <CustomerSignupForm />
          </section>

          <Link
            href="/customer/login"
            className="mt-4 flex items-center gap-3 rounded-[22px] border border-[#CFE0F4] bg-white/85 p-3.5 shadow-[0_14px_38px_rgba(17,38,70,0.08)] transition hover:border-[#AFC8E3] hover:bg-white"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EDF5FF] text-[#176BB4]">
              <LogIn className="h-5 w-5" />
            </div>
            <span className="min-w-0 flex-1 text-sm font-semibold text-[#40516A]">Already registered? Login with your mobile number.</span>
            <span className="rounded-xl bg-[#142746] px-4 py-2 text-xs font-bold text-white">LOGIN</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
