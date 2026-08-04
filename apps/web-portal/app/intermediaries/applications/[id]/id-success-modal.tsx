"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, X } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createLinkedIntermediaryAccount } from "./account-review-actions";

type Props = {
  event: string | undefined;
  applicationId: string;
  isPartner: boolean;
  preferredType: "posp" | "misp";
  partnerId: string | null;
  registrationId: string | null;
  linkedId: string | undefined;
};

const modalSuccessEvents = new Set(["partner_id_generated", "linked_posp_account_created", "linked_misp_account_created", "legacy_intermediary_imported"]);

export function IdSuccessModal({ event, applicationId, isPartner, preferredType, partnerId, registrationId, linkedId }: Props) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPartnerEvent = event === "partner_id_generated";
  const createdLinkedType = event === "linked_misp_account_created" ? "misp" : event === "linked_posp_account_created" ? "posp" : null;
  const accountType = createdLinkedType ?? preferredType;
  const accountLabel = accountType.toUpperCase();
  const generatedId = isPartnerEvent ? partnerId : registrationId;
  const cleanHref = useMemo(() => cleanCurrentSuccessUrl(), []);
  const seenKey = event && modalSuccessEvents.has(event) ? `id-success-modal:${applicationId}:${event}:${generatedId ?? "pending"}` : null;

  useEffect(() => {
    if (!event || !modalSuccessEvents.has(event) || !seenKey) return;

    const cleanUrl = cleanCurrentSuccessUrl();
    window.history.replaceState(window.history.state, "", cleanUrl);

    if (sessionStorage.getItem(seenKey) === "seen") {
      setVisible(false);
      return;
    }

    sessionStorage.setItem(seenKey, "seen");
    setVisible(true);

    const hideOnPageShow = (pageEvent: PageTransitionEvent) => {
      if (pageEvent.persisted && sessionStorage.getItem(seenKey) === "seen") setVisible(false);
    };
    window.addEventListener("pageshow", hideOnPageShow);
    return () => window.removeEventListener("pageshow", hideOnPageShow);
  }, [event, seenKey]);

  if (!event || !modalSuccessEvents.has(event) || !visible) return null;

  const title = isPartnerEvent ? "Partner ID created" : `${accountLabel} ID created`;
  const idLabel = isPartnerEvent ? "Partner ID" : `${accountLabel} ID`;
  const contextLabel = isPartnerEvent ? (accountType === "misp" ? "Business Partner" : "Individual Partner") : `${accountLabel} account`;
  const nextStep = isPartnerEvent && isPartner && !linkedId ? `Create ${accountLabel} ID` : "Continue workflow";
  const primaryHref = isPartnerEvent && linkedId
    ? freshHref(`/intermediaries/applications/${linkedId}`)
    : freshHref(`/intermediaries/applications/${applicationId}/workflow?stage=review#training-requirement`);

  const copyId = async () => {
    if (!generatedId) return;
    await navigator.clipboard.writeText(generatedId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#07152D]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="id-success-title">
      <div className="relative w-full max-w-[410px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_26px_80px_rgba(8,17,39,.28)]">
        <div className="h-1 bg-gradient-to-r from-[#071D49] via-[#315FEA] to-[#42B8F4]" />

        <div className="px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-emerald-700">Issued</span>
                <span className="rounded-full border border-[#DCE5EF] bg-[#F8FAFC] px-2.5 py-1 text-[8.5px] font-semibold text-[#475569]">{contextLabel}</span>
              </div>
              <h2 id="id-success-title" className="mt-3 text-[17px] font-semibold leading-tight text-[#0F172A]">{title}</h2>
            </div>
            <Link href={cleanHref} aria-label="Close ID popup" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition hover:bg-[#F8FAFC]" onClick={() => setVisible(false)}>
              <X className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#64748B]">{idLabel}</p>
                <p className="mt-1 truncate font-mono text-[15px] font-semibold tracking-[0.04em] text-[#071D49]">{generatedId ?? "Pending"}</p>
              </div>
              {generatedId ? (
                <button type="button" onClick={copyId} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[9.5px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F1F5F9]">
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3 text-[9.5px]">
              <div>
                <p className="font-semibold text-[#64748B]">Record</p>
                <p className="mt-0.5 font-semibold text-[#17203A]">{isPartnerEvent ? "Partner" : accountLabel}</p>
              </div>
              <div>
                <p className="font-semibold text-[#64748B]">Next step</p>
                <p className="mt-0.5 font-semibold text-[#17203A]">{nextStep}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:grid-cols-2">
          <Link href={cleanHref} onClick={() => setVisible(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F1F5F9]">OK</Link>
          {isPartnerEvent && isPartner && !linkedId ? (
            <form action={createLinkedIntermediaryAccount}>
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="registration_type" value={accountType} />
              <FormSubmitButton
                label={`Create ${accountLabel} ID`}
                pendingLabel={`Creating ${accountLabel} ID...`}
                icon={<ArrowRight className="h-4 w-4" />}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10.5px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,.22)] hover:brightness-110"
              />
            </form>
          ) : (
            <Link href={primaryHref} onClick={() => setVisible(false)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10.5px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,.22)] transition hover:brightness-105">
              {isPartnerEvent ? "Open linked account" : "Continue workflow"} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function cleanCurrentSuccessUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.delete("success");
  return `${url.pathname}${url.search}${url.hash}`;
}

function freshHref(href: string) {
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}fresh=${Date.now()}${hash ? `#${hash}` : ""}`;
}
