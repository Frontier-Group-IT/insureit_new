# Life/Health document refinement — 2026-10-01

## Scope

This change is limited to the Life and Health policy workflow in the web portal.

- Add Policy shows: Proposal Form, Illustration Form, Payment Receipt, Other Form.
- Life/Health case detail shows: Policy Copy, Proposal Form, Illustration Form, Payment Receipt, Other Form.
- Issued Life/Health policy edit shows the same five-document set.
- `Mark Policy Issued` uses the approved light-purple/lavender section treatment while its inputs remain white.
- Historical KYC document handling remains supported server-side, but KYC is not shown in the new Life/Health document action sets.
- Existing uploaded documents on issued-policy edit now expose an explicit **Replace** file action plus a compact **Eye / View** action immediately to its right.
- Existing uploaded documents on Life/Health case detail use the same compact arrangement, so controls read like **Replace Policy Copy [Eye]** instead of rendering the Eye as a separate button on the left.
- Documents that have not yet been uploaded continue to show their existing **Add** actions.

## Technical boundary

- No database migration.
- No RLS change.
- No mobile/native build or APK change.
- Existing signed document-view URLs and existing replace/upload server actions are reused.
- Existing `benefit_illustration` and `premium_receipt` Life/Health document types are reused.

## Delivery

Original document-action refinement: branch `feature/life-health-document-actions-2026-10-01`, PR #2634, merged to `main`.

Current View/Replace refinement: branch `fix/policy-document-view-replace-actions`.

The current branch must pass the canonical web verification workflow and remain unmerged until explicit user approval.