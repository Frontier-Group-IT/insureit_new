import type { ReactNode } from "react";
import { PersistentPolicyErrorGuard } from "./persistent-policy-error-guard";
import { PolicyVehicleRequiredFields } from "./policy-vehicle-required-fields";

export default function PolicyOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PolicyVehicleRequiredFields />
      <PersistentPolicyErrorGuard />
    </>
  );
}
