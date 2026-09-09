import fs from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match in ${path}, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const claimsWorkspace = 'apps/web-portal/app/claims/claims-workspace.tsx';
replaceOnce(
  claimsWorkspace,
  'import Link from "next/link";\n',
  'import Link from "next/link";\nimport { ExternalClaimOperationsEntry } from "@/components/claims/external-claim-operations-entry";\n',
  'claims workspace import',
);
replaceOnce(
  claimsWorkspace,
  '  const assistanceRequested = externalRows.filter((claim) => claim.assistance_status === "requested").length;',
  '  const assistanceRequested = externalRows.filter((claim) => claim.claim_service_mode === "self_managed" && claim.assistance_status === "requested").length;',
  'external assistance count',
);
replaceOnce(
  claimsWorkspace,
  '{claim.policy_service_source === "external" && claim.claim_service_mode !== "self_managed" ? <span className="mt-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-800">External policy · assisted</span> : null}',
  '{claim.policy_service_source === "external" ? <span className="mt-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-800">External policy</span> : null}',
  'external policy badge',
);
replaceOnce(
  claimsWorkspace,
  '<td className="px-2 py-2 text-center"><Link prefetch={false} href={`/claims/${claim.id}`} className="inline-flex h-7 items-center justify-center rounded-md bg-[#003A83] px-3 text-[10.5px] font-medium text-white">Proceed</Link></td>',
  '<td className="px-2 py-2 text-center">{isExternalClaim(claim) ? <ExternalClaimOperationsEntry claimId={claim.id} /> : <Link prefetch={false} href={`/claims/${claim.id}`} className="inline-flex h-7 items-center justify-center rounded-md bg-[#003A83] px-3 text-[10.5px] font-medium text-white">Proceed</Link>}</td>',
  'external proceed action',
);
replaceOnce(
  claimsWorkspace,
  'function isExternalClaim(claim: QueueClaimRow) { return claim.claim_service_mode === "self_managed"; }',
  'function isExternalClaim(claim: QueueClaimRow) { return claim.policy_service_source === "external"; }',
  'external classification',
);

const claimPage = 'apps/web-portal/app/claims/[id]/page.tsx';
replaceOnce(
  claimPage,
  'import { AssistanceIntakePanel } from "@/components/claims/assistance-intake-panel";\n',
  'import { AssistanceIntakePanel } from "@/components/claims/assistance-intake-panel";\nimport { ExternalClaimOperationsEntry } from "@/components/claims/external-claim-operations-entry";\n',
  'claim detail entry import',
);
replaceOnce(
  claimPage,
  '  if (claim.claim_service_mode === "self_managed") {\n',
  '  if (claim.policy_service_source === "external" && claim.claim_service_mode === "self_managed") {\n    return (\n      <ClaimManagerShell title={`External Claim - ${claim.claim_no}`} backHref={backHref}>\n        <ExternalClaimOperationsEntry claimId={claim.id} auto />\n      </ClaimManagerShell>\n    );\n  }\n\n  if (claim.claim_service_mode === "self_managed") {\n',
  'direct external takeover boundary',
);

const mobileStartClaim = 'apps/mobile-app/app/customer/start-claim.tsx';
replaceOnce(
  mobileStartClaim,
  "type SelfManagedClaimRow = {\n  id: string;\n  current_status?: string | null;\n  created_at?: string | null;\n};",
  "type SelfManagedClaimRow = {\n  id: string;\n  current_status?: string | null;\n  created_at?: string | null;\n  claim_service_mode?: 'broker_managed' | 'self_managed' | null;\n};",
  'mobile external claim row ownership',
);
{
  const source = fs.readFileSync(mobileStartClaim, 'utf8');
  const renamed = source.replaceAll('findActiveSelfManagedClaim', 'findActiveExternalPolicyClaim');
  if (renamed === source) throw new Error('mobile helper rename: no matches');
  fs.writeFileSync(mobileStartClaim, renamed);
}
replaceOnce(
  mobileStartClaim,
  ".select('id,current_status,created_at')\n    .eq('external_policy_id', externalPolicyId)\n    .eq('claim_service_mode', 'self_managed')",
  ".select('id,current_status,created_at,claim_service_mode')\n    .eq('external_policy_id', externalPolicyId)",
  'mobile external active claim query',
);
replaceOnce(
  mobileStartClaim,
  "  const unsettledClaims = claims.filter((claim) => !SETTLED_SELF_MANAGED_STATUSES.has(claim.current_status ?? ''));\n  if (!unsettledClaims.length) return null;\n\n  const claimIds = unsettledClaims.map((claim) => claim.id);",
  "  const unsettledClaims = claims.filter((claim) => !SETTLED_SELF_MANAGED_STATUSES.has(claim.current_status ?? ''));\n  if (!unsettledClaims.length) return null;\n\n  const managedClaim = unsettledClaims.find((claim) => claim.claim_service_mode === 'broker_managed');\n  if (managedClaim) return managedClaim;\n\n  const selfManagedClaims = unsettledClaims.filter((claim) => claim.claim_service_mode !== 'broker_managed');\n  const claimIds = selfManagedClaims.map((claim) => claim.id);",
  'mobile managed external duplicate detection',
);
replaceOnce(
  mobileStartClaim,
  '  for (const claim of unsettledClaims) {',
  '  for (const claim of selfManagedClaims) {',
  'mobile self-managed milestone loop',
);

const deployWorkflow = '.github/workflows/deploy-production.yml';
replaceOnce(
  deployWorkflow,
  '          else\n            echo "::error::Supabase migration changed without a matching automated schema deployment gate:"',
  '          elif grep -qx \'supabase/migrations/20260909121000_external_claim_canonical_operations_workflow.sql\' <<<"$changed_migrations"; then\n            schema_workflow="apply-external-claim-canonical-operations.yml"\n            echo "External Claim canonical Operations migration detected. Waiting for its schema workflow..."\n          else\n            echo "::error::Supabase migration changed without a matching automated schema deployment gate:"',
  'production schema gate',
);

const verifyWorkflow = '.github/workflows/verify-web-portal.yml';
replaceOnce(
  verifyWorkflow,
  '      - name: External claim read-only nine-stage regression\n        run: node scripts/external-claim-readonly-journey-regression.mjs\n',
  '      - name: External claim read-only nine-stage regression\n        run: node scripts/external-claim-readonly-journey-regression.mjs\n      - name: External Claim canonical Operations workflow regression\n        run: node scripts/external-claim-canonical-operations-regression.mjs\n',
  'web verification regression step',
);
replaceOnce(
  verifyWorkflow,
  '            echo "- Claim regressions: spot multi-upload/intimation and External Claim read-only nine-stage protection"',
  '            echo "- Claim regressions: spot multi-upload/intimation, External Claim read-only legacy protection, and External Claim canonical Operations workflow"',
  'web verification summary',
);

console.log('External Claim canonical Operations integration patch applied.');
