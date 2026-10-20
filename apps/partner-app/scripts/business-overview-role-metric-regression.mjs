import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const business = readFileSync(fileURLToPath(new URL('../app/(tabs)/business.tsx', import.meta.url)), 'utf8');
const home = readFileSync(fileURLToPath(new URL('../lib/home.ts', import.meta.url)), 'utf8');
const migration = readFileSync(fileURLToPath(new URL('../../../supabase/migrations/20261020101500_partner_app_scoped_payout_range.sql', import.meta.url)), 'utf8');

assert.match(business, /context\?\.identity\.actor_kind === 'employee' \? 'Projected Retention' : 'Payout'/);
assert.match(business, /mtdChange\(mtdCurrent\?\.scoped_payout, mtdPrevious\?\.scoped_payout\)/);
assert.match(home, /partner_app_scoped_payout_range/);
assert.match(migration, /partner_app_commercial_scope\(\)/);
assert.match(migration, /i\.id = any\(v_ids\)/);
assert.match(migration, /v_scope ->> 'actor_kind' <> 'intermediary'/);
console.log('Business overview role-specific metric regression: OK');
