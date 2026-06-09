export const claimStatuses = [
  "Draft",
  "Accident Reported",
  "Documents Pending",
  "Documents Submitted",
  "Claim Intimated",
  "Surveyor Appointed",
  "Vehicle Inspected",
  "Estimate Submitted",
  "Approval Pending",
  "Repair Started",
  "Repair Completed",
  "Final Bill Submitted",
  "Settlement Under Process",
  "Settled",
  "Rejected",
  "Closed"
];

export const sampleClaims = [
  { claimNo: "CB-2026-0001", customer: "Metro Freight Co.", vehicle: "MH12AB1234", status: "Surveyor Appointed", amount: "₹1,80,000" },
  { claimNo: "CB-2026-0002", customer: "GreenLine Logistics", vehicle: "KA05TR8821", status: "Documents Pending", amount: "₹72,000" },
  { claimNo: "CB-2026-0003", customer: "North Star Carriers", vehicle: "DL01GC4567", status: "Repair Started", amount: "₹2,35,000" }
];

export const navItems = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Vehicles", "/vehicles"],
  ["Policies", "/policies"],
  ["Claims", "/claims"],
  ["Documents", "/documents"],
  ["Timeline", "/timeline"],
  ["Tasks", "/tasks"],
  ["Reports", "/reports"],
  ["Users", "/users"]
] as const;
