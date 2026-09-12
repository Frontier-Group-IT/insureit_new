# AuthBridge Production Deployment Handoff — 2026-09-12

> **Purpose:** exact operational record of the AuthBridge / TruthScreen Detailed RC production cutover and the Customer Add Vehicle insurance-field integration.
>
> This file records the difference between repository implementation, merged code, Lightsail/Nginx configuration, provider verification, portal deployment and Customer OTA state. Do not collapse those states.
>
> **Security:** never commit or paste AuthBridge credentials, relay secrets, iCall tokens, dashboard passwords, real RC numbers, decrypted provider payloads, owner information, chassis numbers, engine numbers, addresses or phone numbers.

## 1. Final architecture

```text
Customer App
→ https://portal.insureit.in/api/customer/rc-lookup
→ server-only portal AuthBridge client
→ https://insureit.duckdns.org/authbridge/rc-verification
→ protected AWS Lightsail integration gateway
→ TruthScreen/AuthBridge encrypt → Detailed RC service 372 → decrypt
→ normalized approved fields only
→ Customer Add Vehicle
```

Provider: AuthBridge / TruthScreen  
Service: Detailed RC Verification  
Service code: `372`  
Provider base URL: `https://www.truthscreen.com`

Verified provider contract:

1. `POST /InstantSearch/encrypted_string`
2. `POST /api/v2.2/utilitysearch`
3. `POST /InstantSearch/decrypt_encrypted_string`

The provider username is server-side. The TruthScreen dashboard password is not part of this verified three-request API contract.

## 2. Repository implementation landmarks

### PR #1702 — production route cleanup

**MERGED** on 2026-09-12.  
Merge commit: `510ffd0b4f1e69bb1c5bce7245292c4082f6af9d`

Implemented:

- canonical route `POST /authbridge/rc-verification`
- retained compatibility alias `POST /uat/authbridge/rc-verification`
- portal server-only client switched to the canonical route
- gateway health environment changed from hard-coded `uat` to configurable `GATEWAY_ENVIRONMENT`
- production gateway uses `mixed` because integrations on the host are at different lifecycle stages
- `app.set("trust proxy", 1)` added for the Nginx reverse-proxy path
- Nginx reference contains both canonical and legacy AuthBridge locations
- private web env placeholders documented without secrets

Important files:

```text
infrastructure/icall-gateway/server.js
infrastructure/icall-gateway/nginx-authbridge-location.conf
apps/web-portal/lib/authbridge-rc-api.ts
apps/web-portal/.env.example
docs/AUTHBRIDGE_RC_HANDOFF.md
authbridge/Test-AuthBridgeRC.ps1
```

### PR #1704 — Customer Add Vehicle insurance details

**MERGED** on 2026-09-12.  
Merge commit: `fb5eaa5fbbd779784cc3b7b8a2084caa4705972e`

Implemented normalized AuthBridge insurance fields:

```text
insuranceCompany
policyNumber
policyExpiryDate
```

Customer Add Vehicle behavior:

- insurer is resolved against the existing Insurance Company master when there is one safe match
- otherwise provider insurer text is shown for manual confirmation; no insurer master is auto-created
- policy number is prefilled
- policy expiry/end date is prefilled
- selecting a manual policy start date does not overwrite an AuthBridge-provided end date
- mapper version was bumped so cached raw provider data can be safely remapped without spending another provider lookup

Intentionally **not inferred** because the verified provider response did not supply them:

```text
policy start date
IDV
premium
policy copy
```

No new Customer APK/native build is required for these JS/TS changes when the installed 0.3.0 runtime is compatible. Customer production OTA still requires its normal exact-main publish and installed-app verification process.

## 3. Lightsail production rollout — VERIFIED / APPLIED

Host/runtime facts:

```text
Gateway host: insureit.duckdns.org
App directory: /opt/insureit-gateway
Systemd service: insureit-gateway.service
Runtime env: /opt/insureit-gateway/.env
Node listener: 127.0.0.1:3001
Nginx site: /etc/nginx/sites-available/insureit-gateway
GATEWAY_ENVIRONMENT=mixed
```

Production AuthBridge account was already applied privately in the Lightsail environment. No credential values belong in source control.

On 2026-09-12 the merged cleanup gateway source was manually staged to:

```text
/opt/insureit-gateway/server.js
```

The Nginx HTTPS server was updated to proxy both:

```text
/authbridge/
/uat/authbridge/
```

to `http://127.0.0.1:3001`.

The legacy `/uat/authbridge/` location was intentionally retained for transition compatibility.

The gateway service was restarted and Nginx was reloaded.

## 4. Production verification evidence

### Health — VERIFIED

Public health returned:

```json
{
  "status": "ok",
  "service": "insureit-integration-gateway",
  "environment": "mixed",
  "integrations": {
    "icall": "configured",
    "authbridge": "configured"
  }
}
```

This verifies the public gateway was healthy after the service restart and the runtime environment label was corrected to `mixed`.

### Canonical route authentication — VERIFIED

An unauthenticated request to:

```text
POST https://insureit.duckdns.org/authbridge/rc-verification
```

returned HTTP `401 Unauthorized` with the gateway's failed-auth envelope.

This proves:

```text
Nginx canonical /authbridge/ route
→ Node gateway route
→ relay-authentication guard
```

is live without consuming a provider lookup.

### Protected production provider lookup — VERIFIED

One authorized request through the canonical route returned a successful TruthScreen/AuthBridge Detailed RC result with provider `status_code: 200`, `success: true` and a transaction identifier.

The real RC number and decrypted payload are intentionally not recorded here.

**VERIFIED conclusion:** the canonical production AuthBridge path through Nginx, relay authentication, Lightsail and TruthScreen Detailed RC service 372 is operational.

## 5. Exact state matrix

| Item | State | Evidence / note |
| --- | --- | --- |
| Production AuthBridge account on Lightsail | **APPLIED** | private runtime environment updated |
| Gateway production account provider request | **VERIFIED** | protected service-372 success |
| PR #1702 route cleanup | **MERGED** | merge `510ffd0b...` |
| `/opt/insureit-gateway/server.js` cleanup source | **APPLIED** | copied and service restarted |
| Nginx canonical `/authbridge/` location | **APPLIED + VERIFIED** | unauthenticated canonical request reached auth guard and returned 401 |
| `GATEWAY_ENVIRONMENT=mixed` | **APPLIED + VERIFIED** | public `/health` reports `mixed` |
| Canonical protected AuthBridge lookup | **VERIFIED** | production provider success |
| Legacy `/uat/authbridge/` alias | **RETAINED** | transition compatibility |
| PR #1704 insurance-field integration | **MERGED** | merge `fb5eaa5f...` |
| Customer insurer / policy no. / expiry source code | **IMPLEMENTED IN MAIN** | #1704 |
| Portal production deployment containing #1702/#1704 | **UNVERIFIED HERE** | do not infer from merge alone |
| Customer production OTA containing #1704 | **UNVERIFIED HERE** | requires exact-main Expo production publish + installed-app check |
| End-to-end Customer Add Vehicle insurance prefill on installed production app | **UNVERIFIED HERE** | verify after portal deploy + production OTA |
| Relay-secret rotation | **REQUIRED / UNVERIFIED** | previously exposed value must be replaced on both gateway and matching private portal config |
| iCall-token rotation | **REQUIRED / UNVERIFIED** | previously exposed value must be rotated provider-side/private runtime |
| TruthScreen dashboard-password rotation | **REQUIRED / UNVERIFIED** | previously exposed value must be changed |

## 6. Production Nginx contract

The HTTPS `server` block must retain the following logical routes:

```text
/health
/authbridge/
/uat/authbridge/      # temporary compatibility alias
/uat/icall/           # existing iCall path
```

Unknown gateway paths should remain closed rather than exposing the Node service broadly.

Do not remove the legacy AuthBridge alias until production portal traffic has been verified on the canonical route and no dependent caller still requires the old route.

## 7. Customer field/privacy contract

The Customer App may receive only normalized, approved fields needed by the workflow.

Approved insurance fields from the verified production response:

```text
Insurance Company → insuranceCompany
Policy Number → policyNumber
Insurance To / Upto → policyExpiryDate
```

Owner/private data returned by TruthScreen is not part of this Customer payload. Do not expose or persist unnecessary owner name, relation name, address or contact data merely because the provider supplies it.

Do not log decrypted provider payloads.

## 8. Cache behavior

Portal table:

```text
vehicle_rc_lookup_cache
```

Successful RC lookups are cached for 30 days. The mapper-version bump in #1704 allows stored raw responses to be remapped to newly approved safe fields without forcing another paid provider request.

A cached response is not evidence that the provider currently succeeds. When testing provider availability specifically, use an authorized uncached RC and do not record the RC or response payload in project docs.

## 9. Security remediation still open

Three values were exposed during setup/testing and must be treated as compromised until rotation is directly confirmed:

1. gateway relay secret
2. iCall token
3. TruthScreen dashboard password

For the relay secret, update the gateway and the matching private portal/Vercel value together so the portal does not lose gateway access.

Never paste replacement values into chat, GitHub, screenshots, logs or client-visible environment variables.

## 10. Safe continuation checklist

Before another agent changes AuthBridge production behavior:

1. Read `AGENTS.md`.
2. Read `docs/AUTHBRIDGE_RC_HANDOFF.md`.
3. Read this deployment handoff.
4. Fetch current `main`; do not start from the historical #1702/#1704 branches.
5. Preserve server-only provider calls and relay authentication.
6. Preserve the canonical `/authbridge/rc-verification` route.
7. Preserve the legacy route until compatibility retirement is explicitly verified.
8. Do not infer unsupported insurance values.
9. Do not expose owner PII.
10. Keep implementation, merge, deployment, runtime application, OTA and installed-app verification as separate evidence states.

## 11. Next operational work

Priority follow-ups:

1. Confirm/perform the three credential rotations without exposing replacements.
2. Verify the exact Vercel production deployment containing the merged AuthBridge portal changes before claiming them live on `portal.insureit.in`.
3. Publish Customer 0.3.0 production OTA only from exact current `main` when authorized by the established release workflow.
4. Verify the installed Customer app end-to-end: enter an authorized uncached RC, fetch RC, review vehicle details, confirm insurer/policy number/policy expiry prefill, and verify manual edits remain possible where intended.
5. After canonical-route production traffic is proven stable and all dependent callers are migrated, plan removal of the legacy `/uat/authbridge/` alias as a separate controlled cleanup.
