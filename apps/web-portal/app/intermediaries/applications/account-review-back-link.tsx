"use client";

import { useRouter } from "next/navigation";

export function AccountReviewBackLink({ href }: { href: string }) {
  const router = useRouter();

  function handleClick() {
    const freshHref = `${href}${href.includes("?") ? "&" : "?"}fresh=${Date.now()}`;
    router.push(freshHref);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} className="text-[10px] font-semibold text-[#4F46E5] hover:underline">
      ← Back to account review
    </button>
  );
}
