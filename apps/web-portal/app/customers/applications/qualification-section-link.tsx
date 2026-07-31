"use client";

import { freshDynamicRouteUrl } from "@/components/fresh-dynamic-route-navigation";

export function QualificationSectionLink({ applicationId, label }: { applicationId: string; label: string }) {
  function focusQualificationSection() {
    const heading = Array.from(document.querySelectorAll("h2")).find(
      (element) => element.textContent?.trim() === "Qualification and agreement process"
    );
    const section = heading?.closest("section");

    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/intermediaries/applications/${applicationId}?stage=review#qualification-process`);
      return;
    }

    window.location.assign(freshDynamicRouteUrl(`/intermediaries/applications/${applicationId}?stage=review#qualification-process`));
  }

  return (
    <button
      type="button"
      onClick={focusQualificationSection}
      className="mt-2 w-full rounded-lg bg-[#071D49] px-4 py-2.5 text-center text-[10.5px] font-semibold text-white"
    >
      {label}
    </button>
  );
}
