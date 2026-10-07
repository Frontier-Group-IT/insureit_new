import fs from 'node:fs';

const raise = fs.readFileSync(new URL('../app/customer/raise-support-ticket.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../app/customer/support-ticket-detail.tsx', import.meta.url), 'utf8');

const checks = [
  [raise.includes(".from('service_enquiries')"), 'Raise Support Ticket must insert into service_enquiries'],
  [raise.includes("service_type: 'support_ticket'"), 'Support requests must use service_type=support_ticket'],
  [raise.includes(".from('service_enquiry_attachments')"), 'Support attachments must use service_enquiry_attachments'],
  [!raise.includes(".from('support_tickets').insert"), 'New support tickets must not insert into legacy support_tickets'],
  [detail.includes(".from('service_enquiries')"), 'Ticket detail must load from service_enquiries'],
  [detail.includes(".from('service_enquiry_messages')"), 'Ticket conversation must use service_enquiry_messages'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log('Customer support -> Service Enquiries regression passed.');
