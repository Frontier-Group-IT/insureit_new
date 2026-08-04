# AuthBridge Detailed RC Integration Handoff

> **Consolidated:** 2026-08-05 00:36 IST
>
> This is the complete continuation state for the AuthBridge Detailed RC integration, AWS Lightsail gateway activation, verified UAT behavior, repository files, security constraints, and the next implementation step for Policy Onboarding and Vehicle Registration input.
>
> **Never commit or paste secrets.** Do not store AuthBridge passwords, relay secrets, iCall tokens, vehicle-owner responses, chassis numbers, engine numbers, addresses, phone numbers, or other personal/customer data in GitHub, logs, screenshots, chat, or browser-visible code.

## 1. Provider and service selected

Provider:

```text
AuthBridge / TruthScreen
```

Service:

```text
Detailed RC Verification
```

Service code:

```text
372
```

UAT base URL:

```text
https://www.truthscreen.com
```

AuthBridge confirmed:

- Authentication uses token-based encryption/decryption.
- Detailed RC runs synchronously.
- IP whitelisting is not required.
- P95 response time is approximately 5–8 seconds depending on source.
- A 15–20 second provider timeout is recommended.
- AuthBridge stated no rate limit from its side.
- Live registration-number samples may be used in UAT.

The TruthScreen dashboard login was tested separately and Detailed RC lookup worked there before API integration.

## 2. Verified three-request API flow

AuthBridge supplied a Postman collection for Detailed RC. The working flow is:

### Step 1 — encrypt request

```text
POST https://www.truthscreen.com/InstantSearch/encrypted_string
```

Headers:

```text
Content-Type: application/json
username: <UAT account username>
```

Plain body:

```json
{
  "transID": "UNIQUE_TRANSACTION_ID",
  "docType": 372,
  "docNumber": "NORMALIZED_RC_NUMBER"
}
```

### Step 2 — submit Detailed RC request

```text
POST https://www.truthscreen.com/api/v2.2/utilitysearch
```

Headers:

```text
Content-Type: application/json
username: <UAT account username>
```

Body:

```json
{
  "requestData": "ENCRYPTED_VALUE_FROM_STEP_1"
}
```

### Step 3 — decrypt response

```text
POST https://www.truthscreen.com/InstantSearch/decrypt_encrypted_string
```

Headers:

```text
Content-Type: application/json
username: <UAT account username>
```

Body:

```json
{
  "responseData": "ENCRYPTED_RESPONSE_FROM_STEP_2"
}
```

The supplied Postman flow does not send the TruthScreen dashboard password in these requests. Do not invent a password-based encryption scheme.

## 3. Local API test assets committed

Folder:

```text
authbridge/
```

Files:

```text
authbridge/Test-AuthBridgeRC.ps1
authbridge/README.md
authbridge/Detailed-RC-372.postman_collection.json
authbridge/Error-Code-RC.csv
authbridge/.gitignore
```

Purpose:

- Reproduce the provider flow outside the application.
- Verify encryption, lookup and decryption.
- Keep generated response files out of Git.

Relevant commits:

```text
85641812fe2b5a2268bd6cdd721279464a1c8f5f  Add AuthBridge RC API test script
a6a96491fd323ba817a14f6bb88f2c0183e45273  Add AuthBridge RC test documentation
817d76b06afd2b9bf9af7749ceb6a5ae182b6c94  Add AuthBridge Detailed RC Postman collection
5e88b47e54cdd909a5b071607029615dfc1c7053  Add AuthBridge RC error code reference
f0ad9aa2be569b90f85ccb2e7b6d9fd772fd3217  Ignore AuthBridge test response output
```

**VERIFIED:** the PowerShell test completed successfully using a valid RC number.

## 4. Repository implementation

### 4.1 AWS integration gateway

Primary file:

```text
infrastructure/icall-gateway/server.js
```

Implemented route:

```text
POST /uat/authbridge/rc-verification
```

Route behavior:

- Uses the existing private relay Bearer authentication.
- Accepts a vehicle registration number from a trusted InsureIt server caller.
- Normalizes and validates the registration number.
- Generates a unique transaction ID.
- Calls AuthBridge encryption, Detailed RC and decryption endpoints server-side.
- Uses controlled provider timeouts.
- Does not return credentials or opaque provider-encryption values.
- Does not log the decrypted vehicle-owner response.
- Converts provider/network failures into controlled gateway errors.

Gateway commit:

```text
57f004d331d75f61fa732f685356e9864a1bbfdd
```

### 4.2 Portal server-only client

File:

```text
apps/web-portal/lib/authbridge-rc-api.ts
```

Exports:

```text
lookupAuthbridgeRc(registrationNumber)
normalizeVehicleRegistrationNumber(value)
isValidVehicleRegistrationNumber(value)
```

The portal client:

- Is intended for server-side use only.
- Calls the protected AWS gateway, not AuthBridge directly.
- Uses the existing private gateway URL and relay secret environment variables.
- Must never be imported into a browser/client component in a way that exposes configuration.

Portal client commit:

```text
2698c0980816688d6ba61508f5d432bd22ccb585
```

### 4.3 Nginx reference configuration

File:

```text
infrastructure/icall-gateway/nginx-authbridge-location.conf
```

Commit:

```text
f1f35e313675a1493d0d08619eb429928af24b1f
```

## 5. Lightsail runtime configuration

Gateway server:

```text
AWS Lightsail
Host: insureit.duckdns.org
Application directory: /opt/insureit-gateway
Node service: insureit-gateway.service
Nginx site: /etc/nginx/sites-available/insureit-gateway
```

Required private environment variables were added to:

```text
/opt/insureit-gateway/.env
```

Required names:

```text
AUTHBRIDGE_BASE_URL=https://www.truthscreen.com
AUTHBRIDGE_USERNAME=<stored privately>
```

Do not add angle brackets around the real value. Do not commit `.env`.

The running `server.js` was updated from GitHub and passed:

```bash
node --check server.js
```

Nginx now proxies:

```text
/uat/authbridge/ -> http://127.0.0.1:3001
```

The active HTTPS server contains separate location blocks for:

```text
/health
/uat/authbridge/
/uat/icall/
/
```

Nginx validation passed:

```text
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Systemd was reloaded and the gateway service restarted successfully.

## 6. Verified runtime state

### Health endpoint

Verified response from:

```text
GET https://insureit.duckdns.org/health
```

Result:

```json
{
  "status": "ok",
  "service": "insureit-integration-gateway",
  "environment": "uat",
  "integrations": {
    "icall": "configured",
    "authbridge": "configured"
  }
}
```

### Public route protection

A request without the relay secret to:

```text
POST https://insureit.duckdns.org/uat/authbridge/rc-verification
```

returned:

```json
{
  "statusCode": 401,
  "status": "failed",
  "message": "Unauthorized"
}
```

**VERIFIED:** the AuthBridge gateway route is not publicly usable without the private relay secret.

### Protected end-to-end lookup

A protected request was executed locally from the Lightsail instance using the runtime relay secret and a valid vehicle registration number.

Observed result:

```text
"status":"success"
```

**VERIFIED:** the live UAT path works end to end:

```text
InsureIt server caller
→ protected AWS gateway
→ AuthBridge encryption
→ Detailed RC service 372
→ AuthBridge decryption
→ successful response
```

Do not treat this as proof that the final Policy Onboarding or Vehicle Registration UI is implemented. It proves the provider and gateway path only.

## 7. Security incident and required rotation

During setup, a screenshot exposed existing runtime secrets, including the gateway relay secret and an iCall token.

Required action before production use:

1. Rotate the gateway relay secret.
2. Update the rotated relay secret in Lightsail `.env`.
3. Update the matching private Vercel environment variable.
4. Restart the gateway service after changing the Lightsail value.
5. Rotate the exposed iCall token with the iCall team and update the protected runtime environment.
6. Never paste the new values into chat, screenshots, GitHub or client-side environment variables.

Until rotation is complete, treat the exposed values as compromised.

## 8. Next implementation target: Policy Onboarding vehicle registration input

The next chat should integrate the verified RC lookup into the Policy Onboarding page at the vehicle registration input.

### Required implementation order

1. Read the current Policy Onboarding implementation and the policy-master Excel mapping before modifying fields.
2. Identify the canonical vehicle registration-number field and the server-side form/action that owns it.
3. Add a server action or server-only route that calls:

```ts
lookupAuthbridgeRc(registrationNumber)
```

4. Do not call AuthBridge or the AWS gateway directly from browser code.
5. Trigger lookup only through an explicit user action such as:

```text
Fetch RC details
```

or after a carefully controlled registration-number completion event. Do not spend a provider credit on every keystroke.
6. Show a clear loading state because provider responses can take 5–8 seconds and may take up to 20 seconds.
7. Display the returned data in a review panel before applying it to the policy form.
8. Require confirmation before overwriting any manually entered or already-saved vehicle data.
9. Map only fields confirmed by a real sanitized AuthBridge response and by the policy data model. Do not guess provider property names.
10. Do not automatically store the full raw decrypted response.

### Recommended UX

```text
Registration Number
[ MP20AB1234 ] [ Fetch RC details ]
```

After success:

```text
RC details found
- Registration number
- Vehicle class/type
- Manufacturer
- Model
- Fuel type
- Registration date
- Manufacturing month/year
- Chassis and engine values only where genuinely required and appropriately masked

[Use these details] [Cancel]
```

Only show and import data required by Policy Onboarding. Avoid displaying unnecessary owner personal information.

### Error states to support

- Invalid registration-number format
- Vehicle not found
- AuthBridge business error
- Gateway unauthorized/misconfigured
- Provider timeout
- Provider unavailable
- Malformed provider response
- User cancels import
- Existing form data conflicts with returned data

### Data-handling rules

- Registration numbers should be normalized consistently.
- Do not log decrypted provider responses.
- Do not expose full owner address, phone, chassis, engine or other sensitive values unless the business workflow explicitly requires them.
- Prefer normalized field-level storage over raw provider-payload storage.
- Record transaction/audit metadata separately if required:

```text
provider = authbridge
service = detailed_rc_372
provider_transaction_id
lookup_status
looked_up_at
requested_by
```

- Define retention and access controls before storing raw responses.

## 9. Validation required before claiming Policy Onboarding integration complete

Test at minimum:

1. Valid commercial vehicle
2. Valid private vehicle
3. Invalid RC format
4. RC not found
5. Timeout/provider unavailable
6. Unauthorized gateway configuration
7. Successful field mapping
8. User declines returned details
9. Existing manual values are not silently overwritten
10. Duplicate/repeated lookup behavior and provider-credit usage
11. Mobile and desktop loading/error/review states
12. Browser network payload contains no relay secret or AuthBridge credential
13. Server logs contain no decrypted owner response
14. Saved policy record contains only approved normalized fields

## 10. Deployment state

- Gateway code: **IMPLEMENTED IN REPOSITORY**
- Lightsail gateway configuration: **APPLIED AND VERIFIED IN UAT**
- Protected AuthBridge RC lookup: **VERIFIED SUCCESSFUL IN UAT**
- Portal server client: **IMPLEMENTED IN REPOSITORY**
- Policy Onboarding/Vehicle Registration UI integration: **NOT YET IMPLEMENTED**
- Vercel deployment for the Policy Onboarding integration: **NOT TRIGGERED**
- Production AuthBridge credentials: **NOT CONFIGURED / NOT VERIFIED**
- Secret rotation after screenshot exposure: **REQUIRED**

Do not claim the feature is complete or live until the actual Policy Onboarding user journey is implemented, deployed, and directly verified.