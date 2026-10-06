import LoginForm from "./login-form";

export const metadata = {
  title: "Developer Sign In · InsureIT",
  robots: { index: false, follow: false }
};

export default function LoginPage() {
  return (
    <main className="developer-login-page">
      <section className="developer-login-card">
        <span className="eyebrow">INSUREIT / DEVELOPER IDENTITY</span>
        <h1>Developer sign in</h1>
        <p>Use your existing InsureIT portal account. Only an active protected <b>IT Super User</b> profile is authorized for the Developer Workspace application layer.</p>
        <LoginForm />
        <div className="login-security-note">
          <b>Current capability</b>
          <span>Read-only access is available to an active IT Super User. AAL2 unlocks append-only preview drafts only; production publish, release, database and infrastructure actions remain disabled.</span>
        </div>
      </section>
    </main>
  );
}
