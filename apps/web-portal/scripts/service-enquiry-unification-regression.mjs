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
  [!page.includes('Get Quote Register') && !page.includes('Ticket Register'), 'Both sections must omit the redundant register heading row'],
  [page.includes('min-h-[calc(100dvh-11rem)] flex-col gap-4') && page.includes('flex min-h-[360px] flex-1 flex-col') && page.includes('flex min-h-0 flex-1 flex-col overflow-x-auto'), 'Register fills available height without stretching table rows'],
  [page.includes('!sectionRows.length && !error') && page.includes('/illustrations/service-enquiries-empty.svg'), 'Empty illustration only appears when no records and no load error'],
  [page.includes('section === "quotes" ? "No quote enquiries match the selected filters." : "No ticket enquiries match the selected filters."'), 'Preserve distinct ticket and quote empty-state labels'],
  [page.includes('Showing {totalRows') && page.includes('requestedPage < totalPages'), 'Pagination remains underneath the full-height register'],

  [page.includes('whitespace-nowrap text-[10px] font-black tabular-nums') && page.includes('{row.enquiry_no}'), 'Request numbers must be compact and single-line'],
  [!page.includes('formatDateTime(row.created_at)'), 'Request creation timestamp must be removed from the register'],
  [page.includes('whitespace-nowrap px-3 py-4 text-[10px] font-bold tabular-nums') && page.includes('{vehicle}'), 'Vehicle numbers must use compact no-wrap presentation'],
  [page.includes('inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-black'), 'Consent badges must not wrap'],
  [page.includes('inline-flex whitespace-nowrap rounded-full bg-[#EAF7F2]'), 'WhatsApp consent badges must not wrap'],
  [page.includes('whitespace-nowrap text-[9px] tabular-nums text-[#8A93A6]') && page.includes('formatDateTime(row.consent_accepted_at)'), 'Consent date and time must display on one line'],
  [page.includes('SectionLink href={filterUrl({ section: "tickets"') && page.includes('SectionLink href={filterUrl({ section: "quotes"'), 'Retain both enquiry section tabs'],
  [page.includes('updateServiceEnquiryStatus') && page.includes('Showing {totalRows'), 'Preserve status updates and pagination'],
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
