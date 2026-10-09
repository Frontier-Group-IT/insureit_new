import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const kyc = read('app/customer/kyc/individual.tsx');
const helper = read('components/ui/customer-kyc-document-file.ts');
const pkg = JSON.parse(read('package.json'));

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

requireText(kyc, 'copyToCacheDirectory: true', 'Individual KYC must request a cache copy from DocumentPicker.');
requireText(kyc, 'prepareCustomerDocument(asset, maxFileSize)', 'Individual KYC must validate and stabilize selected documents before showing them as ready.');
requireText(kyc, 'readPreparedCustomerDocument(file.uri)', 'Individual KYC upload must read prepared documents through expo-file-system.');
requireText(kyc, 'removePreparedCustomerDocument(file.uri)', 'Individual KYC must clean uploaded cache files.');
if (kyc.includes('fetch(file.uri)')) throw new Error('Individual KYC must not use fetch(file:///content://) for local documents.');

requireText(helper, "import { Directory, File, Paths } from 'expo-file-system';", 'Customer KYC reader must use expo-file-system.');
requireText(helper, 'const source = new File(asset.uri);', 'Customer KYC reader must use the picker cache URI through expo-file-system.');
requireText(helper, 'source.copy(stable);', 'Customer KYC reader must copy selected documents into app-controlled cache.');
requireText(helper, 'const bytes = await stable.bytes();', 'Customer KYC reader must verify binary readability before marking a document ready.');
requireText(helper, 'const bytes = await file.bytes();', 'Customer KYC upload reader must obtain file bytes from expo-file-system.');
requireText(helper, "CACHE_DIRECTORY_NAME = 'customer-kyc-documents'", 'Customer KYC reader must isolate prepared documents in a dedicated cache directory.');

if (pkg.dependencies?.['expo-file-system'] !== '19.0.23') {
  throw new Error('Customer App must pin expo-file-system 19.0.23 to the installed 0.3.0 native baseline.');
}

console.log('Customer KYC filesystem document-reader regression passed.');
