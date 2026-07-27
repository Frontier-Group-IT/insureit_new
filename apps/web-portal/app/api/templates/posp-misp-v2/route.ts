import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic="force-dynamic";

const POSP_HEADERS=["Associate Employee Code","Associate Name","POSP ID","Document Received Date","POS First Name","POS Middle Name","POS Last Name","PAN Number","Mobile Number","Email","Date of Birth","Aadhaar Number","Address","City","State","PIN Code","Bank Name","Account Number","IFSC Code","GST Number"];
const MISP_HEADERS=["Associate Employee Code","Associate Name","MISP ID","Document Received Date","MISP Name","MISP PAN","OEM Name","GST Number","Company Address","City","State","PIN Code","DP First Name","DP Middle Name","DP Last Name","DP PAN","DP Mobile","DP Email","DP Date of Birth","DP Aadhaar Number","Bank Name","Account Number","IFSC Code"];

export async function GET(){
  const workbook=XLSX.utils.book_new();
  const instructions=XLSX.utils.aoa_to_sheet([
    ["POSP / MISP Bulk Onboarding Template v2"],
    ["Template Version","2"],
    [],
    ["Rule","Details"],
    ["Sheets","Do not rename the POSP or MISP sheets."],
    ["Middle name","POS Middle Name and DP Middle Name may be blank."],
    ["Names","Use letters and spaces only."],
    ["Dates","Enter all dates in DD/MM/YYYY format."],
    ["PAN","Use uppercase PAN without spaces."],
    ["Mobile","Enter 10 digits only. Do not include +91."],
    ["PIN","Enter exactly 6 digits."],
    ["Aadhaar","Enter exactly 12 digits."],
    ["IIB workflow","Do not include IIB, training, exam, agreement or activation fields. InsureIt manages those stages after import."],
    ["Extension","Each submitted row creates one independent PAN job for the N.M. PAN Checker extension."],
    ["Formulas","Paste values only. Formulas are not accepted."]
  ]);
  instructions["!cols"]=[{wch:24},{wch:92}];
  const posp=XLSX.utils.aoa_to_sheet([POSP_HEADERS,["EMP001","Example Associate","SIB/2026/0001","27/07/2026","Amit","","Sharma","ABCDE1234F","9876543210","amit@example.com","15/08/1994","123412341234","12 Main Road","Jabalpur","Madhya Pradesh","482001","State Bank of India","123456789012","SBIN0001234",""]]);
  const misp=XLSX.utils.aoa_to_sheet([MISP_HEADERS,["EMP001","Example Associate","SIB/2026/1001","27/07/2026","Example Motors Pvt Ltd","ABCDE1234F","Example OEM","23ABCDE1234F1Z5","45 Industrial Area","Jabalpur","Madhya Pradesh","482002","Rohit","","Verma","PQRSX5678L","9876543210","rohit@example.com","21/04/1991","432143214321","State Bank of India","987654321012","SBIN0005678"]]);
  posp["!cols"]=POSP_HEADERS.map(header=>({wch:Math.max(16,Math.min(34,header.length+4))}));
  misp["!cols"]=MISP_HEADERS.map(header=>({wch:Math.max(16,Math.min(34,header.length+4))}));
  const master=XLSX.utils.aoa_to_sheet([["Category","Code / ID","Display Name","Notes"],["Associate","EMP001","Example Associate","Replace with an active InsureIt Associate."],["Bank","","State Bank of India","Use an exact active bank name."],["OEM","","Example OEM","MISP only. Use an exact active OEM name."]]);
  master["!cols"]=[{wch:18},{wch:18},{wch:30},{wch:60}];
  XLSX.utils.book_append_sheet(workbook,instructions,"Instructions");
  XLSX.utils.book_append_sheet(workbook,posp,"POSP");
  XLSX.utils.book_append_sheet(workbook,misp,"MISP");
  XLSX.utils.book_append_sheet(workbook,master,"Master Data Reference");
  const buffer=XLSX.write(workbook,{type:"buffer",bookType:"xlsx",compression:true});
  return new NextResponse(buffer,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":"attachment; filename=POSP_MISP_Bulk_Onboarding_Template_v2.xlsx","cache-control":"no-store"}});
}
