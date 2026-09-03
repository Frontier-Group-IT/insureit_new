import fs from "node:fs";
import assert from "node:assert/strict";

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const forms=read("components/forms.tsx");
assert(forms.includes("VehicleSaveActionChooser"));
assert(!forms.includes("Save Vehicle Only"));
assert(forms.includes('aria-label="Add new customer"'));
assert(!forms.includes("+ Create new customer"));
assert(forms.includes("CustomerSearchField"));
assert(forms.includes('reserveHeaderAction ? "overflow-visible" : "overflow-hidden"'));
assert(!forms.includes('<SelectField\n          variant="onboarding"\n          label="Customer"'));

const customerSearchField=read("components/customer-search-field.tsx");
assert(customerSearchField.includes('role="combobox"'));
assert(customerSearchField.includes('aria-autocomplete="list"'));
assert(customerSearchField.includes('role="listbox"'));
assert(customerSearchField.includes('type="hidden" name={name} value={selectedValue}'));
assert(customerSearchField.includes("option.label.toLocaleLowerCase().includes(normalized)"));
assert(customerSearchField.includes('placeholder="Search customer"'));
assert(customerSearchField.includes('event.key === "ArrowDown"'));
assert(customerSearchField.includes('event.key === "ArrowUp"'));
assert(customerSearchField.includes('event.key === "Enter"'));
assert(customerSearchField.includes('event.key === "Escape"'));
assert(customerSearchField.includes("Select a customer from the matching results."));
assert(customerSearchField.includes("No matching customer"));

const vehicleSaveChooser=read("components/vehicle-save-action-chooser.tsx");
assert(vehicleSaveChooser.includes("Save Vehicle"));
assert(vehicleSaveChooser.includes('type="submit"'));
assert(vehicleSaveChooser.includes('name="next_action"'));
assert(vehicleSaveChooser.includes('value="post_save"'));
assert(vehicleSaveChooser.includes("form.checkValidity()"));
assert(vehicleSaveChooser.includes("onClick={validateBeforeSubmit}"));
assert(vehicleSaveChooser.includes("event.preventDefault()"));
assert(vehicleSaveChooser.includes("useFormStatus"));
assert(vehicleSaveChooser.includes("disabled={pending}"));
assert(vehicleSaveChooser.includes('aria-busy={pending}'));
assert(vehicleSaveChooser.includes('{pending ? "Saving..." : "Save Vehicle"}'));
assert(vehicleSaveChooser.includes("disabled:opacity-55"));
assert(vehicleSaveChooser.includes("AlertModal"));
assert(vehicleSaveChooser.includes("is required before the vehicle can be created."));
assert(!vehicleSaveChooser.includes("ADD POLICY"));

const uiFeedback=read("components/ui-feedback.tsx");
assert(uiFeedback.includes("createPortal"));
assert(uiFeedback.includes('className="fixed inset-0 z-[300] flex items-center justify-center'));
assert(uiFeedback.includes("document.body"));

const vehiclePage=read("app/vehicles/new/page.tsx");
assert(vehiclePage.includes("/customers/new?partner_type=individual_proprietor&return_to=vehicle"));
assert(vehiclePage.includes('"manage_customers"'));

const customerForm=read("app/customers/customer-onboarding-form.tsx");
assert(customerForm.includes("CUSTOMER CREATED"));
assert(customerForm.includes(">OK</button>"));
assert(customerForm.includes(">ADD VEHICLE</button>"));
assert(customerForm.includes("/assets/Custom-Icons/optimized-128/customers.png"));
assert(customerForm.includes("The customer has been created successfully."));
assert(customerForm.includes('label="Save Customer"'));
assert(!customerForm.includes("Save Customer &amp; Continue with Vehicle"));
assert(customerForm.includes('name="return_to"'));
assert(customerForm.includes('if (!formState.customerId || formState.error) return;'));
assert(!customerForm.includes('if (!returnToVehicle || !formState.customerId || formState.error) return;'));
assert(customerForm.includes('router.push(`/vehicles/new?customer_id='));
assert(customerForm.includes('router.push(`/customers?success='));

const customerActions=read("app/customers/actions.ts");
assert(customerActions.includes("customerId: customer.id"));
assert(!customerActions.includes('const returnTo = textValue(formData, "return_to")'));
assert(!customerActions.includes('returnTo === "vehicle"'));

const vehicleActions=read("app/vehicles/vehicle-master-actions.ts");
assert(vehicleActions.includes('nextAction === "post_save"'));
assert(vehicleActions.includes("/vehicles/new?vehicle_saved=1&customer_id="));
assert(vehicleActions.includes("&saved_vehicle_id="));

const vehicleEditPage=read("app/vehicles/[id]/edit/page.tsx");
assert(vehicleEditPage.includes('from("policies").select("id,policy_no,start_date,end_date,policy_documents(id,document_type)").eq("vehicle_id", id)'));
assert(vehicleEditPage.includes("VehiclePolicyFooterSummary"));
assert(vehicleEditPage.includes("footerContent={<VehiclePolicyFooterSummary"));

const vehicleViewPage=read("app/vehicles/[id]/page.tsx");
assert(vehicleViewPage.includes('from("policies").select("id,policy_no,start_date,end_date,policy_documents(id,document_type)").eq("vehicle_id", id)'));
assert(vehicleViewPage.includes("VehiclePolicyFooterSummary"));

const vehiclePolicyFooter=read("components/vehicle-policy-footer-summary.tsx");
assert(vehiclePolicyFooter.includes('type PolicyState = "ACTIVE" | "DUE" | "EXPIRED"'));
assert(vehiclePolicyFooter.includes("PolicyStateIcon"));
assert(vehiclePolicyFooter.includes("CircleCheck"));
assert(vehiclePolicyFooter.includes("CircleAlert"));
assert(vehiclePolicyFooter.includes("TriangleAlert"));
assert(vehiclePolicyFooter.includes('aria-label="Active"'));
assert(vehiclePolicyFooter.includes('aria-label="Expired"'));
assert(vehiclePolicyFooter.includes('aria-label="Due"'));
assert(vehiclePolicyFooter.includes('bg-[#FFF0EA] text-[#D16A4B]'));
assert(!vehiclePolicyFooter.includes('>{state}</span>'));
assert(vehiclePolicyFooter.includes('days <= 30 ? "DUE" : "ACTIVE"'));
assert(vehiclePolicyFooter.includes("/policies/new?customer_id="));
assert(vehiclePolicyFooter.includes("&vehicle_id="));
assert(vehiclePolicyFooter.includes("/policies/\${encodeURIComponent(policy.id)}"));
assert(vehiclePolicyFooter.includes("No policy linked"));
assert(vehiclePolicyFooter.includes("<FilePlus2"));
assert(vehiclePolicyFooter.includes(">\n          <FilePlus2"));
assert(vehiclePolicyFooter.includes("/policies/${encodeURIComponent(policy.id)}/edit"));
assert(vehiclePolicyFooter.includes('border-[#D6E1EE] bg-[#F4F7FB]'));
assert(vehiclePolicyFooter.includes('hover:bg-[#EDF3F9]'));
assert(vehiclePolicyFooter.includes("/policies/documents/${encodeURIComponent(policyCopyId(policy)!)}\/open"));
assert(vehiclePolicyFooter.includes('document.document_type === "policy_copy"'));
assert(!vehiclePolicyFooter.includes("Policy copy unavailable"));
assert(vehiclePolicyFooter.includes("View policy copy"));
assert(vehiclePolicyFooter.includes("<Files"));
assert(vehiclePolicyFooter.includes('bg-[#F3E8FF] text-[#7C3AED]'));
assert(vehiclePolicyFooter.includes('hover:bg-[#EDF3F9]'));
assert(vehicleEditPage.includes("policy_documents(id,document_type)"));
assert(vehicleViewPage.includes("policy_documents(id,document_type)"));

const vehicleCreatedPopup=read("components/vehicle-created-action-popup.tsx");
assert(vehicleCreatedPopup.includes("VEHICLE ADDED"));
assert(vehicleCreatedPopup.includes("The vehicle has been successfully added."));
assert(vehicleCreatedPopup.includes("VehicleCreatedIcon"));
assert(vehicleCreatedPopup.includes("createPortal"));
assert(vehicleCreatedPopup.includes("fixed inset-0"));
assert(vehicleCreatedPopup.includes("place-items-center"));
assert(vehicleCreatedPopup.includes(">\n            OK\n          </Link>"));
assert(vehicleCreatedPopup.includes(">\n            ADD POLICY\n          </Link>"));
assert(vehicleCreatedPopup.includes("/policies/new?customer_id="));
assert(vehicleCreatedPopup.includes("&vehicle_id="));

const registrationFields=read("components/vehicle-registration-fields.tsx");
assert(registrationFields.includes("insureit:vehicle-registration-mode"));
const specificationFields=read("components/vehicle-class-capacity-fields.tsx");
assert(specificationFields.includes('registrationMode === "unregistered"'));
assert(specificationFields.includes('Chassis number{unregistered ? " *" : ""}'));
assert(specificationFields.includes('Engine number{unregistered ? " *" : ""}'));
assert(specificationFields.includes("required={unregistered}"));

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


const nonMotorPolicyForm=read("components/non-motor-policy-form.tsx");
assert(nonMotorPolicyForm.includes('import { CustomerSearchField } from "@/components/customer-search-field";'));
assert(nonMotorPolicyForm.includes('<CustomerSearchField label="Customer / organisation"'));
assert(nonMotorPolicyForm.includes('onSelectionChange={changeCustomer}'));
assert(!nonMotorPolicyForm.includes('<Select label="Customer / organisation"'));


assert(nonMotorPolicyForm.includes('<Section number="02" title="Customer & policy" allowOverflow>'));
assert(nonMotorPolicyForm.includes('<div className="min-w-0"><CustomerSearchField label="Customer / organisation"'));

assert(nonMotorPolicyForm.includes('required portalResults onSelectionChange={changeCustomer}'));
assert(customerSearchField.includes('createPortal('));
assert(customerSearchField.includes('portalResults && mounted'));

assert(policyForm.includes('const isCpmClass=form.vehicleClass.trim().toUpperCase()==="CPM"'));
assert(policyForm.includes('value={isCpmClass?"0":form.tp}'));
assert(policyForm.includes('disabled={isCpmClass} required={!isCpmClass}'));
assert(policyForm.includes('value={isCpmClass?"0":form.cpa}'));
assert(policyForm.includes('cpaOpted:isCpmClass?false'));

assert(policyForm.includes('? <Field label="TP premium" type="number" value="0" disabled readOnly aria-disabled="true" tabIndex={-1} placeholder="Not applicable for CPM"/>'));
assert(policyForm.includes(': <Field label="TP premium" type="number" min="0" value={form.tp}'));
assert(policyForm.includes('? <Field label="CPA amount" type="number" value="0" disabled readOnly aria-disabled="true" tabIndex={-1} placeholder="Not applicable for CPM"/>'));
