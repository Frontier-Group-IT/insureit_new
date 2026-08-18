// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineNewIndiaCommercialPolicy } from "../lib/policy-ocr-new-india-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { refineNewIndiaStructuredPolicy } from "../lib/policy-ocr-new-india-structured-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";

type Expected = Record<string, string>;
type Case = { name: string; pages: string[]; expected: Expected };

const expected: Expected = {
  insurer_name: "The New India Assurance Company Limited",
  policy_product: "Package",
  policy_number: "80000031250350127994",
  idv: "4800000",
  od_premium: "33984",
  tp_premium: "44170",
  cpa_premium: "325",
  cpa_opted: "Yes",
  policy_start_date: "2025-12-05",
  policy_end_date: "2026-12-04",
  total_premium: "78479",
  tax_amount: "8414",
  gross_premium: "86893",
};

const enhancedExpected: Expected = {
  insurer_name: "The New India Assurance Company Limited",
  policy_product: "Package",
  policy_number: "31280031260300009999",
  idv: "906000",
  od_premium: "6121",
  tp_premium: "16369",
  cpa_premium: "275",
  cpa_opted: "Yes",
  policy_start_date: "2026-08-09",
  policy_end_date: "2027-08-08",
  total_premium: "22765",
  tax_amount: "2011",
  gross_premium: "24776",
};

const header = `The New India Assurance Co. Ltd.\nGOODS CARRYING VEHICLE PACKAGE POLICY-CERTIFICATE CUM POLICY SCHEDULE CUM RECEIPT\nPolicy No. 80000031250350127994\nPolicy Issued On 04-DEC-2025 (16:12)\nMotor Liability Period 05-DEC-2025(00:00) To 04-DEC-2026(Midnight)\nOwn Damage Period 05-DEC-2025(00:00) To 04-DEC-2026(Midnight)`;

const idv = `Vehicle Type Vehicle Sub Class Built Type IDV of Chassis IDVof Body Elec. Accessories\nA1- Public Carrier-GCV TIPPER Fully Built 4,800,000 0 0\nNon-Elec. Accessories CNG/LPG Kit IDV of Trailer Total IDV\n0 0 0 4,800,000`;

const premium = `Schedule of Premium (Amount in Rs.)\nOwn Damage Premium (A)\nVehicle 20,712 Voluntary Deductibles (0) (IMT-22A) 0\nAdditional GVW Loading 1553 Anti Theft Device (IMT-10) 0\nNo Claim Bonus (20%) 5121\nSub Total (Deductibles) 5,121\nSub Total (Basic Premium) 22,265\nAdd On Coverages (Refer Note 6) 13,500\nIMT -23 3,340\nSub Total-Addition 39,105 Net Own Damage Premium (A) 33,984\nLiability Premium (B)\nBasic Third Party Liability 43,950\nLegal Liability For Paid Driver (IMT-28) 50\nLegal Liability For Cleaner / Conductor / Helper (for 1 persons) (IMT-29) 50\nPA Cover For Owner Driver Of Rs. 1500000 (IMT-15)\n325\nPA Cover For Cleaner / Conductor / Helper 100000 Each (IMT-17) 60\nPA cover for Paid Driver of Rs 100000 (IMT-17) 60 Net Liability Premium (B) 44495\nTotal Premium (A+B) 78479\nIGST (5% of Basic TP + 18% of rest of Premium) 8414\nGross Premium Paid 86893`;

const previous = `Previous Insurer : NIA\nPrevious Policy No. : 80000031240350141855 05-DEC-2024 To 04-DEC-2025`;

const liabilityWordings = `Limits of Liability Clause\nUnder Section II-1 (ii) of the policy-Damage to third party property is Rs.7.5lakhs PA Cover Under Section III for Owner-Driver is Rs. 1500000.`;

const enhancedSchedule = `THE NEW INDIA ASSURANCE CO. LTD.\nPOLICY SCHEDULE CUM CERTIFICATE OF INSURANCE\nCommercial Vehicle Package Policy - Enhanced Covers\nPolicy Number :31280031260300009999\nPOLICY DETAILS\nPeriod of cover 09/08/2026 12:00:01 AM to 08/08/2027 11:59:59 PM\nINSURED DECLARED VALUE (Rs)\nVehicle Trailer Non-Elec Acc Electrical Acc Bi-fuel/CNG/LPG kit Total Value\n906000 0 0 0 0 906000\nENHANCED COVER\nSCHEDULE OF PREMIUM\nOwn Damage Liability\nBasic OD Premium\n2053\nBasic TP Premium\n(+)Compulsory PA Premium for Owner Driver(Sum\nInsured Rs 1500000)\n(+)LL to paid driver conductor cleaner employed for oprn\n(+)PA Cover for Paid Drivers Cleaner Conductor No of Paid Drivers\n(+)LL to paid driver and/or conductor and/or cleaner employed for operation\n16049\n275\n100\n100\n120\nCalculated OD Premium 6121 Calculated TP Premium 16644\nTotal OD Premium (Rs) 6121 Total TP Premium (Rs) 16644\nNet Premium (Rs) 22,765\nGST (Rs) 2,011\nTotal Payable (Rs) 24,776`;

const cases: Case[] = [
  {
    name: "real New India schedule layout",
    pages: [`${header}\n${idv}\n${previous}`, `${premium}\n${header}`, liabilityWordings],
    expected,
  },
  {
    name: "NCB and subtotal values do not become OD",
    pages: [`${header}\n${idv}`, `${premium.replace("Sub Total-Addition 39,105 Net Own Damage Premium (A) 33,984", "No Claim Bonus (20%) 5121 Sub Total-Addition 39,105 Net Own Damage Premium (A) 33,984")}`],
    expected,
  },
  {
    name: "liability premium is normalized by subtracting CPA",
    pages: [`${header}\n${idv}`, `${premium}\nNet Liability Premium (B) 44495\nPA Cover For Owner Driver Of Rs. 1500000 (IMT-15) 325`],
    expected,
  },
  {
    name: "coverage limit does not become CPA premium",
    pages: [`${header}\n${idv}`, `${premium}`, `${liabilityWordings}\nPA Cover Under Section III for Owner-Driver is Rs. 1500000.`],
    expected,
  },
  {
    name: "previous policy number does not override current policy",
    pages: [`${previous}\n${header}\n${idv}`, `${premium}\n${previous}\n${header}`],
    expected,
  },
  {
    name: "enhanced commercial vehicle schedule uses period-of-cover and total premium rows",
    pages: [enhancedSchedule],
    expected: enhancedExpected,
  },
];

let failures = 0;
for (const testCase of cases) {
  const base = parsePolicyDocument(testCase.pages);
  const problems: string[] = [];
  if (base.parserId !== "new_india_motor_v1") {
    problems.push(`base parser: expected new_india_motor_v1, got ${base.parserId}`);
  }
  const result = base.parserId === "new_india_motor_v1"
    ? refineNewIndiaCommercialPolicy(testCase.pages, base)
    : base;
  const actual = Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
  for (const [key, value] of Object.entries(testCase.expected)) {
    if (actual[key] !== value) problems.push(`${key}: expected ${value}, got ${actual[key] ?? "<missing>"}`);
  }
  if (result.warnings.some((warning) => /premium cross-check failed|does not match printed gross|does not match Gross Premium Paid/i.test(warning))) {
    problems.push("premium reconciliation unexpectedly failed");
  }

  if (problems.length) {
    failures += 1;
    console.error(`FAIL: ${testCase.name}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  } else {
    console.log(`PASS: ${testCase.name}`);
  }
}

const flattenedLiveLike = `THE NEW INDIA ASSURANCE CO. LTD.\nCommercial Vehicle Package Policy - Enhanced Covers\nPolicy Number :31280031260300009999\nCompulsory PA Premium for Owner Driver\n275`;
const liveBase = parsePolicyDocument([flattenedLiveLike]);
const liveTextResult = refineNewIndiaCommercialPolicy([flattenedLiveLike], liveBase);
const liveTables = [
  { page: 1, rows: [["POLICY DETAILS"], ["Period of cover", "09/08/2026 12:00:01 AM to 08/08/2027 11:59:59 PM"]] },
  { page: 1, rows: [["INSURED DECLARED VALUE (Rs)"], ["Vehicle", "Trailer", "Non-Elec Acc", "Electrical Acc", "Bi-fuel/CNG/LPG kit", "Total Value"], ["906000", "0", "0", "0", "0", "906000"]] },
  { page: 2, rows: [
    ["Compulsory PA Premium for Owner Driver", "275"],
    ["Total OD Premium (Rs)", "6121", "Total TP Premium (Rs)", "16644"],
    ["Net Premium (Rs)", "22,765"],
    ["GST (Rs)", "2,011"],
    ["Total Payable (Rs)", "24,776"],
  ] },
];
const liveStructured = refineNewIndiaStructuredPolicy(liveTables, liveTextResult);
const liveActual = Object.fromEntries(liveStructured.fields.map((field) => [field.key, field.value]));
const liveExpected: Expected = {
  idv: "906000",
  od_premium: "6121",
  tp_premium: "16369",
  cpa_premium: "275",
  policy_start_date: "2026-08-09",
  policy_end_date: "2027-08-08",
};
const liveProblems = Object.entries(liveExpected)
  .filter(([key, value]) => liveActual[key] !== value)
  .map(([key, value]) => `${key}: expected ${value}, got ${liveActual[key] ?? "<missing>"}`);
if (liveProblems.length) {
  failures += 1;
  console.error("FAIL: live-like fragmented Enterprise OCR is recovered from Layout Parser tables");
  for (const problem of liveProblems) console.error(`  - ${problem}`);
} else {
  console.log("PASS: live-like fragmented Enterprise OCR is recovered from Layout Parser tables");
}

if (failures) {
  console.error(`\nNew India regression: ${failures} case(s) failed.`);
  process.exit(1);
}
console.log(`\nNew India regression: ${cases.length + 1}/${cases.length + 1} cases passed.`);
