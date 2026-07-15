"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type DealershipTypeMap = Record<string, "posp" | "misp">;

export function DealershipEntryActivator({ dealershipTypes = {} }: { dealershipTypes?: DealershipTypeMap }) {
  const router = useRouter();

  useEffect(() => {
    const enablePartnerButton = (buttons: HTMLButtonElement[], startsWith: string, route: string, ariaLabel: string) => {
      const button = buttons.find((item) => {
        const value = item.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
        return value.startsWith(startsWith.toLowerCase());
      });
      if (!button || button.dataset.partnerEnabled === "true") return;
      button.disabled = false;
      button.dataset.partnerEnabled = "true";
      button.className = "group rounded-xl border border-[#CBD5E1] bg-white p-4 text-left transition hover:border-[#6366F1] hover:bg-[#F8FAFF]";
      button.setAttribute("aria-label", ariaLabel);
      const badge = Array.from(button.querySelectorAll<HTMLElement>("span")).find((element) => element.textContent?.trim().toLowerCase() === "coming soon");
      if (badge) {
        badge.textContent = "Available";
        badge.className = "rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700";
      }
      button.addEventListener("click", () => router.push(route), { once: true });
    };

    const activateEntries = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const addCustomerButton = buttons.find((button) => button.textContent?.replace(/\s+/g, " ").trim() === "+ Add Customer");
      if (addCustomerButton) addCustomerButton.textContent = "+ Add New";

      enablePartnerButton(buttons, "dealership", "/customers/dealership-type", "Open dealership onboarding");
      enablePartnerButton(buttons, "corporate", "/customers/new?partner_type=corporate", "Open corporate onboarding");
      enablePartnerButton(buttons, "group", "/customers/new?partner_type=group", "Open group onboarding");

      for (const [customerId, dealershipType] of Object.entries(dealershipTypes)) {
        const customerLink = document.querySelector<HTMLAnchorElement>(`a[href="/customers/${customerId}/edit"]`);
        const row = customerLink?.closest("tr");
        if (!row) continue;
        const partnerCell = Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).find((cell) => cell.textContent?.trim() === "Dealership");
        if (!partnerCell) continue;
        partnerCell.textContent = `Dealership · ${dealershipType.toUpperCase()}`;
        partnerCell.dataset.dealershipType = dealershipType;
      }
    };

    activateEntries();
    const observer = new MutationObserver(activateEntries);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dealershipTypes, router]);

  return null;
}
