import LoginForm from "./login-form";

export const metadata = {
  title: "Developer Sign In · InsureIT",
  robots: { index: false, follow: false }
};

const APP_ICON = "https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/apps/mobile-app/assets/brand/insureit-app-icon-ice.png";

export default function LoginPage() {
  return (
    <main className="developer-login-page refined-login-page">
      <section className="developer-login-card refined-login-card">
        <div className="login-brand">
          <img src={APP_ICON} alt="" />
          <div><strong>InsureIT</strong><span>Developer Workspace</span></div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">PROTECTED ENGINEERING ACCESS</span>
          <h1>Developer sign in</h1>
          <p>Use your existing InsureIT portal identity. Access is restricted to an active protected <b>IT Super User</b>, with AAL2 required for configuration preview drafts.</p>
        </div>

        <LoginForm />

        <div className="login-security-note refined-security-note">
          <div className="security-note-icon">✓</div>
          <div>
            <b>Production remains guarded</b>
            <span>AAL2 unlocks append-only preview drafts only. Production publishing, releases, database mutations and infrastructure actions remain disabled.</span>
          </div>
        </div>
      </section>

      <aside className="login-context-panel">
        <span className="eyebrow">CONTROL PLANE</span>
        <h2>One place to operate InsureIT safely.</h2>
        <p>Observe infrastructure, manage guarded configuration previews, review releases, and progressively automate engineering operations without exposing raw provider credentials.</p>
        <div className="login-context-list">
          <div><i /> Existing InsureIT identity</div>
          <div><i /> MFA-backed sensitive actions</div>
          <div><i /> Append-only audit evidence</div>
          <div><i /> Production deny-by-default</div>
        </div>
        <small>dev.insureit.tech</small>
      </aside>
    </main>
  );
}
