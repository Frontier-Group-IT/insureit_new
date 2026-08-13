// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineAdditionalMotorPolicy } from "../lib/policy-ocr-additional-motor-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";

type Expected = Record<string, string | undefined>;
type Case = {
  name: string;
  expectedParser: string;
  pages: string[];
  expected: Expected;
  absent?: string[];
  warning?: RegExp;
};

const cases: Case[] = [
  {
    name: "Shriram GCCV package schedule",
    expectedParser: "shriram_motor_v1",
    pages: [
      `GCCV-PUBLIC CARRIERS OTHER THAN THREE WHEELERS
Zone C
MOTOR COMMERCIAL VEHICLE (PACKAGE POLICY)
UIN No.IRDAN137RP0018V01200809 - SAC Code: 997134
IRDAI REGN. NO. - 137
SHRIRAM GENERAL INSURANCE COMPANY LIMITED
E-8,EPIP,SITAPURA INDUSTRIAL AREA,JAIPUR,
RAJASTHAN-302022
CONTACT(TOLL FREE): 1800
CERTIFICATE CUM POLICY SCHEDULE
Chassis IDV
Body IDV
IDV FOR THE VEHICLE
IDV FOR TRAILER
NON ELECTRICAL ACCESSORIES
ELECTRICAL ACCESSORIES
CNG/LPG kit SI
TOTAL VALUE
891918.00
111823.00
1003741.00
0
0
0
0
1003741.00
CIN NO.U66010RJ2006PLC029979
Policy No.
102015/31/26/009951
Insured's Code/ Name
IN-40400443 /
MR. SHIVAM  JAISWAL
Period of Insurance
From 00:00 Hrs of 08/09/2025 To Midnight Of 07/09/2026
SCHEDULE OF PREMIUM
A. OWN DAMAGE
OD TOTAL
3883.00
TOTAL PREMIUM
47933.00
ADD : IGST
18.00 %
717.00
ADD : IGST
12.00 %
5274.00
PREMIUM AMOUNT
53924.00
BASIC TP COVER
43950.00
ADD :Legal Liability Coverages For Paid Driver
50.00
ADD :Legal Liability Coverages For Cleaner
50.00
TP TOTAL
44050.00
CPA Policy number:
, CPA Sum Insured:
0.00
, CPA Company Name:
N.A.
, CPA Valid From:
N.A.
, CPA Valid To:
N.A.
P.A. Cover under Section III for Owner - Driver (CSI) : Rs.
0
Gross Premium
47933
IGST
5991
CGST
0
SGST/UTGST
0
Total
53924`,
    ],
    expected: {
      insurer_name: "Shriram General Insurance Company Limited",
      policy_product: "Package",
      policy_number: "102015/31/26/009951",
      idv: "1003741",
      od_premium: "3883",
      tp_premium: "44050",
      cpa_premium: "0",
      cpa_opted: "No",
      policy_start_date: "2025-09-08",
      policy_end_date: "2026-09-07",
      total_premium: "47933",
      tax_amount: "5991",
      gross_premium: "53924",
    },
  },
  {
    name: "Oriental commercial package schedule",
    expectedParser: "oriental_motor_v1",
    pages: [
      `The Oriental Insurance Company Limited
Policy No : ORI123456789 Prev Policy No :
FROM 00:00 ON 12-AUG-25 TO MIDNIGHT OF 11-AUG-26
GOODS CARRIERS OTHER THAN THREE WHEELERS PACKAGE POLICY - ZONE C
MOTOR INSURANCE CERTIFICATE CUM POLICY SCHEDULE
Insured's Declared Value (IDV)
Total Value 900000
SCHEDULE OF PREMIUM
B. O.D. OWN DAMAGE
OD TOTAL 12,000
BASIC TP TOTAL 7,267
ADD :LL-PAID DRIVER 100
TP TOTAL 7,367
P.A. Cover under Section III for Owner - Driver (CSI) : Rs. 0
TOTAL PREMIUM 19,367
ADD :IGST_OD 3,486.06
TOTAL AMOUNT 22,853.06`,
    ],
    expected: {
      insurer_name: "The Oriental Insurance Company Limited",
      policy_product: "Package",
      policy_number: "ORI123456789",
      idv: "900000",
      od_premium: "12000",
      tp_premium: "7367",
      cpa_premium: "0",
      cpa_opted: "No",
      policy_start_date: "2025-08-12",
      policy_end_date: "2026-08-11",
      total_premium: "19367",
      tax_amount: "3486.06",
      gross_premium: "22853.06",
    },
  },
  {
    name: "National bilingual GCV schedule with unreconciled flattened premium rows",
    expectedParser: "national_motor_v1",
    pages: [
      `National Insurance Company Limited
Policy Schedule-Motor - Goods Carrying Vehicle - Package
Policy Number: NIC123456789012
customer.support@nic.co.in
Policy Effective from 00:00 hours, on 14/08/2026 to midnight of 13/08/2027
Premium Rs. 36,246.00
IGST @ 5%
Total Amount Rs. 38,180.00
Vehicle IDV Rs. 10,15,000.00
Total Value Rs. 10,15,000.00
Schedule of Premium
Own Damage (Rs.) Legal Liability (Rs.)
PA of Owner Driver IMT 28
Legal Liability Cover 35,313.00
Total ₹ 22,206.27
Total 35,413.00`,
    ],
    expected: {
      insurer_name: "National Insurance Company Limited",
      policy_product: "Package",
      policy_number: "NIC123456789012",
      idv: "1015000",
      policy_start_date: "2026-08-14",
      policy_end_date: "2027-08-13",
      cpa_premium: "0",
      cpa_opted: "No",
      total_premium: "36246",
      tax_amount: "1934",
      gross_premium: "38180",
    },
    absent: ["od_premium", "tp_premium"],
    warning: /financial fields require manual review|withheld/i,
  },
  {
    name: "Universal Sompo bundled private-car schedule",
    expectedParser: "universal_sompo_motor_v1",
    pages: [
      `Universal Sompo General Insurance Company Limited
Certificate of Insurance cum Policy Schedule
PRODUCT NAME : Motor Private Car - Bundled ; POLICY NUMBER: USG123456789
PERIOD OF INSURANCE:
OWN DAMAGE FROM OD 00:00:00 OF 23/08/2025 TO MIDNIGHT OF 22/08/2026
INSURED DECLARED VALUE (IDV) (Amount in Rs.)
VEHICLE IDV Total VALUE
12,80,471 12,80,471
SCHEDULE OF PREMIUM (Amount in Rs.)
Compulsory PA Cover for Owner Driver under Section III, SI Rs.15 Lacs 632
Legal Liablity to paid driver (IMT28) 150
TOTAL LIABILITY PREMIUM (B) 11,422
NET OWN DAMAGE PREMIUM (B+C) = I 15,861
TOTAL PACKAGE PREMIUM (I+II) 27,283
GST 18% : IGST (18%) 4,911
TOTAL POLICY PREMIUM 32,194`,
    ],
    expected: {
      insurer_name: "Universal Sompo General Insurance Company Limited",
      policy_product: "Bundled",
      policy_number: "USG123456789",
      idv: "1280471",
      od_premium: "15861",
      tp_premium: "10790",
      cpa_premium: "632",
      cpa_opted: "Yes",
      policy_start_date: "2025-08-23",
      policy_end_date: "2026-08-22",
      total_premium: "27283",
      tax_amount: "4911",
      gross_premium: "32194",
    },
  },
  {
    name: "United India PCV package schedule",
    expectedParser: "united_india_motor_v1",
    pages: [
      `United India Insurance Company Limited
PCV 4 WHEELER EXCEEDING 6 or 3 WHEELER EXCEEDING 18 PACKAGE POLICY
Policy No. UIIC123456789 Certificate Number CERT12345
Effective date of commencement of Insurance for the purpose of Act from 12:15 12/08/2026 to midnight of 11/08/2027
MOTOR INSURANCE - PCV 4 WHEELER EXCEEDING 6 or 3 WHEELER EXCEEDING 18 PACKAGE
POLICY SCHEDULE
Policy Number : CUSTOMER
Customer Reference : CUST-001
Policy Number :UIIC123456789 Previous Policy Number :
INSURED DECLARED VALUE
Vehicle Trailer Electrical/Electronic Accessories Non Electrical Accessories CNG Kit LPG Kit Total
8,75,000 0 0 0 0 0 8,75,000
SCHEDULE OF PREMIUM
Gross OD(A) 21,000
Compulsory PA for Owner Driver 330
Gross TP(B) 12,909
Premium(A+B) 34,239.00
IGST(18%) 6,163.00
TOTAL PAYABLE PREMIUM 40,402.00`,
    ],
    expected: {
      insurer_name: "United India Insurance Company Limited",
      policy_product: "Package",
      policy_number: "UIIC123456789",
      idv: "875000",
      od_premium: "21000",
      tp_premium: "12909",
      cpa_premium: "330",
      cpa_opted: "Yes",
      policy_start_date: "2026-08-12",
      policy_end_date: "2027-08-11",
      total_premium: "34239",
      tax_amount: "6163",
      gross_premium: "40402",
    },
  },
];

let failures = 0;
for (const testCase of cases) {
  const base = parsePolicyDocument(testCase.pages);
  const result = refineAdditionalMotorPolicy(testCase.pages, base);
  const actual = Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
  const problems: string[] = [];

  if (base.parserId !== testCase.expectedParser) problems.push(`base parser: expected ${testCase.expectedParser}, got ${base.parserId}`);
  if (result.parserVersion === base.parserVersion) problems.push("refiner did not update parser version");

  for (const [key, value] of Object.entries(testCase.expected)) {
    if (actual[key] !== value) problems.push(`${key}: expected ${value}, got ${actual[key] ?? "<missing>"}`);
  }
  for (const key of testCase.absent ?? []) {
    if (actual[key] !== undefined) problems.push(`${key}: expected absent, got ${actual[key]}`);
  }
  if (testCase.warning && !result.warnings.some((warning) => testCase.warning?.test(warning))) {
    problems.push(`expected warning matching ${testCase.warning}`);
  }
  if (!testCase.warning && result.warnings.some((warning) => /withheld|cross-check failed|does not match/i.test(warning))) {
    problems.push(`unexpected warning: ${result.warnings.join(" | ")}`);
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
  console.error(`\nAdditional insurer OCR regression: ${failures}/${cases.length} case(s) failed.`);
  process.exit(1);
}
console.log(`\nAdditional insurer OCR regression: ${cases.length}/${cases.length} cases passed.`);
