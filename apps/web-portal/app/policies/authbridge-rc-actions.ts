"use server";

import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";

type UnknownRecord = Record<string, unknown>;

export type PolicyRcReview = {
  registrationNumber: string;
  registrationDate: string | null;
  registrationStatus: string | null;
  statusAsOn: string | null;
  fitnessExpiryDate: string | null;
  taxUpto: string | null;
  rtoName: string | null;
  rtoState: string | null;
  ownerName: string | null;
  ownerSerialNumber: string | null;
  ownerCity: string | null;
  ownerDistrict: string | null;
  ownerState: string | null;
  ownerPincode: string | null;
  permanentAddress: string | null;
  presentAddress: string | null;
  mobileNumber: string | null;
  vehicleClass: string | null;
  vehicleCategory: string | null;
  bodyType: string | null;
  make: string | null;
  model: string | null;
  fuelType: string | null;
  manufactureDate: string | null;
  manufacturingYear: string | null;
  engineCapacity: string | null;
  seatingCapacity: string | null;
  standingCapacity: string | null;
  sleeperCapacity: string | null;
  grossWeight: string | null;
  unladenWeight: string | null;
  wheelBase: string | null;
  cylinders: string | null;
  color: string | null;
  normsType: string | null;
  isCommercial: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  financed: string | null;
  financerName: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  insuranceUpto: string | null;
  permitIssueDate: string | null;
  permitNumber: string | null;
  permitType: string | null;
  permitValidFrom: string | null;
  permitValidUpto: string | null;
  nationalPermitIssuedBy: string | null;
  nationalPermitNumber: string | null;
  nationalPermitUpto: string | null;
  pucNumber: string | null;
  pucUpto: string | null;
  nonUseStatus: string | null;
  nonUseFrom: string | null;
  nonUseTo: string | null;
  blacklistStatus: string | null;
  transactionId: string | null;
  providerTransactionId: string | null;
  lookedUpAt: string | null;
};

export type PolicyRcLookupResult =
  | { ok: true; review: PolicyRcReview }
  | { ok: false; error: string };

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(source: UnknownRecord, key: string) {
  const value = source[key];
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function yearOnly(value: string | null) {
  return value?.match(/(?:19|20)\d{2}/)?.[0] ?? null;
}

function stateFromRto(value: string | null) {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) ?? null : null;
}

export async function lookupPolicyRegistrationRc(registrationNumber: string): Promise<PolicyRcLookupResult> {
  try {
    const response = await lookupAuthbridgeRc(registrationNumber);
    const root = record(response.data);
    const msg = record(root.msg);
    const registration = record(msg["Registration Details"]);
    const vehicle = record(msg["Vehicle Details"]);
    const owner = record(msg["Owners Details"]);
    const insurance = record(msg["Insurance Details"]);
    const finance = record(msg["Hypothecation Details"]);
    const rcStatus = record(msg["RC Status"]);

    const rtoName = text(registration, "RTO");
    const manufactureDate = text(vehicle, "Manufacture Date");
    const normalizedRegistration = normalizeVehicleRegistrationNumber(
      text(registration, "Registration Number") ?? text(vehicle, "Vehicle Number") ?? response.registrationNumber ?? registrationNumber,
    );

    return {
      ok: true,
      review: {
        registrationNumber: normalizedRegistration,
        registrationDate: text(registration, "Registration Date"),
        registrationStatus: text(registration, "Status"),
        statusAsOn: text(registration, "Status As On"),
        fitnessExpiryDate: text(registration, "Fitness Date/RC Expiry Date"),
        taxUpto: text(registration, "Vehicle Tax Up to") ?? text(registration, "Tax Upto"),
        rtoName,
        rtoState: stateFromRto(rtoName) ?? text(owner, "Present Address State") ?? text(owner, "Permanant Address State"),
        ownerName: text(owner, "Owners Name"),
        ownerSerialNumber: text(owner, "Owners Number") ?? text(vehicle, "Owner Serial Number"),
        ownerCity: text(owner, "Present Address City") ?? text(owner, "Permanant Address City"),
        ownerDistrict: text(owner, "Present Address District") ?? text(owner, "Permanant Address District"),
        ownerState: text(owner, "Present Address State") ?? text(owner, "Permanant Address State"),
        ownerPincode: text(owner, "Present Address Pincode") ?? text(owner, "Permanant Address Pincode"),
        permanentAddress: text(owner, "Permanent Address") ?? text(owner, "Split Permanant Address"),
        presentAddress: text(owner, "Present Address") ?? text(owner, "Split Present Address"),
        mobileNumber: text(vehicle, "Mobile Number"),
        vehicleClass: text(vehicle, "Vehicle Class"),
        vehicleCategory: text(vehicle, "Vehicle Category"),
        bodyType: text(vehicle, "Body Type"),
        make: text(vehicle, "Maker/Manufacturer"),
        model: text(vehicle, "Model / Makers Class"),
        fuelType: text(vehicle, "Fuel Type"),
        manufactureDate,
        manufacturingYear: yearOnly(manufactureDate),
        engineCapacity: text(vehicle, "Engine Capacity"),
        seatingCapacity: text(vehicle, "Seating Capacity"),
        standingCapacity: text(vehicle, "Vehicle Standing Capacity"),
        sleeperCapacity: text(vehicle, "sleeper Capacity"),
        grossWeight: text(vehicle, "Gross Weight"),
        unladenWeight: text(vehicle, "Unloading Weight"),
        wheelBase: text(vehicle, "Wheel Base"),
        cylinders: text(vehicle, "No of cylinder"),
        color: text(vehicle, "Color"),
        normsType: text(vehicle, "Norms Type"),
        isCommercial: text(vehicle, "Is Commercial"),
        chassisNumber: text(vehicle, "Chassis Number"),
        engineNumber: text(vehicle, "Engine Number"),
        financed: text(finance, "Financed"),
        financerName: text(finance, "Financer Name"),
        insuranceCompany: text(insurance, "Insurance Company"),
        insurancePolicyNumber: text(insurance, "Policy Number"),
        insuranceUpto: text(insurance, "Insurance To Date/Insurance Upto"),
        permitIssueDate: text(rcStatus, "Permit Issue Date"),
        permitNumber: text(rcStatus, "Permit Number"),
        permitType: text(rcStatus, "Permit Type"),
        permitValidFrom: text(rcStatus, "Permit Vald From"),
        permitValidUpto: text(rcStatus, "Permit Valid Upto"),
        nationalPermitIssuedBy: text(rcStatus, "National Permit Issued By"),
        nationalPermitNumber: text(rcStatus, "National Permit Number"),
        nationalPermitUpto: text(rcStatus, "National Permit Upto"),
        pucNumber: text(rcStatus, "PUCC NO"),
        pucUpto: text(rcStatus, "PUCC Upto"),
        nonUseStatus: text(rcStatus, "Non Use Status"),
        nonUseFrom: text(rcStatus, "Non Use From"),
        nonUseTo: text(rcStatus, "Non Use To"),
        blacklistStatus: text(vehicle, "Blacklist Status"),
        transactionId: response.transactionId ?? null,
        providerTransactionId: text(root, "ts_transaction_id"),
        lookedUpAt: response.lookedUpAt ?? null,
      },
    };
  } catch {
    return { ok: false, error: "Vehicle details could not be fetched right now. Please verify the registration number and try again." };
  }
}
