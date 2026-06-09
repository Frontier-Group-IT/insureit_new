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
] as const;

export type ClaimStatus = (typeof claimStatuses)[number];

export const sampleClaims: Array<{
  claimNo: string;
  customer: string;
  vehicle: string;
  status: ClaimStatus;
  amount: string;
  priority: "High" | "Medium" | "Low";
  age: string;
  owner: string;
}> = [
  { claimNo: "CB-2026-0001", customer: "Metro Freight Co.", vehicle: "MH12AB1234", status: "Surveyor Appointed", amount: "₹1,80,000", priority: "High", age: "3 days", owner: "Asha Mehta" },
  { claimNo: "CB-2026-0002", customer: "GreenLine Logistics", vehicle: "KA05TR8821", status: "Documents Pending", amount: "₹72,000", priority: "Medium", age: "1 day", owner: "Ravi Shah" },
  { claimNo: "CB-2026-0003", customer: "North Star Carriers", vehicle: "DL01GC4567", status: "Repair Started", amount: "₹2,35,000", priority: "High", age: "8 days", owner: "Neha Rao" },
  { claimNo: "CB-2026-0004", customer: "Shakti Roadways", vehicle: "GJ18XX9012", status: "Final Bill Submitted", amount: "₹96,500", priority: "Low", age: "14 days", owner: "Imran Khan" }
];

export const sampleCustomers = [
  { code: "CB-CUST-0001", name: "Metro Freight Co.", contact: "Sanjay Patel", phone: "+91 98765 43210", city: "Mumbai", status: "Active", vehicles: 18 },
  { code: "CB-CUST-0002", name: "GreenLine Logistics", contact: "Priya Menon", phone: "+91 98765 44110", city: "Bengaluru", status: "Active", vehicles: 32 },
  { code: "CB-CUST-0003", name: "North Star Carriers", contact: "Harish Gupta", phone: "+91 98765 45210", city: "Delhi", status: "Review", vehicles: 11 },
  { code: "CB-CUST-0004", name: "Shakti Roadways", contact: "Mehul Joshi", phone: "+91 98765 46210", city: "Ahmedabad", status: "Active", vehicles: 24 }
];

export const sampleVehicles = [
  { vehicleNo: "MH12AB1234", customer: "Metro Freight Co.", type: "Goods carrier", policy: "POL-CV-10001", fitness: "Valid", status: "Active" },
  { vehicleNo: "KA05TR8821", customer: "GreenLine Logistics", type: "Container truck", policy: "POL-CV-10002", fitness: "Expiring soon", status: "Attention" },
  { vehicleNo: "DL01GC4567", customer: "North Star Carriers", type: "Bus", policy: "POL-CV-10003", fitness: "Valid", status: "Active" },
  { vehicleNo: "GJ18XX9012", customer: "Shakti Roadways", type: "Tanker", policy: "POL-CV-10004", fitness: "Valid", status: "Active" }
];

export const samplePolicies = [
  { policyNo: "POL-CV-10001", insurer: "Sample Insurance Ltd.", customer: "Metro Freight Co.", vehicle: "MH12AB1234", validity: "2026-04-01 to 2027-03-31", status: "Active" },
  { policyNo: "POL-CV-10002", insurer: "Reliable General Insurance", customer: "GreenLine Logistics", vehicle: "KA05TR8821", validity: "2026-01-15 to 2027-01-14", status: "Active" },
  { policyNo: "POL-CV-10003", insurer: "National Commercial Cover", customer: "North Star Carriers", vehicle: "DL01GC4567", validity: "2025-08-01 to 2026-07-31", status: "Renewal due" },
  { policyNo: "POL-CV-10004", insurer: "Sample Insurance Ltd.", customer: "Shakti Roadways", vehicle: "GJ18XX9012", validity: "2026-02-01 to 2027-01-31", status: "Active" }
];

export const navItems = [
  ["Dashboard", "/dashboard", "▦"],
  ["Customers", "/customers", "◉"],
  ["Vehicles", "/vehicles", "▣"],
  ["Policies", "/policies", "◫"],
  ["Claims", "/claims", "◆"],
  ["Documents", "/documents", "◧"],
  ["Timeline", "/timeline", "◷"],
  ["Tasks", "/tasks", "✓"],
  ["Reports", "/reports", "▥"],
  ["Users", "/users", "●"]
] as const;
