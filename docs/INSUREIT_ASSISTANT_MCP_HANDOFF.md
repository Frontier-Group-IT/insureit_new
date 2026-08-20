# INSUREIT Assistant MCP Handoff

> **Created:** 2026-08-20 (IST)
>
> Source of truth for the read-only INSUREIT assistant/MCP integration. Never store the assistant bearer secret, Supabase keys, signed URLs, policy documents, raw customer PII, provider payloads, tokens, passwords, cookies, or private storage paths in this file.

## Current architecture

The INSUREIT web portal exposes a server-side MCP endpoint under:

```text
POST /api/mcp/insureit-assistant
```

Canonical production origin remains:

```text
https://portal.insureit.in
```

Authentication uses the server-only environment variable:

```text
INSUREIT_ASSISTANT_API_KEY
```

Clients send it as an HTTP Bearer token. The secret must remain outside the repository and browser/client bundles.

The MCP endpoint is implemented in:

```text
apps/web-portal/app/api/mcp/insureit-assistant/route.ts
apps/web-portal/app/api/mcp/insureit-assistant/tools.ts
```

The route owns MCP JSON-RPC framing and bearer authentication. `tools.ts` owns the bounded read-only tool catalogue and Supabase lookups.

## Security boundaries

- Read-only operations only.
- Supabase admin access remains server-side.
- No PAN, Aadhaar, phone/email, full address, chassis/engine numbers, raw provider responses, storage paths, or customer identity documents are returned by the general lookup tools.
- Policy-copy Storage remains private.
- `get_policy_document` creates signed URLs only on demand with a five-minute TTL.
- Claim document lookup returns metadata only in the current version; no claim-document signed URLs are exposed.
- MCP responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Do not weaken the bearer requirement or make private document buckets public to simplify assistant access.

## Tool catalogue

### DEPLOYED baseline from PR #462

- `get_policy_document`

This tool accepts exactly one of `documentId`, `policyId`, `policyCode`, or `policyNo` and returns policy-copy metadata plus five-minute signed URLs.

### IMPLEMENTED in PR #468, not deployed until explicitly released

- `search_policies`
- `get_policy_details`
- `get_customer`
- `get_vehicle`
- `get_customer_fleet`
- `get_monthly_business`
- `search_claims`
- `get_claim_details`

Business totals must come from `policy_premium_details` (`net_premium`, `gst_amount`, `gross_premium`, OD/TP fields), not the legacy `policies.premium_amount` column.

Search tools are bounded and return operational summaries rather than complete source rows.

## Release state

**DEPLOYED:** PR #462 established the remote MCP endpoint and `get_policy_document` on `portal.insureit.in`.

**IMPLEMENTED / NOT DEPLOYED:** PR #468 expands the read-only catalogue. Its feature branch is `feature/insureit-assistant-read-tools`. Do not describe these added tools as live until PR #468 is merged, the protected production deployment workflow runs, and Vercel reports the exact deployment `READY` with `portal.insureit.in` attached.

No database migration, RLS change, Storage visibility change, or new secret is required for PR #468.

## Verification rules

- Use `.github/workflows/verify-web-portal.yml` as the canonical CI gate.
- A green CI run proves only regressions/typecheck/lint/build for that exact commit.
- After an explicit production deployment request, use the protected `.deploy/production-trigger.json` workflow and verify final Vercel state separately.
- For live assistant verification, reload/reconnect the MCP server in the client so it refreshes `tools/list`, then test representative read-only calls.
