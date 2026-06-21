export { claimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

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

