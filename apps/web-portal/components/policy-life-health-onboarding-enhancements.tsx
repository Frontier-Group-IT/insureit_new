"use client";

import { useEffect } from "react";

export type OnboardingSource = { value: string; rmCode: string };

function findControl(prefix: string) {
  const label = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.trim().toLowerCase().startsWith(prefix.toLowerCase()));
  return label?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null;
}

function syncRmEmployeeId(sources: OnboardingSource[]) {
  const policyType = (findControl("Policy type") as HTMLSelectElement | null)?.value;
  const rmInput = document.querySelector<HTMLInputElement>('input[aria-label="RM name"]');
  const leadSelect = findControl("Lead source") as HTMLSelectElement | null;
  if (!rmInput || !leadSelect) return;

  const rmMeta = rmInput.previousElementSibling as HTMLElement | null;
  const container = rmInput.parentElement;
  if (!container || !rmMeta) return;

  const existing = container.querySelector<HTMLElement>("[data-rm-employee-id]");
  if (policyType !== "Life" && policyType !== "Health") {
    existing?.remove();
    rmMeta.style.removeProperty("display");
    return;
  }

  const rmCode = sources.find((source) => source.value === leadSelect.value)?.rmCode?.trim() ?? "";
  if (!rmCode) {
    existing?.remove();
    rmMeta.style.removeProperty("display");
    return;
  }

  // Keep the employee ID immediately to the right of the RM metadata.
  rmMeta.style.display = "inline-flex";
  rmMeta.style.verticalAlign = "middle";

  if (existing) {
    existing.textContent = `ID · ${rmCode}`;
    return;
  }

  const id = document.createElement("span");
  id.dataset.rmEmployeeId = "true";
  id.className = "ml-3 mt-1.5 inline-flex min-h-[18px] items-center align-middle text-[10px] font-semibold text-[#244C73]";
  id.textContent = `ID · ${rmCode}`;
  rmMeta.insertAdjacentElement("afterend", id);
}

export function PolicyLifeHealthOnboardingEnhancements({ sources }: { sources: OnboardingSource[] }) {
  useEffect(() => {
    const sync = () => requestAnimationFrame(() => syncRmEmployeeId(sources));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", sync, true);
    sync();
    return () => { observer.disconnect(); document.removeEventListener("change", sync, true); };
  }, [sources]);
  return null;
}
