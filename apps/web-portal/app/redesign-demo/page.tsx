/**
 * Demo page for reviewing the redesigned intermediary register components
 * WITHOUT requiring Supabase auth or DB access.
 *
 * Open in browser: http://127.0.0.1:3001/redesign-demo
 */

import RedesignedIntermediaryRegister from "@/components/intermediate-redesign/redesigned-register";
import type { IntermediaryRow, ApplicationState, IntermediaryType } from "@/components/intermediate-redesign/types";

function makeRow(overrides: Partial<IntermediaryRow>): IntermediaryRow {
  return {
    id: crypto.randomUUID(),
    intermediary_code: "POSP-1001",
    onboarding_id: null,
    intermediary_type: "posp",
    requested_type: "posp",
    display_name: "Ramesh Kumar",
    mobile: "+91 98765 43210",
    email: "ramesh.kumar@example.com",
    city: "Mumbai",
    iib_status: "pending",
    compliance_status: "pending",
    account_status: "active",
    portal_access_status: "not_created",
    visibility_level: "visible",
    application_id: "app-001",
    updated_at: "2025-07-15T10:30:00Z",
    ...overrides,
  };
}

function makeApp(overrides: Partial<ApplicationState>): ApplicationState {
  return {
    id: "app-001",
    registration_status: "iib_registered",
    partner_status: "active_partner",
    requested_type: "posp",
    final_type: "posp",
    draft_data: {
      associate_name: "Priya Sharma (RM)",
      city: "Mumbai",
      state: "Maharashtra",
      legacy_partner_code: "PART-2001",
    },
    partner_record_id: null,
    ...overrides,
  };
}

export default function RedesignDemoPage() {
  const sampleRows: IntermediaryRow[] = [
    makeRow({
      id: "1",
      display_name: "Ramesh Kumar",
      intermediary_code: "POSP-1001",
      email: "ramesh.kumar@example.com",
      mobile: "+91 98765 43210",
      city: "Mumbai",
      account_status: "active",
      portal_access_status: "not_created",
    }),
    makeRow({
      id: "2",
      display_name: "Sunita Devi",
      intermediary_code: "POSP-1002",
      requested_type: "misp",
      intermediary_type: "misp",
      email: "sunita.devi@business.in",
      mobile: "+91 87654 32109",
      city: "Delhi",
      account_status: "active",
      portal_access_status: "invited",
    }),
    makeRow({
      id: "3",
      display_name: "Global Insurance Partners",
      intermediary_code: "PART-2001",
      requested_type: "misp",
      intermediary_type: "partner",
      email: "contact@globalinsurance.in",
      mobile: "+91 76543 21098",
      city: "Bangalore",
      account_status: "active",
      portal_access_status: "active",
    }),
    makeRow({
      id: "4",
      display_name: "Mohit Gupta",
      intermediary_code: "POSP-1003",
      email: "mohit.gupta@example.com",
      mobile: "+91 65432 10987",
      city: "Hyderabad",
      account_status: "suspended",
      portal_access_status: "active",
    }),
    makeRow({
      id: "5",
      display_name: "City Care Insurance",
      intermediary_code: "PART-2002",
      requested_type: "misp",
      intermediary_type: "partner",
      email: "admin@citycare.in",
      mobile: "+91 99887 76655",
      city: "Chennai",
      account_status: "inactive",
      portal_access_status: "disabled",
    }),
  ];

  const applicationMap = new Map<string, ApplicationState>([
    ["app-001", makeApp({ id: "app-001", registration_status: "iib_registered", partner_status: "active_partner", requested_type: "posp", draft_data: { associate_name: "Priya Sharma", city: "Mumbai", state: "Maharashtra", legacy_partner_code: "PART-2001" } })],
    ["app-002", makeApp({ id: "app-002", registration_status: "iib_registered", partner_status: "active_partner", requested_type: "misp", draft_data: { associate_name: "Amit Patel", city: "Delhi", state: "Delhi" } })],
    ["app-003", makeApp({ id: "app-003", registration_status: "iib_registered", partner_status: "active_partner", requested_type: "misp", draft_data: { associate_name: "Neha Reddy", city: "Bangalore", state: "Karnataka", legacy_partner_code: "PART-2002" } })],
    ["app-004", makeApp({ id: "app-004", registration_status: "iib_review_pending", partner_status: null, requested_type: "posp", draft_data: { associate_name: null, city: "Hyderabad", state: "Telangana" } })],
    ["app-005", makeApp({ id: "app-005", registration_status: "agreement_pending", partner_status: null, requested_type: "misp", draft_data: { associate_name: null, city: "Chennai", state: "Tamil Nadu" } })],
  ]);

  // Fix up application_id on sample rows
  sampleRows[0].application_id = "app-001";
  sampleRows[1].application_id = "app-002";
  sampleRows[2].application_id = "app-003";
  sampleRows[3].application_id = "app-004";
  sampleRows[4].application_id = "app-005";

  const counts = {
    posp: 3,
    misp: 2,
    partner: 2,
  };

  return (
    <div>
      {/* Overview view (selectedType = null) */}
      <section className="mb-12">
        <h1 className="text-[20px] font-semibold text-neutral-800 mb-4">Overview — Redesigned</h1>
        <RedesignedIntermediaryRegister
          selectedType={null}
          rows={sampleRows.filter((r) => r.intermediary_type === "posp" || r.intermediary_type === "misp")}
          applicationMap={applicationMap}
          counts={counts}
          canCreate={true}
          canReview={true}
          search=""
          success=""
          error=""
        />
      </section>

      {/* POSP view */}
      <section className="mb-12">
        <h1 className="text-[20px] font-semibold text-neutral-800 mb-4">POSP Register — Redesigned</h1>
        <RedesignedIntermediaryRegister
          selectedType={"posp" as IntermediaryType}
          rows={sampleRows.filter((r) => r.intermediary_type === "posp")}
          applicationMap={applicationMap}
          counts={counts}
          canCreate={true}
          canReview={true}
          search=""
          success=""
          error=""
        />
      </section>

      {/* MISP view */}
      <section className="mb-12">
        <h1 className="text-[20px] font-semibold text-neutral-800 mb-4">MISP Register — Redesigned</h1>
        <RedesignedIntermediaryRegister
          selectedType={"misp" as IntermediaryType}
          rows={sampleRows.filter((r) => r.intermediary_type === "misp")}
          applicationMap={applicationMap}
          counts={counts}
          canCreate={true}
          canReview={true}
          search=""
          success=""
          error=""
        />
      </section>

      {/* Partners view */}
      <section>
        <h1 className="text-[20px] font-semibold text-neutral-800 mb-4">Partners Register — Redesigned</h1>
        <RedesignedIntermediaryRegister
          selectedType={"partner" as IntermediaryType}
          rows={sampleRows.filter((r) => r.intermediary_type === "partner")}
          applicationMap={applicationMap}
          counts={counts}
          canCreate={false}
          canReview={true}
          search=""
          success=""
          error=""
        />
      </section>

      {/* Success / error banner demo */}
      <section className="mt-8 mb-12">
        <h1 className="text-[20px] font-semibold text-neutral-800 mb-4">With Success Banner</h1>
        <RedesignedIntermediaryRegister
          selectedType={"posp" as IntermediaryType}
          rows={sampleRows.filter((r) => r.intermediary_type === "posp")}
          applicationMap={applicationMap}
          counts={counts}
          canCreate={true}
          canReview={true}
          search=""
          success="portal_login_invited"
          error=""
        />
      </section>
    </div>
  );
}
