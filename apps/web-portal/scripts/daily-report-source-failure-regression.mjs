import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readDailyHistoryPages} from "../lib/reports/daily-history-source-pages.ts";

const spy=console.error;
const errors=[];
console.error=(...args)=>errors.push(args);
try {
  const successful=await readDailyHistoryPages("Policies",async()=>({data:[{id:"one"}],error:null}));
  assert.deepEqual(successful,{rows:[{id:"one"}],partial:false,failed:false});

  let calls=0;
  const partiallyAvailable=await readDailyHistoryPages("Audit logs",async()=>{
    calls++;
    if(calls===1) return {data:Array.from({length:500},(_,i)=>({id:i})),error:null};
    return {data:null,error:{message:"sensitive external error",code:"PGRST001"}};
  });
  assert.equal(calls,2);
  assert.equal(partiallyAvailable.rows.length,500);
  assert.equal(partiallyAvailable.failed,true);
  assert.equal(partiallyAvailable.partial,true);

  let recoveredCalls=0;
  const recovered=await readDailyHistoryPages("Intake finalizations",async()=>{
    recoveredCalls++;
    if(recoveredCalls===1) return {data:null,error:{message:"transient",code:"PGRST001"}};
    return {data:[{id:"finalized"}],error:null};
  },{retryFailedPage:true});
  assert.equal(recoveredCalls,2);
  assert.deepEqual(recovered,{rows:[{id:"finalized"}],partial:false,failed:false});

  let transportCalls=0;
  const transportRecovered=await readDailyHistoryPages("Intake finalizations",async()=>{
    transportCalls++;
    if(transportCalls===1) throw Error("temporary connection failure");
    return {data:[{id:"recovered"}],error:null};
  },{retryFailedPage:true});
  assert.deepEqual(transportRecovered,{rows:[{id:"recovered"}],partial:false,failed:false});
  assert.equal(transportCalls,2);

  let persistentCalls=0;
  const persistent=await readDailyHistoryPages("Intake finalizations",async()=>{
    persistentCalls++;
    return {data:null,error:{message:"persistent sensitive error",code:"PGRST001"}};
  },{retryFailedPage:true});
  assert.equal(persistentCalls,2);
  assert.deepEqual(persistent,{rows:[],partial:true,failed:true});

  const rejected=await readDailyHistoryPages("Intake submissions",async()=>{throw Error("secrets or customer data")});
  assert.deepEqual(rejected,{rows:[],failed:true,partial:true});
  assert.ok(errors.some((args)=>args[1]?.source==="Audit logs" && args[1]?.code==="PGRST001"));
  assert.ok(errors.some((args)=>args[1]?.source==="Intake submissions"));
  assert.ok(!JSON.stringify(errors).includes("sensitive external error"));
  assert.ok(!JSON.stringify(errors).includes("persistent sensitive error"));
  assert.ok(!JSON.stringify(errors).includes("secrets or customer data"));
} finally {
  console.error=spy;
}
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../lib/reports/daily-self-activity.ts");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const page=read("../app/reports/(workspace)/daily/page.tsx");
assert.match(source,/readDailyHistoryPages\("Audit logs",loadAudit\)/);
assert.match(source,/readDailyHistoryPages\("Case conversions",loadCaseFinal\)/);
assert.match(source,/readDailyHistoryPages\("Intake finalizations",loadIntakeFinal,\{retryFailedPage:true\}\)/);
assert.match(source,/const unavailableSources = sources\.filter\(s=>s\.result\.failed\)/);
assert.match(source,/const partial = sources\.some\(s=>s\.result\.partial\)/);
assert.match(panel,/data\.unavailableSources\.join/);
assert.match(panel,/Counts may be incomplete/);
assert.match(panel,/data\.allSourcesUnavailable/);
assert.match(page,/assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\)/);
assert.doesNotMatch(source+panel+page,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
console.log("Daily Report source errors are isolated, safe to log, and disclosed with incomplete counts.");
