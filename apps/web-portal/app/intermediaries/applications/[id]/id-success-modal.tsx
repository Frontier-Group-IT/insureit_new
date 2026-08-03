"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, GraduationCap, X } from "lucide-react";
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

const modalSuccessEvents = new Set(["partner_id_generated", "linked_posp_account_created", "linked_misp_account_created"]);

export function IdSuccessModal({ event, applicationId, isPartner, preferredType, partnerId, registrationId, linkedId }: Props) {
  const [visible, setVisible] = useState(false);
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
  const primaryHref = isPartnerEvent && linkedId
    ? freshHref(`/intermediaries/applications/${linkedId}`)
    : freshHref(`/intermediaries/applications/${applicationId}/workflow?stage=review#training-requirement`);

  return (
    <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#07152D]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="id-success-title">
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_26px_80px_rgba(8,17,39,.28)]">
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#635BFF]">Success</p>
            <h2 id="id-success-title" className="mt-1 text-[17px] font-semibold leading-tight text-[#0F172A]">{title}</h2>
            {generatedId ? <p className="mt-2 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-800">{generatedId}</p> : null}
          </div>
          <Link href={cleanHref} aria-label="Close success popup" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition hover:bg-[#F8FAFC]" onClick={() => setVisible(false)}>
            <X className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 sm:grid-cols-2">
          <Link href={cleanHref} onClick={() => setVisible(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F1F5F9]">OK</Link>
          {isPartnerEvent && isPartner && !linkedId ? (
            <form action={createLinkedIntermediaryAccount}>
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="registration_type" value={accountType} />
              <FormSubmitButton
                label={`Create ${accountLabel} ID`}
                pendingLabel={`Creating ${accountLabel} ID…`}
                icon={<ArrowRight className="h-4 w-4" />}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10.5px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,.22)] hover:brightness-110"
              />
            </form>
          ) : (
            <Link href={primaryHref} onClick={() => setVisible(false)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10.5px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,.22)] transition hover:brightness-105">
              {isPartnerEvent ? "Open linked account" : "Start Training"} <GraduationCap className="h-4 w-4" />
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
