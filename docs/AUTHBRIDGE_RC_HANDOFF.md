# AuthBridge Detailed RC Integration Handoff

> **Consolidated:** 2026-09-12 IST
>
> Source of truth for AuthBridge / TruthScreen Detailed RC service 372, the protected AWS gateway, Customer RC lookup, production credential state, security boundaries, and current production rollout evidence.
>
> For the exact 2026-09-12 Lightsail/Nginx rollout and verification sequence, also read `docs/AUTHBRIDGE_PRODUCTION_DEPLOYMENT_HANDOFF_2026_09_12.md`.
>
> **Never commit or paste secrets.** Do not store AuthBridge passwords, relay secrets, iCall tokens, vehicle-owner responses, chassis numbers, engine numbers, addresses, phone numbers, or other personal/customer data in GitHub, logs, screenshots, chat, or browser-visible code.

## 1. Provider contract

Provider: AuthBridge / TruthScreen  
Service: Detailed RC Verification  
Service code: `372`  
Provider base URL: `https://www.truthscreen.com`

The verified provider flow remains three server-side calls:

1. `POST /InstantSearch/encrypted_string`
2. `POST /api/v2.2/utilitysearch`
3. `POST /InstantSearch/decrypt_encrypted_string`

Each call uses the AuthBridge account username header. The supplied provider/Postman contract does **not** use the TruthScreen dashboard password in these three API requests. Do not invent password-based API authentication.

Local reference assets remain under `authbridge/` including the PowerShell test script, README, Postman collection, error-code reference and ignored test-output folder.

## 2. Production credential cutover — VERIFIED 2026-09-12

The Lightsail runtime AuthBridge account was changed from the test account to the provider-issued production account in the private file:

```text
/opt/insureit-gateway/.env
```

Required runtime names remain:

```text
AUTHBRIDGE_BASE_URL=https://www.truthscreen.com
AUTHBRIDGE_USERNAME=<stored privately>
```

The real username/password must not be committed to this repository. The dashboard password is not required by the verified RC API request contract.

Verified after the private username change:

- gateway syntax check passed
- `insureit-gateway.service` restarted successfully
- public `https://insureit.duckdns.org/health` returned HTTP 200
- protected Detailed RC service 372 request succeeded through the gateway

**VERIFIED:** the production AuthBridge account works through the protected AWS gateway.

Do not record the test RC number or returned owner/vehicle payload in repository context.

## 3. Current architecture

Customer mobile flow:

```text
Customer App
→ https://portal.insureit.in/api/customer/rc-lookup
→ server-only portal AuthBridge client
→ https://insureit.duckdns.org/authbridge/rc-verification
→ protected AWS Lightsail integration gateway
→ TruthScreen/AuthBridge encrypt → RC 372 → decrypt
→ normalized safe fields back to Customer App
```

The Customer App never receives AuthBridge credentials or the gateway relay secret.

Primary files:

```text
apps/mobile-app/lib/customer-rc-lookup.ts
apps/mobile-app/app/customer/add-vehicle.tsx
apps/web-portal/app/api/customer/rc-lookup/route.ts
apps/web-portal/lib/authbridge-rc-api.ts
infrastructure/icall-gateway/server.js
infrastructure/icall-gateway/nginx-authbridge-location.conf
```

The portal cache table is `vehicle_rc_lookup_cache`; successful RC lookups are cached for 30 days and stale cache may be used as a controlled fallback if a live provider request fails.

## 4. Production route cleanup — MERGED + APPLIED + VERIFIED

PR **#1702 — Clean up AuthBridge production gateway routing** was merged on 2026-09-12.

Merge commit:

```text
510ffd0b4f1e69bb1c5bce7245292c4082f6af9d
```

Canonical route:

```text
POST /authbridge/rc-verification
```

Temporary compatibility alias retained:

```text
POST /uat/authbridge/rc-verification
```

The portal server-only client calls the canonical neutral route. The gateway health response uses configurable `GATEWAY_ENVIRONMENT`; production Lightsail currently reports `mixed` because the gateway hosts integrations at different lifecycle stages.

Lightsail/Nginx rollout was manually applied on 2026-09-12:

- cleanup gateway source installed at `/opt/insureit-gateway/server.js`
- canonical Nginx `/authbridge/` proxy added
- legacy `/uat/authbridge/` proxy retained
- gateway service restarted
- Nginx reloaded
- public `/health` returned `status: ok`, service `insureit-integration-gateway`, environment `mixed`, and both integrations configured
- unauthenticated request to the canonical route returned HTTP 401 from the gateway auth guard
- authorized canonical-route request returned successful TruthScreen/AuthBridge service-372 data

**VERIFIED:** canonical production AuthBridge routing is operational at the Lightsail/Nginx/provider layers.

Do not remove the legacy alias until production portal traffic and any remaining callers are confirmed on the canonical route.

## 5. Customer Add Vehicle normalized vehicle fields

The Customer API returns normalized vehicle/compliance fields needed by the existing Add Vehicle screen, including:

```text
registrationNumber
registrationDate
manufacturer
model
manufacturingYear
vehicleClass
fuelType
engineCapacityCc
seatingCapacity
gvwKg
chassisNumber
engineNumber
fitnessExpiryDate
pucExpiryDate
roadTaxExpiryDate
nationalPermitExpiryDate
localPermitExpiryDate
```

The Customer App applies these values to the matching vehicle and compliance fields after a successful lookup.

## 6. Customer insurance fields — IMPLEMENTED IN MAIN

PR **#1704 — Prefill Customer Add Vehicle policy details from AuthBridge** was merged on 2026-09-12.

Merge commit:

```text
fb5eaa5fbbd779784cc3b7b8a2084caa4705972e
```

The normalized Customer RC response now supports:

```text
insuranceCompany
policyNumber
policyExpiryDate
```

Mapping is based only on verified provider insurance fields:

```text
Insurance Company
Policy Number
Insurance To Date / Insurance Upto
```

Customer Add Vehicle behavior:

- insurer is resolved against the active Insurance Company master when there is one safe unique match
- unmatched provider insurer text requires manual confirmation; no insurer is auto-created
- policy number is prefilled
- policy expiry/end date is prefilled
- an AuthBridge-provided end date is preserved if the customer later selects a policy start date
- mapper version was bumped so compatible cached raw responses can be remapped without spending another provider lookup

Do **not** infer:

```text
policy start date
IDV
premium
policy copy
```

The verified production response did not supply these values.

## 7. Additional provider fields intentionally not exposed

Verified production service-372 responses may also return values such as:

```text
RTO
RC status
RC status-as-on date
vehicle color
body type
commercial/private flag
emission/norms type
number of cylinders
unladen weight
wheel base
PUCC number
permit number/type/issue date/valid-from
national permit number/issued-by
financed flag
financer name
blacklist status
NOC details
challan details
```

These are not automatically part of the Customer Add Vehicle response or UI. Add only fields with a confirmed business purpose and data-model destination.

TruthScreen may also return owner name, relation name, present/permanent address and other private data. These values remain outside the Customer Add Vehicle payload unless a separately approved workflow explicitly requires them.

## 8. Mapping and safety rules

- Normalize RC numbers consistently.
- Never call TruthScreen directly from browser/mobile code.
- Never expose the relay secret or AuthBridge account credentials client-side.
- Resolve provider manufacturer values against the Vehicle Manufacturer Master; unmatched values require user confirmation and must not auto-create master data.
- Resolve provider insurer values against the Insurance Company master/aliases before selecting a company ID.
- Do not silently overwrite manually edited values after the user has changed them.
- Do not log decrypted provider payloads.
- Return only approved normalized fields to mobile/web clients.
- Treat cached provider data as stale evidence when the provider cannot be reached; show that state to the user.

## 9. Security state

During earlier setup, a relay secret and iCall token were exposed. During the 2026-09-12 production cutover, the same runtime values and the TruthScreen dashboard password were also pasted into chat.

Required remediation remains:

1. rotate the gateway relay secret and update both Lightsail and matching private Vercel/portal configuration together
2. rotate the exposed iCall token with the vendor/team and update the private runtime configuration
3. rotate the TruthScreen dashboard password
4. never paste replacement values into chat, screenshots, GitHub or client-visible environment variables

Until each rotation is directly confirmed, treat the exposed values as compromised.

## 10. Current state matrix

- Production AuthBridge credentials in Lightsail: **APPLIED**
- Production service-372 request through protected gateway: **VERIFIED**
- Neutral route cleanup PR #1702: **MERGED**
- Neutral route gateway source on Lightsail: **APPLIED**
- Canonical `/authbridge/` Nginx route: **APPLIED + VERIFIED**
- Gateway health environment `mixed`: **APPLIED + VERIFIED**
- Canonical protected AuthBridge lookup: **VERIFIED**
- Legacy `/uat/authbridge/` route: **RETAINED FOR COMPATIBILITY**
- Customer insurance-field PR #1704: **MERGED / IMPLEMENTED IN MAIN**
- Customer insurer + policy number + expiry mapping: **IMPLEMENTED IN MAIN**
- Portal Vercel production deployment containing #1702/#1704: **UNVERIFIED IN THIS HANDOFF**
- Customer production OTA containing #1704: **UNVERIFIED IN THIS HANDOFF**
- Installed Customer Add Vehicle end-to-end insurance prefill: **UNVERIFIED IN THIS HANDOFF**
- Secret rotations after exposure: **REQUIRED / UNVERIFIED**

Do not describe merged portal/mobile code as production-live until the exact target deployment/OTA and installed-app journey are directly verified.

## 11. Safe continuation

Before further AuthBridge production work:

1. Read `docs/AUTHBRIDGE_PRODUCTION_DEPLOYMENT_HANDOFF_2026_09_12.md`.
2. Fetch current `main`; do not continue from historical #1702/#1704 branches.
3. Preserve the canonical `/authbridge/rc-verification` route and relay authentication.
4. Preserve the legacy route until retirement is explicitly verified safe.
5. Keep provider calls server-side and privacy-minimized.
6. Do not infer unsupported insurance data.
7. Verify portal deployment and Customer production OTA separately from merge state.
8. Complete the three credential rotations without exposing replacement values.
