"use client";

import { useEffect, useRef, useState } from "react";

const consumePath = "/api/partner/policy-intakes/bridge/consume";
const continuePath = "/api/partner/policy-intakes/bridge/continue";

export default function PartnerPolicyIntakeBridgePage() {
  const started = useRef(false);
  const [message, setMessage] = useState("Securing your Operations session…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    // Fragment never reaches the server, referrer or navigation history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
      setMessage("This onboarding link is invalid. Open the intake again from the Partner App.");
      setFailed(true);
      return;
    }
    void (async () => {
      try {
        const consume = await fetch(consumePath, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const authenticated = await consume.json() as { ok?: boolean; error?: string };
        if (!consume.ok || !authenticated.ok) throw new Error(authenticated.error || "The handoff has expired.");
        setMessage("Opening your saved Policy Onboarding draft…");
        const handoff = await fetch(continuePath, {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" }, body: "{}",
        });
        const result = await handoff.json() as { ok?: boolean; path?: string; error?: string };
        if (!handoff.ok || !result.ok || !result.path ||
            !/^\/policies\/new(?:\/non-motor)?\?intake_id=[0-9a-f-]{36}$/i.test(result.path)) {
          throw new Error(result.error || "Policy Onboarding could not be prepared.");
        }
        window.location.replace(result.path);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Secure onboarding handoff failed.");
        setFailed(true);
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F7FC] px-4">
      <meta name="referrer" content="no-referrer" />
      <div className="w-full max-w-md rounded-2xl border border-[#DBE5F0] bg-white p-7 text-center shadow-lg">
        <h1 className="text-lg font-bold text-[#17365D]">INSUREIT Policy Onboarding</h1>
        <p role={failed ? "alert" : "status"} className="mt-4 text-sm leading-6 text-[#52637B]">{message}</p>
        {failed ? <p className="mt-4 text-xs text-[#667085]">No reviewer change was confirmed by this page. Return to the Partner App to retry securely.</p> : null}
      </div>
    </main>
  );
}
