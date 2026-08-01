"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function IntermediaryWorkflowLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    // The parent application layout is preserved by Next.js during client navigation.
    // Refresh the current server-component tree whenever the workflow route state changes
    // so recently saved profile, document, and onboarding data is rendered immediately.
    router.refresh();
  }, [pathname, search, router]);

  useEffect(() => {
    const handleBackNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>("a");
      if (!link || !link.textContent?.toLowerCase().includes("back to account review")) return;

      event.preventDefault();
      window.location.assign(link.href);
    };

    document.addEventListener("click", handleBackNavigation, true);
    return () => document.removeEventListener("click", handleBackNavigation, true);
  }, []);

  useEffect(() => {
    const alignWorkflowStepNumbers = () => {
      const numbers: Array<[string, string]> = [
        ["training-requirement", "2"],
        ["examination-requirement", "3"],
        ["agreement-requirement", "4"],
      ];

      for (const [sectionId, expectedNumber] of numbers) {
        const badge = document.querySelector<HTMLElement>(`#${sectionId} > div:first-child span:first-child`);
        if (!badge || badge.textContent?.trim() === "✓") continue;
        if (badge.textContent?.trim() !== expectedNumber) badge.textContent = expectedNumber;
      }

      const iibStep = document.querySelector<HTMLElement>("#iib-submission header p:first-child");
      if (iibStep && iibStep.textContent?.trim() !== "Step 5") iibStep.textContent = "Step 5";
    };

    alignWorkflowStepNumbers();
    const observer = new MutationObserver(alignWorkflowStepNumbers);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, search]);

  return children;
}
