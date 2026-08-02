# iCall AWS Gateway and SSO Integration Handoff

> **Captured:** 2026-08-02 15:13 IST
>
> This document is the complete continuation state for the iCall training integration, AWS Lightsail gateway, Vercel configuration, SSO iframe work, verified behavior, unresolved vendor dependency, and immediate next actions.
>
> Read this file before changing any iCall, training, SSO, gateway, CSP, or iframe code. Do not ask the user to repeat information already recorded here.
>
> **Never commit secrets.** The real iCall token and relay secret exist only in protected runtime environment files/settings and are intentionally omitted here.

## 1. Repository and deployment context

- Repository: `Frontier-Group-IT/insureit_new`
- Default branch: `main`
- Main app: `apps/web-portal`
- Vercel application URL currently used for UAT: `https://insureit-drab.vercel.app`
- Vercel environment variables already configured server-side:
  - `ICALL_GATEWAY_URL=https://insureit.duckdns.org`
  - `ICALL_GATEWAY_SECRET=<stored privately in Vercel and Lightsail>`
- Never use `NEXT_PUBLIC_` for gateway secrets.
- Do not claim a Vercel deployment succeeded without seeing **Ready** or logs.
- Current repository deployment rules are in root `AGENTS.md`.

## 2. iCall API contract currently implemented

Base UAT endpoint used only by the gateway:

```text
https://www.icallinsurance.com/API/SANKALP/UAT
```

Implemented APIs:

1. Candidate registration
   - iCall endpoint: `/RegisterPOSPTraining`
   - Request is Base64-wrapped inside JSON `{ payload }`.
2. Training status
   - iCall endpoint: `/POSPTrainingStatus`
   - Plain JSON.
3. SSO authentication
   - iCall endpoint: `/AuthenticateUser`
   - Plain JSON request `{ authToken, loginId }`.
   - Response may be direct JSON or Base64-wrapped.
   - Successful response includes `data.redirectUrl`.
   - iCall sometimes returns `statusCode` as string `"200"`, not numeric `200`.
4. TCC
   - iCall endpoint: `/POSPTCC`
   - Plain JSON.

The iCall UAT auth token exists in `/opt/insureit-gateway/.env` on Lightsail and must never be committed or copied into chat/repository context.

## 3. AWS Lightsail gateway infrastructure

A fixed-IP integration gateway was created because Vercel static egress IPs were too expensive and iCall requires IP allowlisting.

### Instance

- Provider: AWS Lightsail
- Region: Mumbai, Zone A (`ap-south-1a`)
- Instance name: `insureit-integration-gateway`
- OS: Ubuntu 24.04 LTS
- Plan: 1 GB RAM, 2 vCPU, 40 GB SSD
- Static IPv4: `3.111.28.10`
- Private IPv4: `172.26.12.102`
- Networking: dual-stack
- iCall must whitelist outbound IPv4 `3.111.28.10`.

### Public hostname

- DuckDNS hostname: `insureit.duckdns.org`
- DNS points to `3.111.28.10`.
- HTTPS certificate installed with Certbot.
- Public verified health endpoint:

```text
https://insureit.duckdns.org/health
```

Expected response:

```json
{"status":"ok","service":"insureit-icall-gateway","environment":"uat"}
```

### Firewall

Ubuntu UFW allows:

- OpenSSH
- Nginx Full

Lightsail network firewall allows:

- TCP 22
- TCP 80
- TCP 443 from Anywhere IPv4

### Installed software

- Node.js `22.23.2`
- npm `10.9.8`
- nginx `1.24.0`
- Certbot and nginx plugin

### Gateway runtime

Directory:

```text
/opt/insureit-gateway
```

Files:

- `server.js`
- `package.json`
- `package-lock.json`
- `.env` (mode 600; contains secrets; never expose)

Systemd service:

```text
insureit-gateway.service
```

Useful checks:

```bash
sudo systemctl status insureit-gateway --no-pager
sudo journalctl -u insureit-gateway -n 50 --no-pager
curl http://127.0.0.1:3001/health
curl https://insureit.duckdns.org/health
```

Nginx proxies:

- `/health` → `127.0.0.1:3001/health`
- `/uat/icall/` → `127.0.0.1:3001`

Protected-route behavior was verified:

```bash
curl -X POST "https://insureit.duckdns.org/uat/icall/status" \
  -H "Content-Type: application/json" \
  -d '{"loginId":"ABCDE1234F"}'
```

Expected and verified response without relay secret:

```json
{"statusCode":401,"status":"failed","message":"Unauthorized"}
```

## 4. Gateway code

Repository file:

```text
infrastructure/icall-gateway/server.js
```

Gateway routes:

```text
POST /uat/icall/register
POST /uat/icall/status
POST /uat/icall/sso
POST /uat/icall/tcc
GET  /health
```

Security behavior:

- Relay authentication via `Authorization: Bearer <RELAY_SECRET>`.
- Timing-safe secret comparison.
- Helmet.
- JSON body size limit.
- Rate limiting.
- PAN/login ID validation.
- SSO redirect URL validation against HTTPS and `www.icallinsurance.com`.
- Base64 iCall payload decoding.

When gateway code changes, update the Lightsail copy and restart the service. A GitHub commit alone does not update the running Lightsail service.

Typical one-line update command in Lightsail browser SSH:

```bash
cd /opt/insureit-gateway && curl -fL "https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/infrastructure/icall-gateway/server.js" -o server.js && node --check server.js && sudo systemctl restart insureit-gateway && sudo systemctl status insureit-gateway --no-pager
```

Avoid multiline commands with trailing `\` in the Lightsail browser terminal; pastes repeatedly broke into separate commands during setup.

## 5. Portal-side integration files

Primary files:

```text
apps/web-portal/lib/icall-training-api.ts
apps/web-portal/app/intermediaries/applications/icall-training-actions.ts
apps/web-portal/app/intermediaries/applications/icall-training-dashboard.tsx
apps/web-portal/app/intermediaries/applications/icall-training-launcher.tsx
apps/web-portal/next.config.mjs
```

### Portal API client

`apps/web-portal/lib/icall-training-api.ts`:

- Calls only the AWS gateway.
- Sends relay secret as server-side Bearer token.
- Uses `cache: "no-store"` and request timeout.
- Decodes Base64 `payload` if present.
- Accepts iCall SSO redirect field variants.

### Server action

`launchIcallTrainingSso(applicationId, submittedLoginId)`:

- Requires an authorized POSP/MISP manager.
- Loads the application training login ID from Supabase.
- Verifies the submitted login ID matches the current application.
- Calls gateway SSO.
- Normalizes string/numeric status codes.
- Validates returned redirect URL protocol and hostname.
- Returns a temporary SSO redirect URL to the client launcher.

### Launcher

`IcallTrainingLauncher`:

- Opens a full-screen iframe modal.
- Supports Escape and close.
- Has an **Open in new tab** fallback.
- The new-tab action now requests a fresh SSO URL instead of reusing the iframe URL because iCall URLs are single-use/short-lived.

## 6. Important commits from this work

Relevant commits in order:

- `8c662886b87c3ba43dc0a5b7bc0f4ca36a8111b8` — added full gateway code.
- `707b97bfc0555b324d4e13cabca11fe926c1824f` — routed portal iCall API calls through gateway.
- `0639b22c600ca800447feea4cd69bc36c5d56b00` — opened iCall training in secure iframe.
- `f6841e34f409898f1324c407d9d4c37b058a12c1` — decoded wrapped gateway responses.
- `54ddbcb6e9d64d2343f700582c761d6c8e4fc15e` — normalized string `"200"` SSO status codes.
- `8d240db60df06000fdc73b2be61747e2127e2690` — allowed `https://www.icallinsurance.com` in portal CSP `frame-src`.
- `f914ed71a8ff21d6b45a85c27d5360eb43b9bb80` — fresh SSO URL for new-tab fallback.

Do not assume any commit is live without checking the current Vercel production deployment.

## 7. Verified candidate and current functional state

Test application route:

```text
/intermediaries/applications/c657d030-6d94-44ea-b038-2d4de6748390/workflow?stage=review
```

Test candidate shown in UI:

- Name: Aman Sharma
- iCall login ID: `VHRFE9867E`
- Internal POS code: `POSP-2026-00004`
- Training allotted: `15:00`
- Completed: `00:00:00`
- Remaining: `15:00:00`
- Exam: not attempted

Verified behavior:

- Registration API works.
- Status sync works and populates the live iCall training dashboard.
- AWS gateway health works publicly over HTTPS.
- Relay protection works.
- SSO API returns `statusCode: "200"`, `status: "success"`, and `data.redirectUrl`.
- SSO redirect URL works when opened fresh in a new top-level tab.
- iCall iframe itself now renders after both parties fixed CSP restrictions.
- iCall currently falls back to the normal login page inside the iframe; automatic authentication is not retained.

## 8. CSP debugging history and current policy

### iCall-side frame policy

Initially iCall returned:

```text
Content-Security-Policy: frame-ancestors 'self'
```

and also had `X-Frame-Options`. Their IT team:

- removed `X-Frame-Options`;
- added the current UAT origin to their `frame-ancestors` policy:

```text
frame-ancestors 'self' https://insureit-drab.vercel.app;
```

The production domain is not finalized. iCall was told this UAT origin is temporary and that the allowlisted production origin must be updateable later.

### InsureIt-side frame policy

Chrome Issues then proved our own CSP blocked the iframe with directive `frame-src` for resource `https://www.icallinsurance.com`.

This was fixed in `apps/web-portal/next.config.mjs` by adding:

```text
frame-src 'self' https://www.icallinsurance.com
```

After deployment, the iCall page rendered inside the iframe.

## 9. Current unresolved issue: iframe SSO session cookie

The iframe now loads iCall, but it displays the normal Login ID/Password form instead of auto-authenticating.

A fresh SSO URL still auto-authenticates in a top-level new tab. This isolates the remaining problem to cross-site iframe session handling.

Chrome DevTools → Application → Cookies → `https://www.icallinsurance.com` showed the iCall session/auth cookie with:

- Domain: `www.icallinsurance.com`
- Secure: yes
- HttpOnly: yes
- SameSite: `Lax`

Because iCall is loaded in a cross-site iframe under `insureit-drab.vercel.app`, `SameSite=Lax` prevents the authentication cookie from being sent/retained for iframe navigation.

The required vendor-side cookie setting is typically:

```text
SameSite=None; Secure
```

The iCall IT team has been informed. This cannot be fixed by InsureIt JavaScript, Nginx, Vercel, or iframe attributes because the cookie is owned and issued by iCall.

### Exact human-style message already sent/requested

```text
Hi, we checked the iCall session cookie inside the iframe. The cookie is getting created, but its SameSite setting is showing as Lax. Because of this, the SSO session is not being maintained inside the iframe and it redirects to the normal login page.

Please change the session/auth cookie setting to:

SameSite=None; Secure

The cookie is already Secure and HttpOnly, so only the SameSite setting needs to be updated.
```

## 10. Single-use SSO URL behavior

After the iframe consumes an SSO URL, opening the same URL in a new tab can display:

```text
Training In-Complete. ID Expired
```

This indicates iCall SSO URLs are single-use or short-lived. Do not reuse an iframe URL for the new-tab fallback.

The launcher was changed so **Open in new tab** calls the server action again and receives a fresh redirect URL.

When testing:

1. Reload the workflow page.
2. Click **Open training**.
3. For new-tab testing, use the button that requests a fresh URL after commit `f914ed71...` is deployed.
4. Do not manually reuse an older redirect URL.

## 11. Immediate next steps for the next chat

1. Confirm the latest Vercel production deployment includes commit `f914ed71a8ff21d6b45a85c27d5360eb43b9bb80` or a later commit containing it.
2. Wait for iCall to confirm the authentication/session cookie is now `SameSite=None; Secure`.
3. Test in Incognito or delete all cookies for `icallinsurance.com` before retesting.
4. Click **Open training** and verify the iframe opens directly to the authenticated training dashboard without showing the login form.
5. In DevTools Application → Cookies, verify the relevant iCall session cookie shows `SameSite=None`, `Secure`, and `HttpOnly`.
6. Test the fresh **Open in new tab** fallback separately.
7. Once iframe SSO works, test:
   - training page navigation;
   - session persistence through subsequent training/exam pages;
   - mobile layout;
   - close/reopen behavior;
   - status sync after activity;
   - expired/completed candidate responses.
8. Production preparation:
   - decide final production application domain;
   - provide final origin to iCall for `frame-ancestors`;
   - confirm whether the same static IP `3.111.28.10` can be whitelisted for both UAT and production with separate endpoints/tokens;
   - rotate the UAT token because it was exposed during setup;
   - keep production secrets out of GitHub and client-side variables.

## 12. What must not be changed casually

- Do not bypass iCall cookie or CSP controls using insecure proxies or response-header rewriting of the iCall application.
- Do not expose redirect URLs, relay secrets, auth tokens, cookies, or full sensitive identifiers in logs/UI/chat.
- Do not relax the entire InsureIt CSP to `frame-src https:`; keep the allowlist limited to the exact iCall origin(s).
- Do not treat a successful SSO API response as proof that iframe authentication works.
- Do not treat a successful GitHub commit as proof that Vercel or Lightsail is updated.
- Do not reuse SSO URLs.
- Do not create a second Lightsail instance unless iCall requires separate UAT/production IPs or strict environment isolation is deliberately chosen.
