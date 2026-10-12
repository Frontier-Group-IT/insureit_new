import Link from "next/link";
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
            className="mt-4 flex min-h-16 items-center justify-between gap-4 rounded-[22px] border border-[#CFE0F3] bg-white/90 px-5 py-4 text-[#203653] shadow-[0_12px_35px_rgba(17,38,70,0.10)] transition hover:border-[#AFC9E8] hover:bg-white"
          >
            <span className="text-sm font-semibold">New customer? Create your INSUREIT account.</span>
            <span className="rounded-xl bg-[#55BFA0] px-4 py-2 text-xs font-bold text-white">SIGN UP</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
