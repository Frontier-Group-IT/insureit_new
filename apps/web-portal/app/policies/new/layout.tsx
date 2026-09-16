import type { ReactNode } from "react";
import { PolicyVehicleRequiredFields } from "./policy-vehicle-required-fields";
import "./policy-summary-width.css";

export default function PolicyOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PolicyVehicleRequiredFields />
    </>
  );
}
