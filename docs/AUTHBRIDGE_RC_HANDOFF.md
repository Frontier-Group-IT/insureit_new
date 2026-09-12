# AuthBridge Detailed RC Integration Handoff

> **Consolidated:** 2026-09-12 IST
>
> Source of truth for AuthBridge / TruthScreen Detailed RC service 372, the protected AWS gateway, Customer RC lookup, production credential state, security boundaries, and production rollout evidence.
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

After the private username change:

- `node --check /opt/insureit-gateway/server.js` passed.
- `insureit-gateway.service` restarted and remained active.
- Local `http://127.0.0.1:3001/health` returned HTTP 200.
- Public `https://insureit.duckdns.org/health` returned HTTP 200.
- A protected Detailed RC request through the Lightsail gateway returned `statusCode: 200`, `status: success`, `provider: authbridge` and valid service-372 data.

**VERIFIED:** the production AuthBridge account works end to end through the protected AWS gateway.

Do not record the test RC number or returned owner/vehicle payload in repository context.

## 3. Architecture

Customer mobile flow:

```text
Customer App
→ https://portal.insureit.in/api/customer/rc-lookup
→ server-only portal AuthBridge client
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

## 4. Production route cleanup

Production cleanup PR: **#1702 — Clean up AuthBridge production gateway routing**.

The intended canonical route is:

```text
POST /authbridge/rc-verification
```

The previous route remains temporarily as a compatibility alias:

```text
POST /uat/authbridge/rc-verification
```

The portal server-only client is updated to call the canonical neutral route. The Nginx reference configuration includes both `/authbridge/` and `/uat/authbridge/` proxy locations during transition.

The gateway health response no longer hard-codes the entire gateway as `uat`; `GATEWAY_ENVIRONMENT` is configurable and defaults to `mixed` because the gateway currently hosts integrations at different lifecycle stages.

**Rollout order:**

1. Merge PR #1702 only after the canonical GitHub verification gate is green.
2. Deploy the merged `infrastructure/icall-gateway/server.js` to `/opt/insureit-gateway/server.js`.
3. Add the canonical `/authbridge/` Nginx location while retaining `/uat/authbridge/` temporarily.
4. Run `node --check`, `nginx -t`, restart `insureit-gateway.service`, and reload Nginx if its configuration changed.
5. Verify `/health` and a protected request through `/authbridge/rc-verification`.
6. Only then deploy the web portal commit that calls the canonical route.
7. Keep the legacy route until production portal traffic is verified on the neutral path.

Do not reverse this order; deploying the portal neutral route before the gateway/Nginx route exists can break RC lookup.

## 5. Customer Add Vehicle normalized fields currently exposed

The Customer API currently returns only normalized fields needed by the existing Add Vehicle screen:

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

The Customer App currently applies these values to the matching vehicle and compliance fields after a successful lookup.

## 6. Verified provider fields currently not exposed to Customer Add Vehicle

A verified production service-372 response also returned useful fields that are currently stripped by the portal sanitizer, including:

### Policy / insurance

```text
Insurance Company
Policy Number
Insurance To Date / Insurance Upto
```

The Customer Add Vehicle Policy Details section already has fields for Insurer, Policy No., Start Date, End Date, IDV, Premium and Policy Copy. For AuthBridge prefill, only the verified provider values above are safe candidates. Do **not** infer policy start date, IDV, premium, or document content when the provider did not return them.

Before applying the provider insurer string, resolve it against the canonical active Insurance Company master/aliases. Do not create a new insurer or silently persist an unmatched provider string.

### Additional vehicle / RC metadata

Provider responses may also include values such as:

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

These are not currently part of the Customer Add Vehicle normalized response or visible onboarding fields. Add only fields with a confirmed business purpose and data-model destination.

### Owner/private data

TruthScreen may return owner name, relation name and present/permanent address information. These values are intentionally outside the Customer Add Vehicle response and should remain excluded unless a separately approved workflow explicitly requires them. Never expose or persist unnecessary owner PII merely because the provider supplies it.

## 7. Mapping rules

- Normalize RC numbers consistently.
- Never call TruthScreen directly from browser/mobile code.
- Never expose the relay secret or AuthBridge account credentials client-side.
- Resolve provider manufacturer values against the Vehicle Manufacturer Master; unmatched values require user confirmation and must not auto-create master data.
- Resolve provider insurer values against the Insurance Company master/aliases before selecting a company ID.
- Do not silently overwrite manually edited values after the user has changed them.
- Do not log decrypted provider payloads.
- Return only approved normalized fields to mobile/web clients.
- Treat cached provider data as stale evidence when the provider cannot be reached; show that state to the user.

## 8. Security state

During earlier setup, a relay secret and iCall token were exposed. During the 2026-09-12 production cutover, the same runtime values and the TruthScreen dashboard password were also pasted into chat.

Required remediation remains:

1. Rotate the gateway relay secret and update both Lightsail and matching private Vercel configuration.
2. Rotate the exposed iCall token with the vendor/team and update the private runtime configuration.
3. Rotate the TruthScreen dashboard password.
4. Never paste replacement values into chat, screenshots, GitHub or client-visible environment variables.

Until each rotation is confirmed, treat the exposed values as compromised.

## 9. Deployment state

- Production AuthBridge credentials in Lightsail: **APPLIED**
- Production AuthBridge service-372 request through current protected gateway route: **VERIFIED**
- Customer authenticated RC lookup architecture: **IMPLEMENTED**
- Customer 0.3.0 Add Vehicle AuthBridge lookup: **IMPLEMENTED**
- Neutral gateway route cleanup PR #1702: **IMPLEMENTED IN PR / NOT YET LIVE**
- Neutral route on Lightsail + Nginx: **NOT YET VERIFIED**
- Portal switched live to neutral route: **NOT YET DEPLOYED**
- AuthBridge insurance fields exposed to Customer App: **NOT YET IMPLEMENTED**
- Secret rotation after exposure: **REQUIRED**

Do not claim the neutral-route cleanup is production-applied until the Lightsail source/Nginx rollout and portal deployment are both directly verified.