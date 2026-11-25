import assert from "node:assert/strict";
import {tmpdir} from "node:os";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {verifyOrientalCmsSigningDate} from "../lib/policy-oriental-cms-issuance.ts";
const scratch=fs.mkdtempSync(path.join(tmpdir(),"insureit-oriental-cms-"));
function signedPdf(withM=false){
 const openssl=(args)=>execFileSync("openssl",args,{cwd:scratch,stdio:"pipe"});
 const key=path.join(scratch,"key.pem"),cert=path.join(scratch,"cert.pem"),
   signedBytes=path.join(scratch,"signed.bin"),cms=path.join(scratch,"signed.der");
 openssl(["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,
   "-out",cert,"-subj","/CN=Insurer Signing Test","-days","1"]);
 const gapBytes="0".repeat(16000);
 const m=withM?" /M (D:20000101000000+05'30')":"";
 const original="%PDF-1.7\n1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached"+
   m+" /ByteRange [0000000000 0000000000 0000000000 0000000000] /Contents <"+
   gapBytes+"> >>\nendobj\n%%EOF\n";
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
 const good=signedPdf();
 const a=await verifyOrientalCmsSigningDate(Uint8Array.from(good));
 assert(a,"Valid full-cover detached CMS signingTime should be accepted");
 assert.equal(a.verification,"detached_signature_integrity_verified");
 assert.match(a.date,/^20\d{2}-\d{2}-\d{2}$/);
 assert.match(a.documentSha256,/^[a-f0-9]{64}$/);
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
