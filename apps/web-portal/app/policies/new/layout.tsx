import type { ReactNode } from "react";
import { PersistentPolicyErrorGuard } from "./persistent-policy-error-guard";
import { PolicyVehicleRequiredFields } from "./policy-vehicle-required-fields";

export default function PolicyOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        /*
         * Life / Health follows the Motor onboarding composition:
         * navigation first, then section 01 in the same left content column
         * with the Policy Status card starting alongside it on the right.
         * Keep this layout-only so onboarding/data behaviour remains untouched.
         */
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) {
          display: grid;
          width: 100%;
          min-width: 0;
          grid-template-columns: minmax(0, 1fr) 336px;
          gap: 1rem;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > * {
          margin-top: 0 !important;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > nav[aria-label="Life and Health policy sections"] {
          grid-column: 1 / -1;
          grid-row: 1;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > section:first-of-type {
          grid-column: 1;
          grid-row: 2;
          min-width: 0;
          align-self: start;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.grid:not(.fixed) {
          display: contents;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.grid:not(.fixed) > div:first-child {
          grid-column: 1;
          grid-row: 3;
          min-width: 0;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.grid:not(.fixed) > div:last-child {
          grid-column: 2;
          grid-row: 2 / span 2;
          min-width: 0;
          align-self: start;
          position: sticky;
          top: 124px;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.mt-3 {
          grid-column: 1 / -1;
          grid-row: 4;
          margin-top: 0 !important;
        }
        /* Match Motor's compact Policy Status card treatment. */
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) aside {
          border-radius: 1rem;
          box-shadow: none;
        }
        div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) aside > div:first-child {
          min-height: 74px;
          background: #fff;
        }
        @media (max-width: 1279px) {
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > nav[aria-label="Life and Health policy sections"] { order: 1; }
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > section:first-of-type { order: 2; }
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.grid:not(.fixed) {
            display: grid;
            order: 3;
          }
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.grid:not(.fixed) > div:last-child {
            position: static;
          }
          div.space-y-3:has(> nav[aria-label="Life and Health policy sections"]) > div.mt-3 { order: 4; }
        }
      `}</style>
      <PolicyVehicleRequiredFields />
      <PersistentPolicyErrorGuard />
    </>
  );
}
