# INSUREIT — What Is Not Ready for Production

## Current decision

**DO NOT RELEASE YET.**

The website looks polished, but five important security and data-integrity problems must be fixed first.

---

## 1. Full Aadhaar can reach the browser

**Problem:** The complete Aadhaar number is decrypted and passed to browser-side components. Hiding it visually is not enough.

**Risk:** Sensitive identity data may appear in browser memory, network payloads or developer tools.

**What to do:**

- Never send the full Aadhaar number to the browser.
- Show only the last four digits.
- When Aadhaar must be changed, send the newly entered value directly to a secure server action.
- Encrypt it on the server and never return the full value.

**Release status:** BLOCKED

---

## 2. Users may open records outside their assigned scope

**Problem:** Some intermediary pages, uploads and activation actions check only the user's role. They do not always check whether that specific application belongs to the user or their team.

**Risk:** A user may access another employee's application by changing the URL or request ID.

**What to do:**

- Check both role permission and record permission on every page, API and server action.
- Use the existing application-access helper before privileged reads or updates.
- Test direct URL access using users from different teams and hierarchy levels.

**Release status:** BLOCKED

---

## 3. Customer visibility rules are inconsistent

**Problem:** Vehicle and policy pages apply employee/hierarchy scope, but the customer register can load all customers through the service-role client.

**Risk:** Employees may see customers that should belong only to another team or manager.

**What to do:**

- Decide the final customer visibility rule for every role.
- Apply the same self, hierarchy or organization-wide scope to Customers, Vehicles, Policies, Claims and Tasks.
- Document the approved role-access matrix.

**Release status:** BLOCKED

---

## 4. Partner activation can stop halfway

**Problem:** Partner ID creation, register synchronization and status updates happen through separate database operations.

**Risk:** A failure in the middle can leave one table showing Active while another table remains Pending.

**What to do:**

- Move the complete activation process into one database transaction or RPC.
- Make it safe to retry without creating duplicate IDs.
- Check and return every database error.
- Add an audit record for successful and failed activation attempts.

**Release status:** BLOCKED

---

## 5. One old claim-status action is not properly protected

**Problem:** The legacy `updateClaimStatus` server action does not use the normal claim permission guard.

**Risk:** A crafted request may change claim status without the intended role check.

**What to do:**

- Remove the old action if it is unused, or add the correct permission and record-scope checks.
- Test direct invocation, not only the visible button.

**Release status:** BLOCKED

---

# Important work after the five blockers

These items should be completed before the final production release:

| Area | What is missing |
| --- | --- |
| Automated checks | Required lint, typecheck, build and test workflow before deployment |
| Database | Confirm every migration, RLS policy, function and storage policy is applied in production |
| Errors | Replace raw Supabase/database errors with safe user messages |
| Documents | Verify real file content, not only browser MIME type; add malware controls |
| Audit trail | Record important login, permission, activation, role and workflow changes |
| Reports | Complete the Reports page or hide it from production navigation |
| Performance | Use database filtering and pagination instead of loading complete registers |
| iCall | Verify final domain, allowlist, iframe cookie and SSO behavior in production |
| Monitoring | Configure error monitoring, alerts, health checks and incident ownership |
| Recovery | Test backup restore and production rollback before launch |
| User testing | Test every main workflow with real role-based test users on desktop and mobile |

---

# Recommended work order

## Phase 1 — Security and data safety

1. Remove full Aadhaar from all browser payloads.
2. Add record-level authorization to intermediary pages, APIs and actions.
3. Fix customer and hierarchy visibility.
4. Protect or remove the old claim-status action.

## Phase 2 — Database integrity

1. Make Partner activation atomic and retry-safe.
2. Add audit logging.
3. Verify migrations, RLS and storage policies in the target Supabase project.

## Phase 3 — Release safety

1. Add CI checks and automated authorization tests.
2. Add safe error handling and document-security checks.
3. Complete monitoring, backup, restore and rollback testing.

## Phase 4 — Final production verification

1. Complete role-based UAT.
2. Verify iCall and all external integrations.
3. Run the full production release checklist.
4. Deploy only when all five blockers are closed and evidence is recorded.

---

# Simple release rule

The website can move to production only when:

- All five BLOCKED items above are fixed and tested.
- The exact release commit passes lint, typecheck, build and tests.
- Supabase migrations and security policies are confirmed as applied.
- Backup restore and rollback are tested.
- Business and security reviewers give final approval.

Until then, the correct status is **NOT READY FOR PRODUCTION**.
