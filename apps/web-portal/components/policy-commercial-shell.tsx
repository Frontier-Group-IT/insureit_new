"use client";

import { PolicyIntakeOnboardingContextCard } from "@/components/policy-intake-onboarding-context";
import {
  PolicyUnifiedForm,
  type PolicyRmOption,
  type PolicySourceOption,
  type PolicyUnifiedInitialValues,
} from "@/components/policy-unified-form";

export type PolicyCommercialShellProps = {
  mode: "create" | "edit";
  insurers: Array<{ label: string; value: string }>;
  rms: PolicyRmOption[];
  sources: PolicySourceOption[];
  manufacturers?: string[];
  initialValues?: PolicyUnifiedInitialValues;
  commercialAccess: boolean;
};

export function PolicyCommercialShell(props: PolicyCommercialShellProps) {
  return (
    <>
      <PolicyUnifiedForm
        mode={props.mode}
        insurers={props.insurers}
        rms={props.rms}
        sources={props.sources}
        manufacturers={props.manufacturers}
        initialValues={props.initialValues}
        commercialAccess={props.commercialAccess}
      />
      {props.mode === "create" ? <PolicyIntakeOnboardingContextCard /> : null}
    </>
  );
}
