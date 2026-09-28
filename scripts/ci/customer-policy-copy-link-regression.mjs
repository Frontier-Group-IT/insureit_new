import fs from 'node:fs';

const migrationPath = 'supabase/migrations/202609280001_link_customer_policy_copy_to_external_policy.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');

const required = [
  "new.document_type <> 'policy_copy'",
  'new.external_policy_id is not null',
  'ep.customer_id = new.customer_id',
  'ep.added_by = new.uploaded_by',
  "ep.added_via = 'customer_app'",
  "interval '10 minutes'",
  'candidate_count = 1',
  'before insert on public.customer_documents',
];

for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Missing policy-copy linkage guard: ${token}`);
}

console.log('Customer policy-copy linkage regression guard passed.');
