"use client";

import type { NonMotorCustomerOption } from "@/components/non-motor-policy-form";
import type { NonMotorUnifiedInitialValues } from "@/components/non-motor-unified-mode";
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
  nonMotorInitialValues?: NonMotorUnifiedInitialValues;
  commercialAccess: boolean;
  preselectedCustomerId?: string | null;
  sourceIntakeId?: string | null;
  initialDraftRevision?: number | null;
  initialRegistrationMode?: "registered" | "unregistered";
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
        nonMotorInitialValues={props.nonMotorInitialValues}
        commercialAccess={props.commercialAccess}
        preselectedCustomerId={props.preselectedCustomerId}
        sourceIntakeId={props.sourceIntakeId}
        initialDraftRevision={props.initialDraftRevision}
        initialRegistrationMode={props.initialRegistrationMode}
      />
      {props.mode === "create" ? <PolicyIntakeOnboardingContextCard /> : null}
    </PolicyCommercialAccessProvider>
  );
}
