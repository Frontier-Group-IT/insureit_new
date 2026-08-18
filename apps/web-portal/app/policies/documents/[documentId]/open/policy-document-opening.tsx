"use client";

import Link from "next/link";
import { FileText, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { openPolicyCopy } from "@/app/policies/policy-document-actions";

export function PolicyDocumentOpening({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function openDocument() {
      try {
        const result = await openPolicyCopy(documentId);
        if (!active) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        window.location.replace(result.url);
      } catch {
        if (active) setError("Could not open the policy copy. Please try again.");
      }
    }

    void openDocument();
    return () => {
      active = false;
    };
  }, [documentId]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F7FB] px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-[#DCE5EF] bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]">
          <FileText className="h-5 w-5" />
        </span>
        {error ? (
          <>
            <h1 className="mt-4 text-[16px] font-bold text-[#0F172A]">Policy copy could not be opened</h1>
            <p className="mt-2 text-[12px] leading-5 text-[#64748B]">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button type="button" onClick={() => window.close()} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[11px] font-bold text-[#334155]">Close tab</button>
              <Link href="/policies" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#17365D] px-4 text-[11px] font-bold text-white">Back to policies</Link>
            </div>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin text-[#315B9A]" />
            <h1 className="mt-3 text-[16px] font-bold text-[#0F172A]">Opening policy copy…</h1>
            <p className="mt-2 text-[12px] leading-5 text-[#64748B]">Checking access and preparing the secure policy document.</p>
          </>
        )}
      </section>
    </main>
  );
}
