import { Suspense } from "react";
import { AuthPortalShell } from "@/components/auth-portal-shell";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthPortalShell
      title="Sign in to your workspace"
      subtitle="Secure access to claims, customers, policies and operations."
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in...</p>}>
        <LoginForm />
      </Suspense>
    </AuthPortalShell>
  );
}
