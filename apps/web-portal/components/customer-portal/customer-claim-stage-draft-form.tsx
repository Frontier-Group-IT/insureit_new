"use client";

import { useEffect, useRef, type ReactNode, type FormEvent } from "react";

const PREFIX = "insureit:customer-claim-stage-draft:v1:";
const MAX_AGE = 24 * 60 * 60 * 1000;

export function customerClaimStageDraftKey(accountId: string, claimId: string, stage: string): string {
  return PREFIX + encodeURIComponent(accountId) + ":" + encodeURIComponent(claimId) + ":" + encodeURIComponent(stage);
}

type Draft = { savedAt: number; values: Record<string, string> };

export function saveCustomerClaimDraft(form: HTMLFormElement, key: string): void {
  try {
    const values: Record<string, string> = {};
    new FormData(form).forEach((value, name) => {
      if (typeof value === "string" && !["account", "claim", "stage"].includes(name)) values[name] = value;
    });
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), values }));
  } catch { /* Storage is optional; never block claim entry. */ }
}

export function restoreCustomerClaimDraft(form: HTMLFormElement, key: string): void {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    const draft = JSON.parse(raw) as Draft;
    if (!draft?.savedAt || Date.now() - draft.savedAt > MAX_AGE || !draft.values || typeof draft.values !== "object") {
      window.sessionStorage.removeItem(key);
      return;
    }
    for (const [name, value] of Object.entries(draft.values)) {
      if (typeof value !== "string") continue;
      const control = form.elements.namedItem(name);
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
      if (control instanceof HTMLInputElement && control.type === "hidden" && control.closest("[data-claim-choice]")) {
        const parent = control.closest("[data-claim-choice]");
        const choice = Array.from(parent?.querySelectorAll<HTMLButtonElement>("[data-choice-value]") ?? []).find(button => button.dataset.choiceValue === value);
        choice?.click(); // Updates the controlled Yes/No choice through React.
      } else if (!(control instanceof HTMLInputElement && ["file", "checkbox", "radio"].includes(control.type))) {
        control.value = value;
      }
    }
  } catch { /* Malformed or blocked storage must not prevent entry. */ }
}

export function clearCustomerClaimDraft(key: string): void {
  try { window.sessionStorage.removeItem(key); } catch {}
}

export function CustomerClaimStageDraftForm({
  id, accountId, claimId, stage, className, children,
}: {
  id: string; accountId: string; claimId: string; stage: string; className: string; children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const key = customerClaimStageDraftKey(accountId, claimId, stage);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    restoreCustomerClaimDraft(form, key);
    const onChoice = () => window.setTimeout(() => saveCustomerClaimDraft(form, key), 0);
    form.addEventListener("click", onChoice);
    return () => form.removeEventListener("click", onChoice);
  }, [key]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // Enter and button clicks share the same guarded handler.
    const form = event.currentTarget;
    saveCustomerClaimDraft(form, key);
    const button = document.querySelector<HTMLButtonElement>(`[data-claim-stage-save="${id}"]`);
    button?.click();
  }
  return <form ref={formRef} id={id} className={className} onInput={event => saveCustomerClaimDraft(event.currentTarget, key)} onChange={event => saveCustomerClaimDraft(event.currentTarget, key)} onSubmit={submit}>
    {children}
  </form>;
}
