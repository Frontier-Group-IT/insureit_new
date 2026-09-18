export const BUSINESS_MIS_HEADERS = [
  "Month",
  "Policy Issuance Date",
  "RM Name",
  "Intermediary Type",
  "Lead Source",
  "Intermediary Code",
  "Registration No.",
  "Insured Name",
  "OD Premium",
  "Third Party Premium",
  "CPA",
  "Net Premium",
  "Policy Number",
  "Insurance Company",
  "Valid Upto",
  "Pay-in % OD",
  "OD Pay-in Amount",
  "Pay-in % TP",
  "TP Pay-in Amount",
  "Total Pay-in",
  "Bill Number",
  "Bill Amount",
  "Bill Date",
  "Difference",
  "TDS",
  "Payout OD %",
  "Payout TP %",
  "Gross Payout",
  "Retention",
  "Paid Amount",
  "Paid Date",
  "UTR Details",
] as const;

export const BUSINESS_MIS_HIDDEN_HEADERS = ["System Policy ID", "System Payout ID"] as const;
export const BUSINESS_MIS_EDITABLE_COLUMNS = new Set([20, 21, 22, 23, 29, 30, 31]);
export const BUSINESS_MIS_AMOUNT_COLUMNS = new Set([8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29]);
export const BUSINESS_MIS_PERCENT_COLUMNS = new Set([15, 17, 25, 26]);
export const BUSINESS_MIS_DATE_COLUMNS = new Set([1, 14, 22, 30]);
export const BUSINESS_MIS_TOTAL_COLUMNS = [8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29] as const;

export type BusinessMisCell = string | number | Date;
export type BusinessMisClientCell = string | number;
export type BusinessMisRow = BusinessMisCell[];
