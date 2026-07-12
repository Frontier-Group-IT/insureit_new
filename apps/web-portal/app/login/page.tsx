import { Suspense } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F9FF] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D8EBFF]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-96 rotate-[-12deg] rounded-[45%] bg-[#DDF6EC]" />

      <div className="relative w-full max-w-[470px] rounded-[28px] border border-[#D7E6F5] bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(11,55,105,0.14)] backdrop-blur sm:px-9 sm:py-9">
        <div className="mb-8 flex justify-center">
          <BrandLockup size="hero" className="max-w-full" />
        </div>

        <div className="mb-6 border-t border-[#E3ECF6] pt-6 text-center">
          <h1 className="text-[24px] font-extrabold tracking-[-0.025em] text-[#071D49]">Sign in to your workspace</h1>
          <p className="mt-1.5 text-[12px] font-medium text-[#59687A]">Secure access to claims, customers, policies and operations.</p>
        </div>

        <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
