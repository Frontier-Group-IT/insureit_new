import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const addVehicle = await readFile(new URL('../app/customer/add-vehicle.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(addVehicle, /PolicyTypeDropdown/, 'Customer Add Vehicle must not render the Policy Type control.');
assert.doesNotMatch(addVehicle, /policyTypeOptions/, 'Customer Add Vehicle must not retain Policy Type selector options.');
assert.doesNotMatch(addVehicle, /label=["']Policy type["']|>Policy type</i, 'Customer Add Vehicle must not show a Policy Type label.');
assert.doesNotMatch(addVehicle, /Select policy type to save policy details/i, 'Policy save validation must not require a removed Policy Type control.');
assert.match(addVehicle, /p_policy_type:\s*['"]Motor['"]/, 'Vehicle-linked policy creation must continue to persist Motor as the backend policy type.');
assert.match(addVehicle, /label=["']Policy no\.["']/, 'Policy number must remain available in the optional Policy Details section.');
assert.match(addVehicle, /label=["']Start date["']/, 'Policy start date must remain available after removing Policy Type.');
assert.match(addVehicle, /label=["']Premium["']/, 'Premium must remain available after removing Policy Type.');

console.log('Customer Add Vehicle Policy Type removal regression passed.');
