import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { CustomerKycForm } from "@/components/customer-portal/customer-kyc-form";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  customerKycStatusLabel,
  customerKycTone,
  loadCustomerProfile,
} from "@/lib/customer-web-phase4-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerKycPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const data = await loadCustomerProfile(account.id);
  const { customer, kyc, kycDocuments } = data;
  const unsupported = Boolean(kyc?.partner_type && kyc.partner_type !== "individual_proprietor");

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Identity & compliance"
        title="KYC"
        description="Individual Customer KYC using the same onboarding application, documents and submission RPC as the Customer App."
        action={<StatusPill tone={customerKycTone(kyc?.status)}>{customerKycStatusLabel(kyc?.status)}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/kyc" />

      {unsupported ? (
        <EmptyCustomerState
          title="This KYC type is not available on Customer Web yet"
          body={`This account has a ${kyc?.partner_type?.replaceAll("_", " ")} onboarding application. Corporate, Dealership and Group KYC remain in the Customer App for now.`}
        />
      ) : (
        <CustomerKycForm
          application={kyc}
          documents={kycDocuments}
          defaultName={customer.contact_name}
          defaultEmail={customer.email ?? ""}
          defaultPhone={customer.phone}
        />
      )}
    </div>
  );
}
