// Run with node --experimental-strip-types. No database, credentials, or writes.
import assert from 'node:assert/strict';
import { resolveActiveReportingProfiles } from '../../../supabase/functions/partner-intake-document/intake-reporting-chain.ts';

const ids = {
  owner: '10000000-0000-4000-8000-000000000001',
  child: '10000000-0000-4000-8000-000000000002',
  grandchild: '10000000-0000-4000-8000-000000000003',
  outside: '10000000-0000-4000-8000-000000000004',
  pOwner: '20000000-0000-4000-8000-000000000001',
  pChild: '20000000-0000-4000-8000-000000000002',
  pGrandchild: '20000000-0000-4000-8000-000000000003',
  pOutside: '20000000-0000-4000-8000-000000000004',
};
const employees = [
  { id: ids.owner, reporting_manager_id: null },
  { id: ids.child, reporting_manager_id: ids.owner },
  { id: ids.grandchild, reporting_manager_id: ids.child },
  { id: ids.outside, reporting_manager_id: null },
];
const profiles = [
  { id: ids.pOwner, employee_id: ids.owner },
  { id: ids.pChild, employee_id: ids.child },
  { id: ids.pGrandchild, employee_id: ids.grandchild },
  { id: ids.pOutside, employee_id: ids.outside },
];
const scope = resolveActiveReportingProfiles(ids.owner, ids.pOwner, employees, profiles);
assert.deepEqual(new Set(scope.employeeIds), new Set([ids.owner, ids.child, ids.grandchild]));
assert.deepEqual(new Set(scope.profileIds), new Set([ids.pOwner, ids.pChild, ids.pGrandchild]));
assert.ok(!scope.profileIds.includes(ids.pOutside), 'unrelated staff must not gain access');
const missingChild = resolveActiveReportingProfiles(ids.owner, ids.pOwner,
  employees.filter(e => e.id !== ids.child), profiles);
assert.ok(!missingChild.profileIds.includes(ids.pChild), 'inactive descendants must be excluded');
assert.ok(!missingChild.profileIds.includes(ids.pGrandchild), 'descendants of missing active links must be excluded');
const cycle = resolveActiveReportingProfiles(ids.owner, ids.pOwner,
  employees.map(e => e.id === ids.owner ? { ...e, reporting_manager_id: ids.grandchild } : e), profiles);
assert.equal(cycle.employeeIds.length, 3, 'cycles must not recurse forever or widen scope');
assert.throws(() => resolveActiveReportingProfiles(ids.outside, ids.pOutside,
  employees.filter(e => e.id !== ids.outside), profiles), /not active/);
assert.throws(() => resolveActiveReportingProfiles('bad', ids.pOwner, employees, profiles), /Invalid/);
assert.throws(() => resolveActiveReportingProfiles(ids.owner, ids.pOwner,
  [...employees, { id: 'bad', reporting_manager_id: ids.owner }], profiles), /Invalid/);
console.log('Partner Intake active reporting-chain resolver unit cases passed');
