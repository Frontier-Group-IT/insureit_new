import { refineIffcoCommercialPolicyV2 } from "../lib/policy-ocr-iffco-refiner-v2.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

type Expected = Record<string, string>;
type Case = { name: string; pages: string[]; expected: Expected; expectConflict?: boolean };

const EMPTY: ParsedPolicyResult = { parserId: "iffco_tokio_commercial_motor_v1", parserVersion: "fixture", fields: [], warnings: [] };

const cases: Case[] = [
  {
    name: "existing vehicle with Section 2 OD add-ons",
    pages: [
      page1("N9000001", "24/07/2026", "23/07/2027", 1600000, 1122, 7697, 330, 22739, 4093.02, 26832.02),
      `Section 2: Value Auto Coverage\nDepreciation Waver Cover 9600.00 As Per Coverage Wordings\nConsumable 4320.00 As Per Coverage Wordings\nPremium Bifurcation (Rs.)\nSection 1 (Rs.) Section 2 (Rs.) RPI Premium Premium/Taxable Value(Rs.) Total GST Net Premium (Rs.)\n8819.00 13920.00 22739.00 4093.02 26832.02\nSince you, as insured, have declared that you do not have a valid driving license, the PA coverage for Owner-Driver will not be applicable.`,
    ],
    expected: expected("N9000001", "1600000", "15042", "7367", "330", "Yes", "2026-07-24", "2027-07-23", "22739", "4093.02", "26832.02"),
    expectConflict: true,
  },
  {
    name: "existing vehicle with NCB and no add-ons",
    pages: [page1("N9000002", "11/08/2026", "10/08/2027", 3009833, 5862, 7697, 330, 13559, 2440.62, 15999.62)],
    expected: expected("N9000002", "3009833", "5862", "7367", "330", "Yes", "2026-08-11", "2027-08-10", "13559", "2440.62", "15999.62"),
  },
  {
    name: "alternate standalone PA declaration conflict",
    pages: [
      `${page1("N9000003", "31/07/2026", "30/07/2027", 1397353, 1679, 7647, 330, 9326, 1678.68, 11004.68)}\nSince you have an alternate Stand alone Compulsory PA coverage, you have opted to delete Compulsory PA cover under this policy.`,
    ],
    expected: expected("N9000003", "1397353", "1679", "7317", "330", "Yes", "2026-07-31", "2027-07-30", "9326", "1678.68", "11004.68"),
    expectConflict: true,
  },
  {
    name: "new vehicle with payable CPA",
    pages: [page1("N9000004", "05/08/2026", "04/08/2027", 3439230, 4754, 7647, 330, 12401, 2232.18, 14633.18)],
    expected: expected("N9000004", "3439230", "4754", "7317", "330", "Yes", "2026-08-05", "2027-08-04", "12401", "2232.18", "14633.18"),
  },
  {
    name: "new vehicle without CPA",
    pages: [page1("N9000005", "04/08/2026", "03/08/2027", 3410730, 4715, 7367, 0, 12082, 2174.76, 14256.76)],
    expected: expected("N9000005", "3410730", "4715", "7367", "0", "No", "2026-08-04", "2027-08-03", "12082", "2174.76", "14256.76"),
  },
];

let failures = 0;
for (const testCase of cases) {
  const result = refineIffcoCommercialPolicyV2(testCase.pages, EMPTY);
  const actual = Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
  const problems: string[] = [];
  for (const [key, value] of Object.entries(testCase.expected)) {
    if (actual[key] !== value) problems.push(`${key}: expected ${value}, got ${actual[key] ?? "<missing>"}`);
  }
  const hasConflict = result.warnings.some((warning) => /Owner-Driver premium.*not applicable\/deleted/i.test(warning));
  if (Boolean(testCase.expectConflict) !== hasConflict) problems.push(`CPA conflict warning: expected ${Boolean(testCase.expectConflict)}, got ${hasConflict}`);
  const hasReconciliationFailure = result.warnings.some((warning) => /premium components do not reconcile/i.test(warning));
  if (hasReconciliationFailure) problems.push("premium reconciliation unexpectedly failed");

  if (problems.length) {
    failures += 1;
    console.error(`FAIL: ${testCase.name}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  } else {
    console.log(`PASS: ${testCase.name}`);
  }
}

if (failures) {
  console.error(`\nIFFCO regression: ${failures}/${cases.length} case(s) failed.`);
  process.exit(1);
}
console.log(`\nIFFCO regression: ${cases.length}/${cases.length} cases passed.`);

function page1(policy: string, from: string, upto: string, idv: number, netA: number, netB: number, cpa: number, net: number, gst: number, gross: number) {
  const ownerDriver = cpa > 0 ? `PA Owner Driver CSI Rs 1500000 ${cpa.toFixed(2)}` : "PA Owner Driver CSI Rs 0.00";
  return `IFFCO-TOKIO GENERAL INSURANCE CO.LTD\nCOMMERCIAL VEHICLE CERTIFICATE OF INSURANCE cum SCHEDULE & TAX INVOICE\nP400 Policy # ${policy}\nPeriod of Insurance From: ${from} 00:00:00\nTo: Midnight On ${upto} 23:59:59\nInsured Motor Vehicle Details & Premium Calculation\nCoverage IDV in Rs.\nPackage ${idv} Non Electrical Accessories are not covered as its value is 0\nA. Own Damage (Rs.) B. Third Party (Rs.)\n${ownerDriver}\nNet (A) ${netA.toFixed(2)} Net (B) ${netB.toFixed(2)}\nPremium/Taxable Value RS. ${net.toFixed(2)}\nGross Premium Payable Rs. ${gross.toFixed(2)}\nGST Details 997134 ${net.toFixed(2)} 18.00 ${gst.toFixed(2)} ${gross.toFixed(2)}\nTotal ${net.toFixed(2)} ${gst.toFixed(2)} ${gross.toFixed(2)}`;
}

function expected(policy: string, idv: string, od: string, tp: string, cpa: string, cpaOpted: string, from: string, upto: string, net: string, gst: string, gross: string): Expected {
  return {
    insurer_name: "IFFCO-TOKIO General Insurance Company Limited",
    policy_product: "Package",
    policy_number: policy,
    idv,
    od_premium: od,
    tp_premium: tp,
    cpa_premium: cpa,
    cpa_opted: cpaOpted,
    policy_start_date: from,
    policy_end_date: upto,
    total_premium: net,
    tax_amount: gst,
    gross_premium: gross,
  };
}
