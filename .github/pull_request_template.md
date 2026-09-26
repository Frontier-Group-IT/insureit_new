## Change summary

Describe the user-visible or technical change and its scope.

## Mandatory pre-merge verification

**A pull request is not merge-ready merely because GitHub reports `mergeable: true`. The creating/continuing agent owns CI through green status.**

- [ ] All required GitHub Actions checks for this PR have completed successfully.
- [ ] TypeScript / typecheck is green.
- [ ] Lint is green.
- [ ] Production build is green.
- [ ] Relevant regression, security, schema, mobile, Partner, or workflow-specific checks are green where applicable.
- [ ] Any failed check was investigated from its logs, fixed in this PR, and rerun; no check was bypassed, weakened, skipped, or handed back to the user for routine local verification.
- [ ] If a required check cannot be made green, the PR is explicitly marked **BLOCKED** with the exact external dependency/evidence instead of being described as ready to merge.

Agents must continue fixing TypeScript, lint, build, test, regression, schema-workflow, or other repository verification failures until this checklist is satisfied or a genuine external blocker is documented. Do not merge before the required gate is green, even when the GitHub mergeability flag is true.

## Deployment / schema state

Record these separately; merge is not deployment and a committed migration is not proof it was applied.

- CI verification: PENDING / PASSED / BLOCKED
- Merge: NOT MERGED / MERGED
- Migration (if any): NOT APPLIED / APPLIED / N/A
- Deployment: NOT DEPLOYED / DEPLOYED / N/A
- Runtime/live verification: UNVERIFIED / VERIFIED / N/A
