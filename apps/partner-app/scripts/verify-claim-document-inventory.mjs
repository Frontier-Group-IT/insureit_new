import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const sql = read('../../../supabase/migrations/20261021163000_partner_claim_detail_scoped_document_inventory.sql');
const original = read('../../../docs/rollback/20261021_partner_claim_document_inventory_rollback.sql');
const detail = read('../app/claim/[id].tsx');
const registry = read('../lib/partner-assets.ts');
const documentList = read('../components/partner-claim-documents.tsx');
const client = read('../lib/claims.ts');

assert.match(sql, /partner_app_claim_in_scope\(p_claim_id\)/, 'Retain canonical claim authorization gate');
assert.match(sql, /from public\.claim_documents d[\s\S]*where d\.claim_id=p_claim_id/, 'Only return documents for this claim');
assert.match(sql, /'documents',coalesce\(\(/, 'Return an empty array when no documents exist');
for (const field of ["'id',d.id", "'name',d.file_name", "'category',d.document_type"]) assert.ok(sql.includes(field), field);
assert.doesNotMatch(sql, /'storage_path'\s*,|'storage_bucket'\s*,|'signed_url'\s*,/, 'Do not expose storage access details');
assert.match(sql, /\$function\$;\s*$/, 'Forward migration should be a complete SQL statement');
assert.match(original, /\$function\$;\s*$/, 'Rollback SQL should be complete');
assert.doesNotMatch(original, /'documents',coalesce\(\(/, 'Rollback restores previous inventory contract');
assert.match(registry, /claimDocumentsFolder: require\('\.\.\/assets\/partner\/actions\/claim-documents-folder-reference\.png'\)/);
assert.match(detail, /PartnerAssets\.actions\.claimDocumentsFolder/);
assert.match(detail, /PartnerClaimDocuments documents=\{data\.documents\}/);
assert.match(documentList, /documents === null/);
assert.match(client, /Array\.isArray\(payload\.documents\)/);
console.log('Partner scoped claim document inventory and exact folder asset contracts passed.');
