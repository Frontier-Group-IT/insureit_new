"use client";

import { useFormStatus } from "react-dom";

export function ClassifySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-8 min-w-[78px] rounded-md bg-[#071D49] px-3 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#A9B4C5] disabled:text-white/85"
    >
      {pending ? "Classifying..." : "Classify"}
    </button>
  );
}
