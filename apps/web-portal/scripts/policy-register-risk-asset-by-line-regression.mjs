import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/policies/policy-workspace.tsx", import.meta.url), "utf8");
const start = source.indexOf("function riskAssetPrimary(policy: PolicyRow) {");
const end = source.indexOf("\nfunction riskAssetSecondary(", start);
assert.ok(start >= 0 && end > start, "Policy Register must retain canonical Risk / Asset helper");
const helper = source.slice(start, end)
  .replace("function riskAssetPrimary(policy: PolicyRow)", "function riskAssetPrimary(policy)");
const riskAssetPrimary = new Function("policyBusinessLine", "firstText",
  `${helper}\nreturn riskAssetPrimary;`)(
    policy => policy.business_line?.trim() || "Motor",
    (...values) => values.find(value => typeof value === "string" && value.trim())?.trim() ?? ""
  );

assert.equal(riskAssetPrimary({business_line:"Life",policy_no:" LIFE-16247 ",vehicles:null}), "LIFE-16247");
assert.equal(riskAssetPrimary({business_line:"Health",policy_no:" HEALTH-009 ",vehicles:{vehicle_no:"BAD-LINK"}}), "HEALTH-009");
assert.equal(riskAssetPrimary({business_line:"Life",policy_no:"  ",vehicles:null}), "Policy number unavailable");
assert.equal(riskAssetPrimary({business_line:"Motor",policy_no:"MOTOR-POLICY",vehicles:{vehicle_no:"MP20AB1234"}}), "MP20AB1234");
assert.equal(riskAssetPrimary({business_line:"Motor",policy_no:"MOTOR-POLICY",vehicles:null}), "Vehicle not linked");
assert.equal(riskAssetPrimary({business_line:"Non Motor",policy_no:"NONMOTOR-123",non_motor_policy_details:{
  risk_title:"Factory premises", risk_details:{}
}}), "Factory premises");
assert.match(source, /function RiskAssetCell\([\s\S]*?riskAssetPrimary\(policy\)/,
  "Desktop Policy Register must use the shared Risk / Asset helper");
assert.match(source, /function [A-Za-z]+[\s\S]*?riskAssetPrimary\(policy\)/,
  "Register card and table must continue to share Risk / Asset logic");
assert.match(source, /function riskAssetSecondary\([\s\S]*?policyBusinessLine\(policy\) !== "Non Motor"\) return ""/,
  "Only Non Motor retains secondary risk information");
console.log("Policy Register Risk / Asset by business line regression passed.");
