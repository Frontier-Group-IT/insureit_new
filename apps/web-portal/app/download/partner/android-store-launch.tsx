"use client";

import { useEffect, useRef } from "react";

const NATIVE_PLAY = "market://details?id=com.insureit.partner";
const PLAY_INTENT = "intent://details?id=com.insureit.partner#Intent;scheme=market;package=com.android.vending;end";

export function AndroidStoreLaunch({ webUrl }: { webUrl: string }) {
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    // Some QR in-app browsers require a user gesture; keep the manual link visible.
    try {
      window.location.href = NATIVE_PLAY;
    } catch {
      // A blocked external protocol must not prevent the explicit download options.
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071D49] px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-7 text-center">
        <h1 className="text-3xl font-extrabold">INSUREIT <span className="text-[#FFD04E]">Partner</span></h1>
        <p className="mt-3 text-sm text-blue-100">If Google Play does not open automatically, tap below.</p>
        <a href={PLAY_INTENT} className="mt-6 block rounded-xl bg-white px-5 py-3 font-bold text-[#0D3470]">Open Google Play Store</a>
        <a href={NATIVE_PLAY} className="mt-3 block rounded-xl border border-white/40 px-5 py-3 text-sm">Try native store link</a>
        <a href={webUrl} className="mt-4 inline-block text-sm text-blue-100 underline">View Google Play website</a>
      </section>
    </main>
  );
}
