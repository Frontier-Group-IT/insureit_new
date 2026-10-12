import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { CustomerLoginForm } from "./customer-login-form";

export default function CustomerLoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#EFF5FB_0%,#F7FAFD_48%,#E8F1FA_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1080px] items-center justify-center">
        <div className="w-full max-w-[430px]">
          <section className="rounded-[26px] border border-[#D8E2EF] bg-white p-6 shadow-[0_24px_70px_rgba(17,38,70,0.12)] sm:p-8">
            <div className="mb-7 flex justify-center"><BrandLockup size="hero" /></div>
            <div className="mb-6 text-center">
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[#10213D]">Customer Login</h1>
              <p className="mt-2 text-sm leading-6 text-[#66758A]">Use the mobile number registered with your INSUREIT customer account.</p>
            </div>
            <CustomerLoginForm />
          </section>

          <Link
            href="/customer/signup"
            className="mt-4 flex items-center gap-3 rounded-[20px] border border-[#CFE0F4] bg-white/85 p-3.5 shadow-[0_14px_38px_rgba(17,38,70,0.08)] transition hover:border-[#AFC8E3] hover:bg-white"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F8F0] text-[#0F9F6E]">
              <UserRoundPlus className="h-5 w-5" />
            </div>
            <span className="min-w-0 flex-1 text-sm font-semibold text-[#40516A]">New customer? Create your customer account.</span>
            <span className="rounded-xl bg-[#54BEA0] px-4 py-2 text-xs font-bold text-white">SIGN UP</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
