"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPolicyNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Permission-denied or non-secure contexts must not claim a successful copy.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => { void copy(); }}
      aria-label={copied ? "Policy number copied" : "Copy policy number"}
      title={copied ? "Copied" : "Copy policy number"}
      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2 text-[10px] font-semibold text-white transition-colors duration-200 hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
