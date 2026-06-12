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

export const navItems = [
  ["Dashboard", "/dashboard", "D"],
  ["Customers", "/customers", "C"],
  ["Vehicles", "/vehicles", "V"],
  ["Policies", "/policies", "P"],
  ["Claims", "/claims", "CL"],
  ["Documents", "/documents", "DO"],
  ["Timeline", "/timeline", "T"],
  ["Tasks", "/tasks", "TA"],
  ["Reports", "/reports", "R"],
  ["Organization", "/organization", "O"],
  ["Users", "/users", "U"]
] as const;
