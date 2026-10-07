"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      app: () => FirebaseCompatApp;
      initializeApp: (config: FirebaseCompatConfig) => FirebaseCompatApp;
      auth: FirebaseCompatAuthFactory;
    };
  }
}

type FirebaseCompatConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
};

type FirebaseCompatUser = {
  uid: string;
  phoneNumber?: string | null;
};

type FirebaseConfirmationResult = {
  confirm: (code: string) => Promise<{ user: FirebaseCompatUser }>;
};

type FirebaseRecaptchaVerifier = {
  clear: () => void;
  render: () => Promise<number>;
};

type FirebaseCompatAuth = {
  signInWithPhoneNumber: (
    phoneNumber: string,
    verifier: FirebaseRecaptchaVerifier,
  ) => Promise<FirebaseConfirmationResult>;
};

type FirebaseCompatApp = {
  auth: () => FirebaseCompatAuth;
};

type FirebaseCompatAuthFactory = {
  RecaptchaVerifier: new (
    container: string,
    parameters?: Record<string, unknown>,
  ) => FirebaseRecaptchaVerifier;
};

const firebaseAppScript = "/firebase-otp-test/sdk/firebase-app-compat.js";
const firebaseAuthScript = "/firebase-otp-test/sdk/firebase-auth-compat.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadFirebaseSdk() {
  await loadScript(firebaseAppScript);
  await loadScript(firebaseAuthScript);
  if (!window.firebase) throw new Error("Firebase SDK did not initialize.");
  return window.firebase;
}

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const tenDigits = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (tenDigits.length !== 10) return null;
  return `+91${tenDigits}`;
}

function friendlyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? "";
  const combined = `${code} ${raw}`.toLowerCase();

  if (combined.includes("could not load /firebase-otp-test/sdk/")) return "The local Firebase SDK proxy could not load. Refresh once; if it persists, the tester deployment cannot reach Google Firebase assets.";
  if (combined.includes("invalid-api-key")) return "Firebase rejected the API key. Copy the Web API key from Project settings → General → Your apps.";
  if (combined.includes("unauthorized-domain")) return "This tester domain is not authorized in Firebase Authentication → Settings → Authorized domains.";
  if (combined.includes("operation-not-allowed")) return "Phone sign-in is not enabled in Firebase Authentication.";
  if (combined.includes("billing-not-enabled")) return "Firebase Phone Auth needs billing enabled for real SMS delivery.";
  if (combined.includes("too-many-requests") || combined.includes("quota")) return "Firebase rate-limited this request. Wait before trying again.";
  if (combined.includes("invalid-phone-number")) return "Enter a valid 10-digit Indian mobile number.";
  if (combined.includes("invalid-verification-code")) return "The OTP is incorrect. Please check the SMS and try again.";
  if (combined.includes("code-expired")) return "The OTP has expired. Send a fresh OTP.";
  return raw || "Firebase returned an unknown error.";
}

export function FirebaseOtpTestClient() {
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("insureit-customer-auth.firebaseapp.com");
  const [projectId, setProjectId] = useState("insureit-customer-auth");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("Enter the Firebase Web API key, then send one real OTP.");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<FirebaseConfirmationResult | null>(null);
  const [verifier, setVerifier] = useState<FirebaseRecaptchaVerifier | null>(null);

  const normalizedPhone = useMemo(() => normalizeIndianPhone(phone), [phone]);

  useEffect(() => {
    const saved = sessionStorage.getItem("insureit-firebase-web-api-key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => () => verifier?.clear(), [verifier]);

  async function prepareFirebase() {
    if (!apiKey.trim()) throw new Error("Enter the Firebase Web API key first.");
    sessionStorage.setItem("insureit-firebase-web-api-key", apiKey.trim());

    const firebase = await loadFirebaseSdk();
    const config: FirebaseCompatConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
    };

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
    return { firebase, auth: app.auth() };
  }

  async function sendOtp() {
    if (!normalizedPhone) {
      setStatus("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setBusy(true);
    setOtp("");
    setConfirmation(null);
    setStatus("Loading Firebase and preparing reCAPTCHA…");

    try {
      const { firebase, auth } = await prepareFirebase();
      verifier?.clear();

      const nextVerifier = new firebase.auth.RecaptchaVerifier("firebase-otp-recaptcha", {
        size: "normal",
      });
      setVerifier(nextVerifier);
      await nextVerifier.render();

      setStatus(`Requesting an SMS OTP for ${normalizedPhone}…`);
      const result = await auth.signInWithPhoneNumber(normalizedPhone, nextVerifier);
      setConfirmation(result);
      setStatus("OTP request accepted by Firebase. Check the phone for a normal SMS, then enter the code below.");
    } catch (error) {
      setStatus(friendlyError(error));
      setVerifier((current) => {
        current?.clear();
        return null;
      });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!confirmation) {
      setStatus("Send an OTP first.");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setStatus("Enter the 6-digit OTP from the SMS.");
      return;
    }

    setBusy(true);
    setStatus("Verifying OTP with Firebase…");
    try {
      const result = await confirmation.confirm(otp.trim());
      setStatus(`Verified successfully. Firebase UID: ${result.user.uid}. Phone: ${result.user.phoneNumber ?? normalizedPhone ?? "verified"}.`);
    } catch (error) {
      setStatus(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 rounded-2xl bg-[#071D49] px-5 py-4 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">INSUREIT · isolated tester</p>
          <h1 className="mt-1 text-2xl font-extrabold">Firebase Phone OTP Test</h1>
          <p className="mt-2 text-sm leading-6 text-blue-100">
            This page tests Firebase SMS delivery only. It does not create an INSUREIT customer, Supabase session, profile, vehicle, policy, claim, or database record.
          </p>
        </div>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
            Use only your Firebase <strong>Web API key</strong>. Do not paste a service-account JSON, private key, client secret, or Supabase service-role key here.
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">
              Firebase Web API key
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                autoComplete="off"
                placeholder="AIza…"
                className="h-11 rounded-xl border border-slate-300 px-3 font-mono text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold">
              Auth domain
              <input
                value={authDomain}
                onChange={(event) => setAuthDomain(event.target.value)}
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold">
              Project ID
              <input
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <hr className="border-slate-200" />

          <label className="grid gap-1.5 text-sm font-semibold">
            Indian mobile number
            <div className="flex h-12 overflow-hidden rounded-xl border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
              <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 font-bold text-slate-600">+91</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                className="min-w-0 flex-1 px-3 text-base outline-none"
              />
            </div>
          </label>

          <div id="firebase-otp-recaptcha" className="min-h-[78px] overflow-hidden rounded-xl bg-slate-50 p-2" />

          <button
            type="button"
            onClick={sendOtp}
            disabled={busy || !normalizedPhone}
            className="h-12 w-full rounded-xl bg-[#0B63CE] px-4 text-sm font-bold text-white transition hover:bg-[#0954AE] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && !confirmation ? "Sending…" : "Send Firebase SMS OTP"}
          </button>

          {confirmation ? (
            <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <label className="grid gap-1.5 text-sm font-semibold">
                OTP received by SMS
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  className="h-11 rounded-xl border border-blue-200 bg-white px-3 text-center text-lg tracking-[0.3em] outline-none focus:border-blue-600"
                />
              </label>
              <button
                type="button"
                onClick={verifyOtp}
                disabled={busy || otp.length !== 6}
                className="h-11 rounded-xl bg-[#071D49] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify OTP"}
              </button>
            </div>
          ) : null}

          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Test status</p>
            <p className="mt-1 break-words text-sm leading-6 text-slate-800">{status}</p>
          </div>
        </section>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Test route: /firebase-otp-test · Firebase verification only · no INSUREIT auth migration is performed here.
        </p>
      </div>
    </main>
  );
}
