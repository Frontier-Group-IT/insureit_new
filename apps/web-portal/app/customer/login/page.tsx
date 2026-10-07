import { BrandLockup } from "@/components/brand-lockup";
import { CustomerLoginForm } from "./customer-login-form";

export default function CustomerLoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#EFF5FB_0%,#F7FAFD_48%,#E8F1FA_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1080px] items-center justify-center">
        <section className="w-full max-w-[430px] rounded-[26px] border border-[#D8E2EF] bg-white p-6 shadow-[0_24px_70px_rgba(17,38,70,0.12)] sm:p-8">
          <div className="mb-7 flex justify-center"><BrandLockup size="hero" /></div>
          <div className="mb-6 text-center">
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[#10213D]">Customer Login</h1>
            <p className="mt-2 text-sm leading-6 text-[#66758A]">Use the mobile number registered with your INSUREIT customer account.</p>
          </div>
          <CustomerLoginForm />
        </section>
      </div>
    </main>
  );
}
