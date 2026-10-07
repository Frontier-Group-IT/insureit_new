import fs from 'node:fs';

const nav = fs.readFileSync(new URL('../components/claim-manager/app-navigation.tsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/service-enquiries/page.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../../supabase/migrations/20261007111500_unify_support_tickets_with_service_enquiries.sql', import.meta.url), 'utf8');

const checks = [
  [nav.includes('label:"Service Enquiries"'), 'Sidebar must expose Service Enquiries'],
  [!nav.includes('label:"Tasks"'), 'Sidebar Tasks heading must be removed'],
  [!nav.includes('label:"All Tasks"'), 'All Tasks child link must be removed'],
  [page.includes('"support_ticket"'), 'Service Enquiries page must support support_ticket records'],
  [page.includes('Support Ticket'), 'Service Enquiries page must label support-ticket rows'],
  [migration.includes("'support_ticket'"), 'Migration must allow support_ticket service type'],
  [migration.includes('service_enquiry_messages'), 'Migration must provide unified support messages'],
  [migration.includes('service_enquiry_attachments'), 'Migration must provide unified support attachments'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log('Service Enquiries unification regression passed.');
