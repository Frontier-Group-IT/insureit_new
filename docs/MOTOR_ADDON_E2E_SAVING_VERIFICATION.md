# Motor Add-on Premium end-to-end saving verification

## Manual GitHub Action (never deploys)

Actions → **Verify Motor Add-on Premium Saving (Manual, No Deploy)** → Run workflow.

The default mode runs non-mutating checks of the form, transaction wrapper and 18% GST/OD commercial formulas. It does not create or edit policy records and has no publish/deploy command.

## Real create/edit/rollback scenario

To run real persistence checks, first configure a **dedicated, disposable Supabase test project** containing the INSUREIT policy schema and migrations. Production project `ilzhsfqqjyppzzvfscmh` is explicitly refused by the runner. This project currently has no such isolated test database, so real create/edit checks cannot safely run yet. Do not connect the production database.

Create the protected GitHub Environment `motor-addon-isolated-testing` and configure environment secrets:

- `MOTOR_E2E_SUPABASE_URL`: disposable test Supabase project URL.
- `MOTOR_E2E_SUPABASE_SERVICE_ROLE_KEY`: **test project's** service role key (never production).
- `MOTOR_E2E_PAYLOAD_JSON`: test-only fixture containing `createPayload` and `editPayload` matching the existing Motor backend RPC schema, and optionally `addOnAmount`, `odPremium`, `odPayinPercent`, `odPayoutPercent`. Fixture must reference only test customer/vehicle/insurer/source identities in this test database.

Choose `run_isolated_save_test=true` and enter `I_AUTHORIZE_ISOLATED_TEST_WRITES`. Test then calls the real atomic RPC to create one policy and update it, reads stored premiums and commercial records, verifies OD-based calculations and TDS, rejects an invalid edit and verifies that no value changed. **Test policy stays in disposable DB for audit**, not cleanup by destructive broad DELETEs. The test never performs a frontend deployment and never builds mobile artifacts.

## Boundaries

- Static regression mode tests code formulas and SQL contract, **not** a live portal UI or saved transactions.
- Isolated RPC mode tests actual persistence and rollback through the backend RPC, **not** browser UX or service actions.
- Fully authenticated browser end-to-end saving through the production portal remains unverified until a safely isolated portal and test identities exist.
- An environment approval gate is recommended; workflows may be run manually only.
- No GitHub secret contents should appear in logs. The runner prints only synthetic policy ID and test step results.

## Expected example

OD ₹4,675.17 + Add-on ₹10,539.73 = OD commission base ₹15,214.90; at 25% OD pay-in, ₹3,803.73. Persisted add-on must appear separately and 18% GST must be reflected in the gross premium.
