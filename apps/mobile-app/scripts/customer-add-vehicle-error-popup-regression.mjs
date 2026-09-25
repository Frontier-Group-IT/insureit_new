import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/customer/add-vehicle.tsx', import.meta.url), 'utf8');

function expectIncludes(value, label) {
  if (!source.includes(value)) {
    console.error(`Missing ${label}: ${value}`);
    process.exit(1);
  }
}

function expectNotIncludes(value, label) {
  if (source.includes(value)) {
    console.error(`Unexpected ${label}: ${value}`);
    process.exit(1);
  }
}

expectIncludes("showError('Insurer not selected', 'Please select the insurer first to save the policy details.', 'Select Insurer'", 'insurer popup');
expectIncludes('visible={Boolean(errorPopup)}', 'shared error modal');
expectIncludes("errorPopup?.actionLabel ?? 'OK'", 'default popup action');
expectIncludes("showError('Vehicle lookup failed'", 'RC lookup popup');
expectIncludes("showError('Vehicle could not be saved'", 'vehicle save popup');
expectIncludes("showError('Policy could not be saved'", 'policy save popup');
expectIncludes("showError('Policy copy upload failed'", 'policy upload popup');
expectIncludes("showError('Invalid registration number'", 'registration validation popup');
expectNotIncludes('<Message type="error">', 'inline error banner');
expectNotIncludes("setMessage('Search and select the insurer to save policy details.')", 'legacy inline insurer error');

console.log('Customer Add Vehicle error popup regression passed.');
