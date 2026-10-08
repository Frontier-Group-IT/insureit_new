import assert from "node:assert/strict";
import * as XLSX from "xlsx";

assert.equal(XLSX.version, "0.20.3", "The audited SheetJS version must remain pinned");

function roundTrip(book, expectedSheet, expectedMarker, props) {
  const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx", cellStyles: true });
  assert.ok(bytes.length > 500);
  const parsed = XLSX.read(bytes, { type: "buffer", cellDates: true });
  assert.ok(parsed.SheetNames.includes(expectedSheet));
  assert.ok(parsed.SheetNames.includes("INSUREIT_META"));
  const metaIndex = parsed.SheetNames.indexOf("INSUREIT_META");
  assert.equal(parsed.Workbook?.Sheets?.[metaIndex]?.Hidden, 1, "Metadata sheet must remain hidden");
  const meta = XLSX.utils.sheet_to_json(parsed.Sheets.INSUREIT_META, { header: 1, defval: "" });
  assert.equal(meta[0][0], expectedMarker, "Metadata marker must survive export/import");
  for (const [k,v] of Object.entries(props)) {
    assert.equal(String(parsed.Custprops?.[k] ?? ""), String(v), "Custom property "+k+" must survive export/import");
  }
  return { bytes, parsed };
}
const mis = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mis, XLSX.utils.aoa_to_sheet([
  ["INSUREIT Business MIS","Sample test only"],
  ["System Policy ID","Policy No.","Bill No.","Amount"],
  ["policy-test-001","POL-TEST-001","INV-01",1234.5]
]), "Business MIS");
XLSX.utils.book_append_sheet(mis, XLSX.utils.aoa_to_sheet([
  ["INSUREIT_META_V3",""],
  ["Row count",1],
  ["Structure hash","test-structure"],
  ["System hash","test-system"]
]), "INSUREIT_META");
mis.Workbook = { Sheets:[{name:"Business MIS",Hidden:0},{name:"INSUREIT_META",Hidden:1}] };
mis.Custprops = {
  INSUREITTemplate:"Business MIS Reconciliation v2",
  INSUREITRowCount:1,
  INSUREITStructureHash:"test-structure",
  INSUREITSystemHash:"test-system",
  INSUREITFromDate:"2026-10-01",
  INSUREITToDate:"2026-10-08"
};
const misCopy = roundTrip(mis, "Business MIS", "INSUREIT_META_V3", mis.Custprops).parsed;
const misRows = XLSX.utils.sheet_to_json(misCopy.Sheets["Business MIS"], { header:1, defval:"", raw:true });
assert.equal(misRows[2][2],"INV-01");
assert.equal(misRows[2][3],1234.5);

for(const [type, sheet] of [["payin","Pay-In Transactions"],["payout","Payout Transactions"]]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["INSUREIT "+type,"2026-10-01 to 2026-10-08"],
    ["System Policy ID","Policy Number","Bill No.","Amount","Date"],
    ["policy-test-001","POL-TEST-001","INV-01",1000,"2026-10-08"]
  ]),sheet);
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
    ["INSUREIT_ACCOUNTS_TRANSACTION_TEMPLATE_V1"],
    ["Type",type],
    ["Test identity","policy-test-001"]
  ]),"INSUREIT_META");
  book.Workbook={Sheets:[{name:sheet,Hidden:0},{name:"INSUREIT_META",Hidden:1}]};
  const {parsed}=roundTrip(book,sheet,"INSUREIT_ACCOUNTS_TRANSACTION_TEMPLATE_V1",{});
  const records=XLSX.utils.sheet_to_json(parsed.Sheets[sheet],{header:1,raw:false,defval:""});
  assert.equal(records[2][2],"INV-01");
  assert.equal(records[2][3],"1000");
}
console.log("PASS SheetJS 0.20.3: Business MIS metadata/custom properties/hidden sheet/values and Pay-In/Payout transaction template round-trips");
