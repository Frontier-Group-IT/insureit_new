import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const trackerScreen = readFileSync(fileURLToPath(new URL('../app/claim/[id].tsx', import.meta.url)), 'utf8');
const trackerLogic = readFileSync(fileURLToPath(new URL('../lib/claim-tracker.ts', import.meta.url)), 'utf8');
const detailScreen = readFileSync(fileURLToPath(new URL('../app/claim/stage.tsx', import.meta.url)), 'utf8');
assert.match(trackerScreen, /CLAIM_STAGES\.map/);
assert.match(trackerScreen, /getClaimTrackerState\(data\)/);
assert.match(trackerLogic, /data\.status_history\.map/);
assert.match(trackerLogic, /data\.stages\.map/);
assert.match(trackerLogic, /getStageHistory/);
assert.match(detailScreen, /getStageHistory\(data, stage\.key/);
assert.match(trackerLogic, /sort\(\(a,b\)/);
console.log('Partner claim tracker journey source contracts passed');
