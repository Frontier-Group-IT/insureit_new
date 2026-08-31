import fs from "node:fs";
import assert from "node:assert/strict";

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const forms=read("components/forms.tsx");
assert(forms.includes("VehicleSaveActionChooser"));
assert(!forms.includes("Save Vehicle Only"));
assert(forms.includes('aria-label="Add new customer"'));
assert(!forms.includes("+ Create new customer"));

const vehicleSaveChooser=read("components/vehicle-save-action-chooser.tsx");
assert(vehicleSaveChooser.includes("Save Vehicle"));
assert(vehicleSaveChooser.includes('name="next_action"'));
assert(vehicleSaveChooser.includes('value="vehicle"'));
assert(vehicleSaveChooser.includes('value="policy"'));
assert(vehicleSaveChooser.includes(">\n                OK\n              </button>"));
assert(vehicleSaveChooser.includes(">\n                ADD POLICY\n              </button>"));
assert(!vehicleSaveChooser.includes("Save Vehicle &amp; Continue to Policy"));
assert(!vehicleSaveChooser.includes(">\n                Cancel\n              </button>"));
assert(vehicleSaveChooser.includes("form.checkValidity()"));
assert(vehicleSaveChooser.includes("form.reportValidity()"));
assert(vehicleSaveChooser.includes("onClick={openSaveChoices}"));

const vehiclePage=read("app/vehicles/new/page.tsx");
assert(vehiclePage.includes("/customers/new?partner_type=individual_proprietor&return_to=vehicle"));
assert(vehiclePage.includes('"manage_customers"'));

const customerForm=read("app/customers/customer-onboarding-form.tsx");
assert(customerForm.includes(">OK</button>"));
assert(customerForm.includes(">ADD VEHICLE</button>"));
assert(!customerForm.includes("Save Customer &amp; Continue with Vehicle"));
assert(customerForm.includes('name="return_to"'));

const customerActions=read("app/customers/actions.ts");
assert(customerActions.includes('returnTo === "vehicle"'));
assert(customerActions.includes("/vehicles/new?customer_id="));

const vehicleActions=read("app/vehicles/vehicle-master-actions.ts");
assert(vehicleActions.includes('nextAction === "post_save"'));
assert(vehicleActions.includes("/vehicles/new?vehicle_saved=1&customer_id="));
assert(vehicleActions.includes("&saved_vehicle_id="));

const vehicleCreatedPopup=read("components/vehicle-created-action-popup.tsx");
assert(vehicleCreatedPopup.includes("createPortal"));
assert(vehicleCreatedPopup.includes("fixed inset-0"));
assert(vehicleCreatedPopup.includes("place-items-center"));
assert(vehicleCreatedPopup.includes(">\n          OK\n        </Link>"));
assert(vehicleCreatedPopup.includes(">\n          ADD POLICY\n        </Link>"));
assert(vehicleCreatedPopup.includes("/policies/new?customer_id="));
assert(vehicleCreatedPopup.includes("&vehicle_id="));

const handoff=read("app/policy-intakes/handoff-actions.ts");
assert(handoff.includes("policy_intake_onboarding_drafts"));
assert(handoff.includes('.eq("revision",expectedRevision)'));

const policyForm=read("components/policy-unified-form.tsx");
assert(policyForm.includes("Save &amp; Return to Intake"));
assert(policyForm.includes("savePolicyIntakeOnboardingDraft"));
assert(policyForm.includes("draftRevisionRef"));

const policyActions=read("app/policies/policy-onboarding-actions.ts");
assert(policyActions.includes("finalize_policy_intake_motor_v1"));
assert(policyActions.includes("sourceIntakeId"));

const policyList=read("app/policies/page.tsx");
assert(!policyList.includes("PolicyIntakeCompletionBridge"),"browser completion bridge must not remain authoritative");

const migration=read("../../supabase/migrations/20260831123000_vehicle_policy_intake_resume.sql");
assert(migration.includes("create table if not exists public.policy_intake_onboarding_drafts"));
assert(migration.includes("for update"));
assert(migration.includes("public.onboard_motor_policy_commercial_status_v2(p_payload)"));
assert(migration.includes("status='completed'"));
assert(migration.includes("delete from public.policy_intake_onboarding_drafts"));

console.log("vehicle + policy intake resume regression: ok");
