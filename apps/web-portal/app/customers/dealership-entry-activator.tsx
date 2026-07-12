"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DealershipEntryActivator() {
  const router = useRouter();

  useEffect(() => {
    const activateEntries = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));

      const addCustomerButton = buttons.find((button) => button.textContent?.replace(/\s+/g, " ").trim() === "+ Add Customer");
      if (addCustomerButton) addCustomerButton.textContent = "+ Add New";

      const dealershipButton = buttons.find((button) => {
        const value = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
        return value.startsWith("dealership") && value.includes("vehicle dealer or service partner");
      });

      if (!dealershipButton || dealershipButton.dataset.dealershipEnabled === "true") return;
      dealershipButton.disabled = false;
      dealershipButton.dataset.dealershipEnabled = "true";
      dealershipButton.className = "group rounded-xl border border-[#CBD5E1] bg-white p-4 text-left transition hover:border-[#6366F1] hover:bg-[#F8FAFF]";
      dealershipButton.setAttribute("aria-label", "Open dealership onboarding");

      const badge = Array.from(dealershipButton.querySelectorAll<HTMLElement>("span")).find((element) => element.textContent?.trim().toLowerCase() === "coming soon");
      if (badge) {
        badge.textContent = "Available";
        badge.className = "rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700";
      }

      dealershipButton.addEventListener("click", () => router.push("/customers/dealership-type"), { once: true });
    };

    activateEntries();
    const observer = new MutationObserver(activateEntries);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [router]);

  return null;
}
