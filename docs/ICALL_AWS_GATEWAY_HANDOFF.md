# iCall AWS Gateway and SSO Integration Handoff

> **Updated:** 2026-08-09 00:43 IST
>
> Read this file before changing any iCall, training, SSO, gateway, CSP, iframe, or production-domain integration behavior. Also read `docs/PRODUCTION_DOMAIN_HANDOFF.md` for the canonical production-domain state. Never commit secrets, tokens, cookies, passwords, private keys, full PAN values, or temporary SSO URLs.

## Current architecture

The Next.js portal calls the private AWS Lightsail gateway. The browser never receives the relay secret or iCall auth token.

Gateway routes:

```text
POST /uat/icall/register
POST /uat/icall/status
POST /uat/icall/sso
POST /uat/icall/tcc
GET  /health
```

Gateway hostname:

```text
https://insureit.duckdns.org
```

Canonical production portal origin:

```text
https://portal.insureit.in
```

Temporary fallback origin retained during stabilization:

```text
https://insureit-drab.vercel.app
```

Primary integration files:

```text
apps/web-portal/lib/icall-training-api.ts
apps/web-portal/app/intermediaries/applications/icall-training-actions.ts
apps/web-portal/app/intermediaries/applications/icall-training-dashboard.tsx
apps/web-portal/app/intermediaries/applications/icall-training-launcher.tsx
apps/web-portal/app/intermediary-portal/icall-actions.ts
apps/web-portal/app/intermediary-portal/icall-portal-launcher.tsx
apps/web-portal/app/intermediary-portal/page.tsx
infrastructure/icall-gateway/server.js
```

## Verified provider behavior

- Candidate registration works.
- Training-status sync works for the internal workflow.
- SSO returns `data.redirectUrl`.
- A fresh redirect URL works in a top-level browser tab.
- Redirect URLs are short-lived or single-use and must never be reused.
- The INSUREIT application CSP permits `https://www.icallinsurance.com` as a frame source.
- On the former Vercel origin, prior iframe testing also exposed a cookie compatibility concern because the iCall session cookie was observed with `SameSite=Lax`; the vendor-side requirement remains `SameSite=None; Secure` for cross-site iframe authentication.

## Production-domain migration verification — 2026-08-09

**VERIFIED BY USER**

The INSUREIT production application has moved to:

```text
https://portal.insureit.in
```

After the move:

- INSUREIT application workflows generally work from the new domain.
- iCall SSO successfully generates a fresh provider redirect.
- `Open in new tab` successfully opens the authenticated iCall training session from the new production domain.
- The iframe path fails in the browser with `www.icallinsurance.com refused to connect`.

This evidence proves the server-side SSO chain is functioning:

```text
INSUREIT / Vercel server
  -> protected AWS gateway
  -> iCall AuthenticateUser
  -> fresh www.icallinsurance.com SSO URL
  -> successful top-level navigation
```

The remaining failure is therefore in the browser iframe path, not in the AWS relay route or SSO URL generation.

### Required vendor action

Ask iCall to add:

```text
https://portal.insureit.in
```

to the iCall site's allowed iframe / CSP `frame-ancestors` configuration.

Also ask iCall to verify that the authentication/session cookie used for iframe SSO supports cross-site iframe use, including `SameSite=None; Secure`. Keep `HttpOnly` enabled where applicable.

Retain `Open in new tab` as the safe working fallback until the iframe is directly verified from the official domain.

### AWS conclusion for this domain migration

The current `infrastructure/icall-gateway/server.js` route is server-to-server and protected by the private relay Bearer secret. It has no browser-origin allow-list that needs to change merely because the public INSUREIT origin moved from the Vercel hostname to `portal.insureit.in`.

Do not modify the AWS gateway, relay secret, iCall token, or Nginx routing merely to address the browser message `www.icallinsurance.com refused to connect`. That symptom is controlled by the embedded iCall site's frame/cookie policy.

## Internal manager workflow

The existing internal action remains manager-scoped and must not be weakened:

```text
launchIcallTrainingSso(applicationId, submittedLoginId)
```

It validates manager scope, stored login ID and the returned HTTPS host before returning a temporary SSO URL.

## External intermediary portal implementation

Commits:

```text
a96aaa0fd03fc09f0e69043d0bd8fff07e62e932  Add secure portal iCall SSO action
189a7562d72a314d8190f51380ff8f14c8481296  Add portal iCall iframe launcher
da67feac6a4cb93f6cbccf039c455afd38bd1b9b  Connect portal dashboard to secure iCall training iframe
```

### External authorization action

File:

```text
apps/web-portal/app/intermediary-portal/icall-actions.ts
```

`launchPortalIcallTrainingSso()`:

- accepts no application ID or PAN from the browser;
- resolves the authenticated active intermediary profile server-side;
- resolves the portal account by authenticated user ID;
- denies disabled accounts;
- uses the portal account's own POSP/MISP application;
- for a Partner portal, resolves the latest linked POSP/MISP child through the canonical `partner_record_id`;
- uses POSP PAN for POSP and designated-person PAN for MISP when a stored training login ID is unavailable;
- validates the returned SSO URL as HTTPS on `www.icallinsurance.com`;
- logs only non-sensitive application/intermediary IDs and a controlled error message.

### External launcher

File:

```text
apps/web-portal/app/intermediary-portal/icall-portal-launcher.tsx
```

Behavior:

- requests a fresh SSO URL for every iframe launch;
- opens a full-screen Training & Examination iframe;
- supports Escape and close;
- requests another fresh URL for the new-tab fallback;
- refreshes the portal page after closing so saved status can be re-read;
- never displays the SSO URL or provider secrets.

### Dashboard behavior

File:

```text
apps/web-portal/app/intermediary-portal/page.tsx
```

- POSP portal launches its own iCall qualification account.
- MISP portal launches the designated person's qualification account.
- Partner portal does not own training/exam state; it displays and launches the linked POSP/MISP child's qualification workflow.
- Button labels adapt to status: Start training, Continue training, Go to examination, Reattempt examination, View completion status.
- Partner UI clearly labels the information as linked qualification.

## Remaining work before final production sign-off

1. Keep `https://portal.insureit.in` as the canonical production origin.
2. Obtain iCall confirmation that `https://portal.insureit.in` is allowed by their iframe/frame-ancestor configuration.
3. Confirm iCall's iframe session cookie behavior is compatible with cross-site embedding (`SameSite=None; Secure`).
4. Verify the iframe again from the official production domain after the vendor change.
5. Keep the new-tab fallback until iframe verification succeeds.
6. Review whether a Partner can have multiple linked POSP/MISP children; current implementation selects the most recently updated child. If multiple qualification children are valid, add an explicit child selector rather than relying on latest updated.
7. Add self-service status synchronization with a provider-call cooldown if still required by the product. Current close behavior reloads saved state but does not itself call iCall status.
8. Test disabled accounts, missing training registration, no linked child, provider timeout and malformed SSO response.
9. Confirm no temporary URL, token, full PAN or provider cookie appears in logs or client-visible errors.

## Safety rules

- Never call iCall directly from browser code.
- Never trust a browser-supplied application ID, PAN or login ID for self-service launch.
- Never reuse a redirect URL.
- Never assign Partner-owned training/exam state; qualification belongs to POSP/MISP.
- Do not claim iframe success until it is directly verified from `https://portal.insureit.in`.
- Do not bypass vendor cookie/CSP controls using an insecure proxy.
- Do not change the AWS gateway solely because the public web origin changes; first prove a server-to-server gateway failure.
