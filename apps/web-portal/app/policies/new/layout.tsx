import type { ReactNode } from "react";
import { PersistentPolicyErrorGuard } from "./persistent-policy-error-guard";
import { PolicyVehicleRequiredFields } from "./policy-vehicle-required-fields";

export default function PolicyOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        /* Life / Health uses the same visual sequence as Motor: step navigation first, then section 01. */
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > * {
          margin-top: 0 !important;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > nav[aria-label="Life and Health policy sections"] {
          order: 1;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > section:first-of-type {
          order: 2;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div:not(.fixed) {
          order: 3;
        }
      `}</style>
      <PolicyVehicleRequiredFields />
      <PersistentPolicyErrorGuard />
    </>
  );
}
