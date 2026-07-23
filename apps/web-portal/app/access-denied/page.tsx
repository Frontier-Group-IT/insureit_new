import { AccessDeniedActions } from "@/components/access-denied-actions";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-700">!</div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-red-700">Access denied</p>
        <h1 className="mt-3 text-3xl font-bold text-navy-900">Admin portal access is restricted</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account is not currently authorized for the InsureIt admin portal. Contact an administrator to review your access permissions.
        </p>
        <AccessDeniedActions />
      </section>
    </main>
  );
}
