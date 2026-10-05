"use client";

import { useEffect } from "react";

type Props = {
  proposalPending: number;
};

export function DashboardRegisterSync({ proposalPending }: Props) {
  useEffect(() => {
    syncPendingProposal(proposalPending);
    syncPolicyPerformanceCard();
  }, [proposalPending]);

  return null;
}

function syncPendingProposal(proposalPending: number) {
  const section = findSectionByHeading("Needs attention");
  if (!section) return;

  const policyIntakeCard = findCardByLabel(section, "Policy Intakes pending");
  let proposalCard = findCardByLabel(section, "Pending proposal");

  if (proposalPending <= 0) {
    if (proposalCard) proposalCard.style.display = "none";
    return;
  }

  if (!proposalCard && policyIntakeCard) {
    proposalCard = policyIntakeCard.cloneNode(true) as HTMLAnchorElement;
    policyIntakeCard.insertAdjacentElement("afterend", proposalCard);
  }
  if (!proposalCard) return;

  proposalCard.style.display = "";
  proposalCard.href = "/policies/life-health-cases";

  const copy = proposalCard.querySelectorAll("p");
  if (copy[0]) copy[0].textContent = "Pending proposal";
  if (copy[1]) copy[1].textContent = "Awaiting final policy";

  const count = proposalCard.querySelector("span.portal-display");
  if (count) count.textContent = proposalPending.toLocaleString("en-IN");

  const accent = proposalCard.querySelector("span.h-8.w-\\[3px\\]") as HTMLElement | null;
  if (accent) accent.style.backgroundColor = "#EE695F";

  proposalCard.setAttribute(
    "aria-label",
    `Pending proposal: ${proposalPending}. Open Policy Register proposal cases.`,
  );
}

function syncPolicyPerformanceCard() {
  const section = findSectionByHeading("Business performance");
  if (!section) return;

  const policyLabel = Array.from(section.querySelectorAll("p")).find((node) =>
    node.textContent?.trim().toLowerCase().startsWith("policies ·"),
  );
  const countColumn = policyLabel?.parentElement as HTMLElement | null;
  const contentGrid = countColumn?.parentElement as HTMLElement | null;
  if (!countColumn || !contentGrid || contentGrid.dataset.policyCardRefined === "true") return;

  const breakdownColumn = countColumn.nextElementSibling as HTMLElement | null;
  if (!breakdownColumn) return;

  contentGrid.dataset.policyCardRefined = "true";
  contentGrid.style.gridTemplateColumns = "1fr auto 2fr";
  contentGrid.style.columnGap = "16px";

  countColumn.style.display = "flex";
  countColumn.style.flexDirection = "column";
  countColumn.style.alignItems = "center";
  countColumn.style.justifyContent = "center";
  countColumn.style.textAlign = "center";
  countColumn.style.height = "100%";

  const divider = document.createElement("span");
  divider.dataset.policyCardDivider = "true";
  divider.setAttribute("aria-hidden", "true");
  divider.style.width = "1px";
  divider.style.height = "52%";
  divider.style.minHeight = "34px";
  divider.style.alignSelf = "center";
  divider.style.backgroundColor = "#DCE5EF";

  contentGrid.insertBefore(divider, breakdownColumn);
}

function findSectionByHeading(label: string) {
  const heading = Array.from(document.querySelectorAll("h2")).find(
    (node) => node.textContent?.trim() === label,
  );
  return heading?.closest("section") ?? null;
}

function findCardByLabel(section: Element, label: string) {
  const labelNode = Array.from(section.querySelectorAll("p")).find(
    (node) => node.textContent?.trim() === label,
  );
  return (labelNode?.closest("a") as HTMLAnchorElement | null) ?? null;
}
