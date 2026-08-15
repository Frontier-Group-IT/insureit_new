from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "apps/web-portal/app/policies/policy-onboarding-conflicts.ts"
FORM = ROOT / "apps/web-portal/components/policy-unified-form.tsx"
ACTIONS = ROOT / "apps/web-portal/app/policies/policy-onboarding-actions.ts"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one {label} block, found {text.count(old)}")
    path.write_text(text.replace(old, new, 1))


replace_once(
    HELPER,
    '''  const identifiedVehicle = mode === "registered" ? registrationVehicle : (chassisVehicle ?? engineVehicle);\n\n  const policyNumber = String(payload.policy.policyNumber ?? "").trim().toUpperCase();''',
    '''  const identifiedVehicle = mode === "registered" ? registrationVehicle : (chassisVehicle ?? engineVehicle);\n  if (identifiedVehicle) {\n    const storedChassis = normalizeIdentity(identifiedVehicle.chassis_no);\n    const storedEngine = normalizeIdentity(identifiedVehicle.engine_no);\n    if (chassis && storedChassis && chassis !== storedChassis) {\n      return vehicleConflict(\n        identifiedVehicle,\n        enteredIdentity,\n        `The entered chassis number does not match the chassis already stored for ${identifiedVehicle.vehicle_no}. Review the vehicle details before continuing.`,\n      );\n    }\n    if (engine && storedEngine && engine !== storedEngine) {\n      return vehicleConflict(\n        identifiedVehicle,\n        enteredIdentity,\n        `The entered engine number does not match the engine already stored for ${identifiedVehicle.vehicle_no}. Review the vehicle details before continuing.`,\n      );\n    }\n  }\n\n  const policyNumber = String(payload.policy.policyNumber ?? "").trim().toUpperCase();''',
    "stored vehicle identity guard",
)

replace_once(
    FORM,
    '''  function chooseCustomer(id:string|null){if(!pendingPayload)return;setCustomerCandidates(null);runCreate({...pendingPayload,resolution:{...pendingPayload.resolution,selectedCustomerId:id,createNewCustomer:!id}});}\n  function resolveOwnership(decision:"keep_existing"|"transfer"){if(!pendingPayload||!ownershipConflict)return;setOwnershipConflict(null);runCreate({...pendingPayload,resolution:{...pendingPayload.resolution,selectedCustomerId:decision==="keep_existing"?ownershipConflict.customerId:pendingPayload.resolution?.selectedCustomerId,createNewCustomer:decision==="transfer"?pendingPayload.resolution?.createNewCustomer:false,ownershipDecision:decision,transferReason:"Confirmed during policy onboarding"}});}''',
    '''  function chooseCustomer(id:string|null){if(!pendingPayload)return;const selected=id?customerCandidates?.find(candidate=>candidate.id===id):null;if(selected)setForm(current=>({...current,insuredName:selected.name,phoneNo:selected.phone}));setCustomerCandidates(null);runCreate({...pendingPayload,customer:selected?{...pendingPayload.customer,name:selected.name,phone:selected.phone}:pendingPayload.customer,resolution:{...pendingPayload.resolution,selectedCustomerId:id,createNewCustomer:!id}});}\n  function resolveOwnership(decision:"keep_existing"|"transfer"){if(!pendingPayload||!ownershipConflict)return;const existingCustomer=ownershipConflict;if(decision==="keep_existing")setForm(current=>({...current,insuredName:existingCustomer.customerName,phoneNo:existingCustomer.customerPhone||current.phoneNo}));setOwnershipConflict(null);runCreate({...pendingPayload,customer:decision==="keep_existing"?{...pendingPayload.customer,name:existingCustomer.customerName,phone:existingCustomer.customerPhone||pendingPayload.customer.phone}:pendingPayload.customer,resolution:{...pendingPayload.resolution,selectedCustomerId:decision==="keep_existing"?ownershipConflict.customerId:pendingPayload.resolution?.selectedCustomerId,createNewCustomer:decision==="transfer"?pendingPayload.resolution?.createNewCustomer:false,ownershipDecision:decision,transferReason:"Confirmed during policy onboarding"}});}''',
    "customer resolution handlers",
)

replace_once(
    ACTIONS,
    '''      rpcCustomer = { ...rpcCustomer, name: existingCustomer.contact_name, phone: existingCustomer.phone, email: "", address: "", city: "", district: "", state: "", pincode: "" };''',
    '''      rpcCustomer = { ...rpcCustomer, name: existingCustomer.contact_name, phone: existingCustomer.phone, email: "", address: "", city: "", district: "", state: "", pincode: "", source: "" };''',
    "existing customer preservation",
)

replace_once(
    ACTIONS,
    '''  } catch {\n    return { ok: false, kind: "database", error: "We couldn't save the policy. Please try again." };\n  }''',
    '''  } catch {\n    return { ok: false, kind: "database", error: "We couldn't complete the policy booking. Your entered form details are still intact. Review the details and try again." };\n  }''',
    "generic catch",
)

print("Policy conflict follow-up patch applied")
