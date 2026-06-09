export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 via-navy-700 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-success">ClaimBridge CV</p>
          <h1 className="mt-3 text-3xl font-bold text-navy-900">Admin sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Access the secure claim assistance operations portal.</p>
        </div>
        <form className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="admin@claimbridge.example" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" />
          </div>
          <button className="w-full rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-900" type="button">
            Sign in with Supabase Auth
          </button>
        </form>
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Frontend uses only the Supabase anon key. Service role credentials remain server-side only.</p>
      </div>
    </main>
  );
}
