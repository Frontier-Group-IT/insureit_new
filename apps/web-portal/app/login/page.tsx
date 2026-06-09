import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 via-navy-700 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-success">InsureIt</p>
          <h1 className="mt-3 text-3xl font-bold text-navy-900">Sign in to InsureIt</h1>
        </div>
        <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
