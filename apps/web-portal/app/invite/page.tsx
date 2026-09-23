import { Suspense } from "react";
import { AuthPortalShell } from "@/components/auth-portal-shell";
import { InviteSetupForm } from "@/components/invite-setup-form";

type InviteSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InvitePage({ searchParams }: { searchParams: InviteSearchParams }) {
  const params = await searchParams;
  const inviteError = firstValue(params.error_description) ?? firstValue(params.error);

  return (
    <AuthPortalShell
      title="Activate portal access"
      subtitle="Set your password to open the InsureIT operations workspace."
    >
      {inviteError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">This invitation link cannot be used.</p>
          <p className="mt-1 text-[12px] leading-5">{inviteError}</p>
          <a className="mt-4 inline-flex rounded-xl bg-[#071D49] px-4 py-2 text-[12px] font-semibold text-white" href="/login">
            Go to sign in
          </a>
        </div>
      ) : (
        <Suspense fallback={<p className="text-sm text-slate-500">Opening invitation...</p>}>
          <InviteSetupForm />
        </Suspense>
      )}
    </AuthPortalShell>
  );
}
