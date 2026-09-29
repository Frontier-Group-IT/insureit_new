"use client";

import { useEffect } from "react";

export type OnboardingSource = { value: string; rmCode: string };

function findControl(prefix: string) {
  const label = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.trim().toLowerCase().startsWith(prefix.toLowerCase()));
  return label?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null;
}

function toIsoDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function syncLifeHealthSourcingDate() {
  const policyType = (findControl("Policy type") as HTMLSelectElement | null)?.value;
  if (policyType !== "Life" && policyType !== "Health") return;

  const label = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.trim().toLowerCase().startsWith("policy issuance date"));
  const container = label?.parentElement;
  if (!container) return;

  const visible = container.querySelector<HTMLInputElement>('input[aria-label="Policy issuance date"]');
  if (!visible) return;

  let mirror = container.querySelector<HTMLInputElement>("input[data-life-health-sourcing-date]");
  if (!mirror) {
    mirror = document.createElement("input");
    mirror.type = "hidden";
    mirror.dataset.lifeHealthSourcingDate = "true";
    // Life/Health sourceSnapshot reads the first input in this field. Put an
    // ISO mirror first so the server receives YYYY-MM-DD, while the user keeps
    // seeing and editing DD/MM/YYYY in the normal date control.
    label.insertAdjacentElement("afterend", mirror);
  }

  const iso = toIsoDate(visible.value);
  if (mirror.value !== iso) mirror.value = iso;
}

function syncRmEmployeeId(sources: OnboardingSource[]) {
  const rmInput = document.querySelector<HTMLInputElement>('input[aria-label="RM name"]');
  const leadSelect = findControl("Lead source") as HTMLSelectElement | null;
  if (!rmInput || !leadSelect) return;

  const rmMeta = rmInput.previousElementSibling as HTMLElement | null;
  const container = rmInput.parentElement;
  if (!container || !rmMeta) return;

  const existing = container.querySelector<HTMLElement>("[data-rm-employee-id]");
  const rmCode = sources.find((source) => source.value === leadSelect.value)?.rmCode?.trim() ?? "";
  if (!rmCode) {
    existing?.remove();
    rmMeta.style.removeProperty("display");
    return;
  }

  // Employee ID belongs to the selected RM/source and is applicable to every
  // policy business line (Motor, Non-Motor, Health and Life).
  rmMeta.style.display = "inline-flex";
  rmMeta.style.verticalAlign = "middle";

  const employeeIdText = `ID · ${rmCode}`;
  if (existing) {
    // Avoid mutating the DOM when the value is already correct. Rewriting the
    // same text triggers the body MutationObserver again and can create an
    // endless requestAnimationFrame/mutation loop.
    if (existing.textContent !== employeeIdText) existing.textContent = employeeIdText;
    return;
  }

  const id = document.createElement("span");
  id.dataset.rmEmployeeId = "true";
  id.className = "ml-3 mt-1.5 inline-flex min-h-[18px] items-center align-middle text-[10px] font-semibold text-[#244C73]";
  id.textContent = employeeIdText;
  rmMeta.insertAdjacentElement("afterend", id);
}

export function PolicyLifeHealthOnboardingEnhancements({ sources }: { sources: OnboardingSource[] }) {
  useEffect(() => {
    const sync = () => requestAnimationFrame(() => {
      syncLifeHealthSourcingDate();
      syncRmEmployeeId(sources);
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", sync, true);
    document.addEventListener("change", sync, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", sync, true);
      document.removeEventListener("change", sync, true);
    };
  }, [sources]);
  return null;
}
