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

  return children;
}
