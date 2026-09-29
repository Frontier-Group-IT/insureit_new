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
    label.insertAdjacentElement("afterend", mirror);
  }

  const iso = toIsoDate(visible.value);
  if (mirror.value !== iso) mirror.value = iso;
}

function syncLifeHealthDesktopLayout() {
  const layout = document.querySelector<HTMLElement>("[data-life-health-layout='true']");
  if (!layout) return;

  // The Life/Health form is mounted into a DOM-created grid. Keep that grid and
  // its children eligible to consume the full policy workspace; otherwise the
  // portal can shrink-wrap and leave a large unused area on wide screens.
  layout.classList.add("w-full", "min-w-0");
  layout.parentElement?.classList.add("w-full", "min-w-0");
  (layout.firstElementChild as HTMLElement | null)?.classList.add("min-w-0");
  layout.querySelector<HTMLElement>("[data-life-health-summary='true']")?.classList.add("min-w-0");

  // Four source fields are too narrow when the summary rail is present at
  // desktop widths. Use two columns until the viewport has genuine 2xl space.
  const source = layout.querySelector<HTMLElement>("[data-life-health-source='true']");
  const sourceContent = source?.querySelector<HTMLElement>(":scope > div:last-child");
  if (sourceContent?.classList.contains("xl:grid-cols-4")) {
    sourceContent.classList.remove("xl:grid-cols-4");
    sourceContent.classList.add("xl:grid-cols-2", "2xl:grid-cols-4");
  }
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

  rmMeta.style.display = "inline-flex";
  rmMeta.style.verticalAlign = "middle";

  const employeeIdText = `ID · ${rmCode}`;
  if (existing) {
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
      syncLifeHealthDesktopLayout();
      syncRmEmployeeId(sources);
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", sync, true);
    document.addEventListener("change", sync, true);
    window.addEventListener("resize", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", sync, true);
      document.removeEventListener("change", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [sources]);
  return null;
}
