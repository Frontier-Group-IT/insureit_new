# INSUREIT Production Domain and Go-Live Handoff

> **Created:** 2026-08-09 (IST)
>
> This file is the mandatory source of truth for the INSUREIT production custom domain, GoDaddy DNS, Vercel domain binding, Supabase Auth URL configuration, and domain-sensitive integration checks. Read it before changing production domains, DNS, authentication redirect URLs, public portal URLs, iframe origin allow-lists, or launch-time domain configuration.
>
> Never store GoDaddy invitation links/tokens, DNS-provider credentials, account passwords, API keys, relay secrets, provider tokens, cookies, private keys, or other secrets in this file.

## 1. Canonical production portal domain

**VERIFIED / APPLIED**

The official INSUREIT application URL is:

```text
https://portal.insureit.in
```

The client domain `insureit.in` is managed in GoDaddy. Delegate access was provided for DNS/domain administration.

The production application remains hosted on Vercel. The former Vercel hostname is retained temporarily as a fallback during stabilization:

```text
https://insureit-drab.vercel.app
```

Do not remove the fallback until launch stabilization and domain-sensitive integrations are verified.

## 2. GoDaddy DNS state

**APPLIED AND VERIFIED BY USER**

The production portal subdomain is configured in GoDaddy using the Vercel-provided project-specific CNAME target:

```text
Type:  CNAME
Name:  portal
Value: 380875aaa24cea5d.vercel-dns-017.com
TTL:   1 Hour
```

`portal.insureit.in` resolves correctly to the Vercel-hosted INSUREIT site.

`admin.insureit.in` was not used because `admin` was already occupied in the client's DNS configuration.

### DNS safety rules

- Do not modify unrelated `@`, `www`, MX, TXT, SPF, DKIM, DMARC, Microsoft 365, mail, verification, or existing website records as part of INSUREIT portal work.
- Do not create speculative subdomains merely to reserve names. Create DNS only for an implemented service with a defined owner and routing plan.
- Before major DNS changes, capture/export the current DNS zone so rollback information is available.
- Check domain auto-renew, account contact ownership and protection settings before production launch, but do not alter client billing/ownership arrangements without authorization.

## 3. Vercel custom-domain state

**VERIFIED / DEPLOYED BY USER**

`portal.insureit.in` is attached to the existing INSUREIT Vercel project and routes to the production application over HTTPS.

The Vercel production environment variable:

```text
NEXT_PUBLIC_PORTAL_URL
```

was updated to use:

```text
https://portal.insureit.in
```

A production deployment was triggered after the environment-variable change, and the user verified that the site and normal application workflows work from the new domain.

Do not change unrelated integration environment variables solely because the public hostname changed. In particular, do not rotate or replace Supabase keys, iCall credentials, gateway secrets, AuthBridge configuration, or Google Document AI identity settings as a domain-migration step.

## 4. Supabase Auth URL configuration

**APPLIED AND VERIFIED BY USER**

Supabase Authentication production Site URL is now:

```text
https://portal.insureit.in
```

The redirect allow-list contains:

```text
https://portal.insureit.in
https://portal.insureit.in/invite
https://insureit-drab.vercel.app
https://insureit-drab.vercel.app/invite
```

The old Vercel entries are retained temporarily for migration safety and previously issued links.

Do not remove the old redirect URLs until production stabilization is complete and there is no remaining dependency on the old origin.

## 5. Verified user-journey state after domain migration

**VERIFIED BY USER**

After the custom-domain migration and redeployment:

- `https://portal.insureit.in` opens the INSUREIT production application correctly.
- Normal application features tested by the user continue working from the new domain.
- Authentication/session behavior works from the new domain.
- iCall SSO generation works far enough to open the iCall training session successfully in a new browser tab.

Do not interpret successful general navigation as proof that every external integration is production-verified. Continue to test domain-sensitive integrations explicitly.

## 6. iCall iframe state — external vendor action required

**PARTIALLY VERIFIED / BLOCKED ON VENDOR IFRAME CONFIGURATION**

Observed behavior from `portal.insureit.in`:

- iCall training SSO is generated.
- `Open in new tab` opens the iCall training session successfully.
- Embedding `www.icallinsurance.com` inside the INSUREIT iframe fails with browser message `www.icallinsurance.com refused to connect`.

This isolates the remaining issue to the browser iframe path rather than the INSUREIT-to-AWS-to-iCall SSO API path.

Current INSUREIT CSP already permits:

```text
frame-src 'self' https://www.icallinsurance.com
```

The AWS gateway does not control whether `www.icallinsurance.com` may be embedded in the browser.

### Required iCall vendor change

Ask iCall to add:

```text
https://portal.insureit.in
```

to the allowed iframe / CSP `frame-ancestors` configuration for the iCall training site.

Also ask iCall to verify that the authentication/session cookie used for cross-site iframe SSO is compatible with iframe usage, including the required `SameSite=None; Secure` behavior. `HttpOnly` should remain enabled for session cookies where applicable.

Retain `Open in new tab` as the working fallback until the iframe is directly verified from the official domain.

Do not attempt to bypass the vendor's frame policy with an insecure proxy.

## 7. AWS gateway and AuthBridge domain impact

**NO DOMAIN-SPECIFIC CHANGE REQUIRED BASED ON CURRENT IMPLEMENTATION**

The current server-side integration path remains:

```text
portal.insureit.in browser
  -> Vercel / INSUREIT server
  -> https://insureit.duckdns.org AWS gateway
  -> iCall and AuthBridge providers
```

The AWS integration gateway is protected by the relay Bearer secret and is called server-side. Its current implementation has no browser-origin allow-list that needs to be changed merely because the public portal moved to `portal.insureit.in`.

AuthBridge RC lookup is also server-to-server through the same protected gateway. Do not change the AWS/Nginx/AuthBridge routing solely for the public-domain migration.

A future migration from `insureit.duckdns.org` to an official service hostname such as `api.insureit.in` or `integrations.insureit.in` may be considered separately, but it is not required for the current production launch. Such a migration would require DNS, TLS, Nginx/server-name, Vercel environment, and integration regression testing and should not be introduced casually immediately before launch.

## 8. Google Document AI domain impact

No custom-domain migration change is currently required for the Google Document AI OIDC architecture. Production authentication is tied to the Vercel project/team/environment identity rather than the browser's custom hostname.

Still perform a production OCR regression from `portal.insureit.in` before final launch sign-off. Do not infer OCR production health solely from domain routing.

## 9. Recommended pre-launch domain checklist

Before declaring domain/go-live work complete:

1. Confirm `portal.insureit.in` is valid in Vercel and serves the exact intended production deployment over HTTPS.
2. Confirm Supabase Site URL and redirect allow-list remain as documented above.
3. Test login, logout, page refresh, protected routes, invite flow and any password-reset/email-link flow used by the product.
4. Test one AuthBridge RC lookup from the official domain.
5. Test one supported Policy OCR upload/review/apply flow from the official domain.
6. Test Partner/POSP/MISP workflows and document access from the official domain.
7. Test iCall new-tab SSO.
8. After iCall confirms their new origin allow-list/cookie change, verify the iframe directly.
9. Keep the old Vercel hostname and Supabase redirects until the stabilization period is complete.
10. Capture/export GoDaddy DNS and verify domain auto-renew/protection/contact ownership before launch.

## 10. Recommended production-domain architecture

For launch, keep the architecture simple:

```text
insureit.in
  -> client/public website as currently configured

www.insureit.in
  -> client/public website as currently configured

portal.insureit.in
  -> INSUREIT production application on Vercel
```

Do not add `admin`, `app`, `login`, `auth`, `api`, `staging`, or similar hostnames unless there is a concrete implemented service requiring them.

## 11. Evidence labels

- GoDaddy `portal` CNAME: **APPLIED / VERIFIED BY USER**
- `portal.insureit.in` loading INSUREIT: **VERIFIED BY USER**
- Vercel production deployment after portal URL update: **DEPLOYED BY USER; application behavior verified from new domain**
- Supabase Site URL/redirects: **APPLIED / VERIFIED BY USER**
- iCall new-tab SSO: **VERIFIED BY USER**
- iCall iframe on new domain: **BLOCKED on provider frame/cookie configuration**
- AWS/AuthBridge domain-specific changes: **not required by current architecture; direct feature regression still recommended before launch**
- Removal of old Vercel fallback: **NOT YET APPROVED / NOT YET RECOMMENDED**
