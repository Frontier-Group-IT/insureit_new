import fs from 'node:fs';

const compact = fs.readFileSync(new URL('../components/customer-portal/customer-claim-compact-document.tsx', import.meta.url), 'utf8');
const voice = fs.readFileSync(new URL('../components/customer-portal/customer-claim-voice-recorder.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(compact.includes('aria-expanded={ordered.length>1?expanded:undefined}'), 'Uploaded count badge must control document expansion.');
assert(compact.includes('{ordered.length} Uploaded'), 'Uploaded count must remain visible in the badge.');
assert(!compact.includes('more documents'), 'Separate more-documents row must be removed.');
assert(compact.includes('ordered.length>1&&expanded?ordered.slice(1).map(openFile):null'), 'Extra documents must render when uploaded badge is expanded.');

assert(!voice.includes('Record what happened, listen before uploading, or attach an existing audio file.'), 'Voice helper line must be removed.');
assert(voice.includes('Microphone permission is blocked for this site.'), 'Blocked microphone permission must have actionable guidance.');
assert(voice.includes('Allow microphone access in your browser site settings'), 'Microphone guidance must explain how to recover.');
assert(voice.includes('navigator.mediaDevices.getUserMedia({ audio: true })'), 'Voice recorder must still request browser microphone access.');

console.log('Customer claim uploaded badge and microphone regression checks passed.');
