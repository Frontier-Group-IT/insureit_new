import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { CustomerSignupForm } from "./customer-signup-form";

export default function CustomerSignupPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#EFF5FB_0%,#F7FAFD_48%,#E8F1FA_100%)] px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1080px] items-center justify-center">
        <div className="w-full max-w-[520px]">
          <section className="rounded-[28px] border border-[#D8E2EF] bg-white p-6 shadow-[0_24px_70px_rgba(17,38,70,0.12)] sm:p-8">
            <div className="mb-6 flex justify-center"><BrandLockup size="hero" /></div>
            <CustomerSignupForm />
          </section>

          <Link
            href="/customer/login"
            className="mt-4 flex min-h-16 items-center justify-between gap-4 rounded-[22px] border border-[#CFE0F3] bg-white/90 px-5 py-4 text-[#203653] shadow-[0_12px_35px_rgba(17,38,70,0.10)] transition hover:border-[#AFC9E8] hover:bg-white"
          >
            <span className="text-sm font-semibold">Already registered? Login with your mobile number.</span>
            <span className="rounded-xl bg-[#0B2B5B] px-4 py-2 text-xs font-bold text-white">LOGIN</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
