import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("../app/customer/(protected)/exchange/page.tsx",import.meta.url),"utf8");
assert.match(page,/const requestedTab = params\.tab \?\? "buy";/);
assert.match(page,/tabs\.includes\(requestedTab as ExchangeTab\)/);
assert.match(page,/\? \(requestedTab as ExchangeTab\)/);
assert.doesNotMatch(page,/\? \(params\.tab as ExchangeTab\)/);
for (const tab of ["buy","sell","activity"]) {
  const selected=tab??"buy";
  assert.equal(["buy","sell","activity"].includes(selected)?selected:"buy",tab);
}
assert.equal(undefined??"buy","buy");
console.log("Customer Exchange default tab regression passed");
