"use client";

import { useEffect } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { InsureItLoader } from "@/components/loading/insureit-loader";

export default function Home() {
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const hasSupabaseEmailPayload =
      params.has("code") ||
      params.has("error") ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      hashParams.has("error") ||
      hashParams.get("type") === "invite" ||
      hashParams.get("type") === "recovery";

    if (hasSupabaseEmailPayload) {
      window.location.replace(`/invite${search}${hash}`);
      return;
    }

    window.location.replace("/dashboard");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F9FF] p-6">
      <div className="rounded-[28px] border border-[#D7E6F5] bg-white/95 px-8 py-8 shadow-[0_24px_70px_rgba(11,55,105,0.14)]">
        <div className="mb-6 flex justify-center">
          <BrandLockup size="hero" />
        </div>
        <InsureItLoader label="Opening workspace" sublabel="Preparing your secure portal route." />
      </div>
    </main>
  );
}
