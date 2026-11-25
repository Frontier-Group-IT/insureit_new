import assert from "node:assert/strict";
import {tmpdir} from "node:os";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {verifyOrientalCmsSigningDate,cmsSigningTimeIndiaDay} from "../lib/policy-oriental-cms-issuance.ts";
const scratch=fs.mkdtempSync(path.join(tmpdir(),"insureit-oriental-cms-"));
function signedPdf(withM=false,trailingDictionary=false){
 const openssl=(args)=>execFileSync("openssl",args,{cwd:scratch,stdio:"pipe"});
 const key=path.join(scratch,"key.pem"),cert=path.join(scratch,"cert.pem"),
   signedBytes=path.join(scratch,"signed.bin"),cms=path.join(scratch,"signed.der");
 openssl(["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,
   "-out",cert,"-subj","/CN=Insurer Signing Test","-days","1"]);
 const gapBytes="0".repeat(16000);
 const m=withM?" /M (D:20000101000000+05'30')":"";
 const signatureHead="%PDF-1.7\n1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite";
 const byteRange="/ByteRange [0000000000 0000000000 0000000000 0000000000]";
 // Real Oriental PDFs put the CMS /Contents first and /ByteRange,
 // /SubFilter and /M later in the SAME signature dictionary.
 const original=trailingDictionary
   ? signatureHead+" /Contents <"+gapBytes+"> "+byteRange+
     " /SubFilter /adbe.pkcs7.detached"+m+" >>\nendobj\n%%EOF\n"
   : signatureHead+" /SubFilter /adbe.pkcs7.detached"+m+
     " "+byteRange+" /Contents <"+gapBytes+"> >>\nendobj\n%%EOF\n";
 const beforeContents=original.indexOf("/Contents <");
 const a=original.indexOf("<",beforeContents),b=a+gapBytes.length+2;
 const first=a,second=b,third=original.length-b;
 const range="/ByteRange [0000000000 0000000000 0000000000 0000000000]";
 const updated=original.replace(range,
   "/ByteRange ["+[0,first,second,third].map(n=>String(n).padStart(10,"0")).join(" ")+"]");
 assert.equal(updated.length,original.length);
 const input=Buffer.from(updated,"latin1");
 fs.writeFileSync(signedBytes,Buffer.concat([input.subarray(0,first),input.subarray(second)]));
 openssl(["cms","-sign","-binary","-in",signedBytes,"-signer",cert,
   "-inkey",key,"-outform","DER","-out",cms,"-nosmimecap","-md","sha256"]);
 const der=fs.readFileSync(cms).toString("hex");
 assert(der.length<gapBytes.length);
 return Buffer.from(updated.slice(0,a+1)+der+"0".repeat(gapBytes.length-der.length)
   +updated.slice(b-1),"latin1");
}
try{
 // The original two Oriental PDFs encode authenticated GeneralizedTime as
 // YYYYMMDDHHMMSS+0530, not a Zulu-formatted UTCTime.
 assert.equal(cmsSigningTimeIndiaDay("20261114094729+0530"),"2026-11-14");
 assert.equal(cmsSigningTimeIndiaDay("20261119144515+0530"),"2026-11-19");
 assert.equal(cmsSigningTimeIndiaDay("20261114094729-0530"),"2026-11-14");
 assert.equal(cmsSigningTimeIndiaDay("20261131234500+0530"),null);
 assert.equal(cmsSigningTimeIndiaDay("20261114094729+1460"),null);
 const good=signedPdf();
 const a=await verifyOrientalCmsSigningDate(Uint8Array.from(good));
 assert(a,"Valid full-cover detached CMS signingTime should be accepted");
 assert.equal(a.verification,"detached_signature_integrity_verified");
 assert.match(a.date,/^20\d{2}-\d{2}-\d{2}$/);
 assert.match(a.documentSha256,/^[a-f0-9]{64}$/);
 const trailing=signedPdf(false,true);
 const trailingEvidence=await verifyOrientalCmsSigningDate(Uint8Array.from(trailing));
 assert(trailingEvidence,"CMS with post-Contents ByteRange/SubFilter must be recognized");
 assert.equal(trailingEvidence.verification,"detached_signature_integrity_verified");
 assert.equal(await verifyOrientalCmsSigningDate(Uint8Array.from(signedPdf(true,true))),null,
  "A post-Contents /M that disagrees with CMS signingTime must be rejected");
 const altered=Uint8Array.from(good);
 altered[12]^=1; // Signed /Type or header data, not excluded /Contents
 assert.equal(await verifyOrientalCmsSigningDate(altered),null,
   "Mutating signed PDF bytes must invalidate CMS");
 assert.equal(await verifyOrientalCmsSigningDate(Uint8Array.from(signedPdf(true))),null,
   "PDF /M metadata disagreeing with verified CMS signingTime must be refused");
 const unprotected=Buffer.from("%PDF-1.7\nPolicy Printed On: 19-NOV-26 14:45:13\n"+
  "This is an electronically generated digitally signed document"+
  "\n".repeat(1024));
 assert.equal(await verifyOrientalCmsSigningDate(Uint8Array.from(unprotected)),null,
   "Printing date and signature disclaimer are NOT cryptographic proof");
 const short=Uint8Array.from(Buffer.from("%PDF-1.7\n"));
 assert.equal(await verifyOrientalCmsSigningDate(short),null);
 console.log("Oriental issuance: full-byte CMS signingTime positive + tamper /M/print-only negatives passed");
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
