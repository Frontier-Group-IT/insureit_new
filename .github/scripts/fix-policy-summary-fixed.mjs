import fs from "node:fs";

const path = "apps/web-portal/components/policy-form-authbridge.tsx";
let text = fs.readFileSync(path, "utf8");

const oldMarkup = '<aside className="xl:self-stretch"><div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm xl:sticky xl:top-4 xl:z-10">';
const newMarkup = '<aside className="xl:self-stretch"><div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm xl:fixed xl:right-4 xl:top-24 xl:z-30 xl:w-[300px] 2xl:right-[calc((100vw-1480px)/2)]">';

if (!text.includes(oldMarkup)) throw new Error("Policy summary sidebar anchor not found");
text = text.replace(oldMarkup, newMarkup);
fs.writeFileSync(path, text);
