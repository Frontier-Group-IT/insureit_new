// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineDigitCommercialPolicyV2 } from "../lib/policy-ocr-digit-refiner-v2.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";

type Expected = Record<string, string>;
type Case = { name: string; pages: string[]; expected: Expected; expectRecoveryWarning?: boolean };

const expected: Expected = {
  insurer_name: "Go Digit General Insurance Limited",
  policy_product: "Package",
  policy_number: "D221859721",
  idv: "3292441",
  od_premium: "27820.86",
  tp_premium: "7267",
  cpa_premium: "0",
  cpa_opted: "No",
  policy_start_date: "2025-08-27",
  policy_end_date: "2026-08-26",
  total_premium: "35087.86",
  tax_amount: "6315.81",
  gross_premium: "41403.67",
};

const coreHeader = `Digit Commercial Vehicle Insurance IRDAN158RPMT0043V01202425\nGo Digit General Insurance Ltd. Schedule/Certificate\nPolicy No: D221859721\nYOUR POLICY DETAILS\nPeriod of Policy\nD221859721 / 27082025\n27-Aug-2025 17:24:59\n26-Aug-2026 23:59:59`;

const invoice = `Invoice Number Invoice Date Net Premium Igst Cgst Sgst Utgst Cess Gross Premium\nIA198985485 2025-08-27 35087.86 6315.81 0.00 0.00 0.00 0.00 41403.67\nPrevious Policy No. Previous Policy Expiry Date\nReceipt No. RA250476972`;

const cases: Case[] = [
  {
    name: "real Google OCR reading order",
    pages: [
      `${coreHeader}\nManufacturing Year and Month 2025\nYOUR VEHICLE IDV (THE MAXIMUM MONEY YOU CAN GET IN CASE OF A CLAIM)\nVehicle IDV\nIDV of Electrical Accessories\nIDV of Non-Electrical Accessories\nCNG/LPG KIT IDV\nTrailer IDV\nBody IDV\nTotal IDV\n3292441 -- -- -- -- -- 3292441.00\nOWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]\nOwn Damage Premium 27820.86 Basic Third-Party Liability 7267.00\nNCB Discount Amount -0.00 PA cover for Owner-Driver --\nIGST @ 18% = 6315.81\n41403.67\n35087.86\n6315.81\n7267.00 27820.86 Total OD Premium\nNet Premium [A+B}\nTotal Act Premium\nTotal Premium\nNEW JCB 3 DX 2WD 2025-08-27 2026-08-26 Digit Commercial Vehicle Comprehensive Policy`,
      invoice,
    ],
    expected,
  },
  {
    name: "manufacturing year before IDV does not become IDV",
    pages: [
      `${coreHeader}\nYear of Regn. / Manufacturing 2025\nManufacturing Year and Month 2025\nYOUR VEHICLE IDV (THE MAXIMUM MONEY YOU CAN GET IN CASE OF A CLAIM)\nVehicle IDV 3292441\nTotal IDV 3292441.00\nOWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]\nOwn Damage Premium 27820.86\nBasic Third-Party Liability 7267.00\nPA cover for Owner-Driver --\nTotal Net Premium [A+B] 35087.86\n2025-08-27 2026-08-26 Digit Commercial Vehicle Comprehensive Policy`,
      invoice,
    ],
    expected,
  },
  {
    name: "premium numbers reordered still reconcile OD and TP",
    pages: [
      `${coreHeader}\nYOUR VEHICLE IDV (THE MAXIMUM MONEY YOU CAN GET IN CASE OF A CLAIM)\nTotal IDV 3292441.00\nOWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]\nBasic Third-Party Liability 7267.00\nOwn Damage Premium 27820.86\nPA cover for Owner-Driver --\n7267.00 27820.86\nTotal Net Premium [A+B] 35087.86\n2025-08-27 2026-08-26 Digit Commercial Vehicle Comprehensive Policy`,
      invoice,
    ],
    expected,
  },
  {
    name: "missing direct OD is recovered from printed net and TP",
    pages: [
      `${coreHeader}\nYOUR VEHICLE IDV (THE MAXIMUM MONEY YOU CAN GET IN CASE OF A CLAIM)\nTotal IDV 3292441.00\nOWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]\nBasic Third-Party Liability 7267.00\nPA cover for Owner-Driver --\nTotal Net Premium [A+B] 35087.86\n2025-08-27 2026-08-26 Digit Commercial Vehicle Comprehensive Policy`,
      invoice,
    ],
    expected,
    expectRecoveryWarning: true,
  },
  {
    name: "invoice and repeated policy identifiers do not override current policy",
    pages: [
      `${coreHeader}\nInvoice Number IA198985485\nReceipt No RA250476972\nYOUR VEHICLE IDV (THE MAXIMUM MONEY YOU CAN GET IN CASE OF A CLAIM)\nTotal IDV 3292441.00\nOwn Damage Premium 27820.86\nBasic Third-Party Liability 7267.00\nPA cover for Owner-Driver --\nTotal Net Premium [A+B] 35087.86\n2025-08-27 2026-08-26 Digit Commercial Vehicle Comprehensive Policy`,
      `${invoice}\nPolicy No: D221859721\nPrevious Policy No. --`,
    ],
    expected,
  },
];

let failures = 0;
for (const testCase of cases) {
  const base = parsePolicyDocument(testCase.pages);
  const problems: string[] = [];
  if (base.parserId !== "digit_commercial_motor_v1") {
    problems.push(`base parser: expected digit_commercial_motor_v1, got ${base.parserId}`);
  }
  const result = base.parserId === "digit_commercial_motor_v1"
    ? refineDigitCommercialPolicyV2(testCase.pages, base)
    : base;
  const actual = Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
  for (const [key, value] of Object.entries(testCase.expected)) {
    if (actual[key] !== value) problems.push(`${key}: expected ${value}, got ${actual[key] ?? "<missing>"}`);
  }

  const recoveryWarning = result.warnings.some((warning) => /OD premium was recovered using the printed net premium cross-check/i.test(warning));
  if (Boolean(testCase.expectRecoveryWarning) !== recoveryWarning) {
    problems.push(`OD recovery warning: expected ${Boolean(testCase.expectRecoveryWarning)}, got ${recoveryWarning}`);
  }
  if (result.warnings.some((warning) => /premium cross-check failed|printed net premium \+ GST does not match/i.test(warning))) {
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

if (failures) {
  console.error(`\nDigit regression: ${failures}/${cases.length} case(s) failed.`);
  process.exit(1);
}
console.log(`\nDigit regression: ${cases.length}/${cases.length} cases passed.`);
