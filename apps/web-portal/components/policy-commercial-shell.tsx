"use client";

import type { NonMotorCustomerOption } from "@/components/non-motor-policy-form";
import { PolicyCommercialAccessProvider } from "@/components/policy-commercial-access-context";
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
  customers?: NonMotorCustomerOption[];
  rms: PolicyRmOption[];
  sources: PolicySourceOption[];
  manufacturers?: string[];
  initialValues?: PolicyUnifiedInitialValues;
  commercialAccess: boolean;
};

export function PolicyCommercialShell(props: PolicyCommercialShellProps) {
  return (
    <PolicyCommercialAccessProvider access={props.commercialAccess}>
      <PolicyUnifiedForm
        mode={props.mode}
        insurers={props.insurers}
        customers={props.customers}
        rms={props.rms}
        sources={props.sources}
        manufacturers={props.manufacturers}
        initialValues={props.initialValues}
        commercialAccess={props.commercialAccess}
      />
      {props.mode === "create" ? <PolicyIntakeOnboardingContextCard /> : null}
    </PolicyCommercialAccessProvider>
  );
}
