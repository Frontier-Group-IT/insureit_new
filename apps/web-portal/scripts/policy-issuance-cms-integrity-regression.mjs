import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyTataAigSigningDateEvidence } from "../lib/policy-issuance-signature-evidence.ts";

const directory=mkdtempSync(join(tmpdir(),"insureit-pdf-signature-"));
try {
  const cert=join(directory,"cert.pem"),key=join(directory,"key.pem");
  execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1",
    "-subj","/CN=TATA AIG test signer","-keyout",key,"-out",cert],{stdio:"ignore"});
  const placeholder="<"+"0".repeat(32768)+">";
  const prefix="%PDF-1.7\n/Type /Sig\n/SubFilter /adbe.pkcs7.detached\n/Name (TATA AIG)\n/M (D:20261119111104+00'00')\n/Contents ";
  const first=Buffer.byteLength(prefix),second=first+placeholder.length;
  // The length of the last number must stay fixed while constructing the PDF.
  const paddedSuffix=`\n/ByteRange [0 ${String(first).padStart(10,"0")} ${String(second).padStart(10,"0")} ${String(0).padStart(10,"0")}]\n%%EOF`;
  const tailLength=Buffer.byteLength(paddedSuffix);
  const tail=`\n/ByteRange [0 ${String(first).padStart(10,"0")} ${String(second).padStart(10,"0")} ${String(tailLength).padStart(10,"0")}]\n%%EOF`;
  assert.equal(tail.length,tailLength);
  const content=Buffer.from(prefix+tail);
  const input=join(directory,"content.bin"),signature=join(directory,"signature.der");
  writeFileSync(input,content);
  execFileSync("openssl",["cms","-sign","-binary","-in",input,"-signer",cert,"-inkey",key,
    "-outform","DER","-out",signature,"-md","sha256","-nosmimecap"],{stdio:"ignore"});
  const hex=readFileSync(signature).toString("hex");
  assert(hex.length<=32768);
  const pdf=Buffer.from(prefix+"<"+hex.padEnd(32768,"0")+">"+tail);
  const valid=await verifyTataAigSigningDateEvidence(pdf,"2026-11-19");
  assert.equal(valid?.proposedDate,"2026-11-19");
  assert.equal(valid?.verification,"detached_signature_integrity_verified");
  assert.equal(valid?.requiresReviewerConfirmation,false);
  assert.equal(await verifyTataAigSigningDateEvidence(pdf,"2026-11-17"),null);
  const tampered=Buffer.from(pdf);tampered[10]^=1;
  assert.equal(await verifyTataAigSigningDateEvidence(tampered,"2026-11-19"),null);
  const corruptedSignature=Buffer.from(pdf);corruptedSignature[first+50]^=1;
  assert.equal(await verifyTataAigSigningDateEvidence(corruptedSignature,"2026-11-19"),null);
  assert.equal(await verifyTataAigSigningDateEvidence(Buffer.from("%PDF-1.7"),"2026-11-19"),null);
  console.log("PDF detached CMS integrity: valid self-signed signer, tampered content/signature and receipt mismatch passed");
} finally {rmSync(directory,{recursive:true,force:true});}
