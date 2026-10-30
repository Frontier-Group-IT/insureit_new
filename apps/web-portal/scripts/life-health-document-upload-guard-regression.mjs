import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const detail = read("components/life-health-case-detail.tsx");
const actions = read("app/policies/life-health-policy-actions.ts");
const config = read("next.config.mjs");

// Keep the file small enough that multipart/form-data overhead does not exhaust
// the configured Next.js Server Action request limit.
assert.match(config, /bodySizeLimit:\s*"25mb"/);
assert.match(actions, /MAX_FILE_SIZE = 20 \* 1024 \* 1024/);
assert.match(detail, /file\.size>20\*1024\*1024/);
assert.match(detail, /Document exceeds the 20 MB upload limit/);
assert.match(detail, /if\(!file\.size\)/);
assert.match(detail, /image\/webp/);
assert.match(detail, /catch\(error\)\{console\.error\("Life\/Health document upload failed"/);
assert.match(detail, /finally\{setUploadingType\(null\)\}/);
assert.match(actions, /requireOperationsHeadRecordOwnership\("life_health_case",caseId\)/);
assert.match(actions, /uploadCaseDocumentInternal\(admin,profile\.id,caseId,documentType,file\)/);
console.log("Life/Health document upload guard regression passed.");
