// Explicit family aliases only. Unknown descriptions remain exact, never fuzzy matched for artwork.
export const families = [
 {make:"Maruti Suzuki",model:"ertiga",aliases:["ertiga","ertica"]},
 {make:"Mahindra",model:"bolero pickup",aliases:["bolero pickup","bolero pick up","bolero pik up","bolero pikup","bolero camper","bolero maxi truck","bolero maxitruck"]},
 {make:"Mahindra",model:"bolero neo",aliases:["bolero neo"]},
 {make:"Mahindra",model:"bolero",aliases:["bolero"]},
 {make:"Suzuki Motorcycle India",model:"access 125",aliases:["access 125","access125"]},
 {make:"Maruti Suzuki",model:"swift dzire",aliases:["swift dzire","dzire"]},
 {make:"Maruti Suzuki",model:"swift",aliases:["swift"]},
 {make:"Maruti Suzuki",model:"baleno",aliases:["baleno"]},
 {make:"Hyundai",model:"creta",aliases:["creta"]},
 {make:"Hyundai",model:"i20",aliases:["i20"]},
 {make:"Honda",model:"activa 125",aliases:["activa 125"]},
 {make:"Honda",model:"activa",aliases:["activa"]},
] as const;
export function familyKey(value:string|null|undefined){return (value??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
export function vehicleFamily(model:string|null|undefined){
 const key=familyKey(model);
 const matches=families.flatMap(f=>f.aliases.filter(a=>key===a||key.startsWith(a+" ")).map(a=>({family:f,length:a.length}))).sort((a,b)=>b.length-a.length);
 return matches[0]?.family??null;
}
export function modelSearch(label:string,query:string){
 const q=familyKey(query).replace(/\bmahendra\b/g,"mahindra").replace(/\bertica\b/g,"ertiga");
 return q.split(" ").every(token=>familyKey(label).includes(token));
}
export function resolveFamilyArtwork(model:string, rows:readonly {model:string;active:boolean;path:string;variant?:string|null;year?:number|null}[]){
 const f=vehicleFamily(model);if(!f)return null;
 const eligible=rows.filter(r=>r.active&&!r.variant&&r.year==null&&vehicleFamily(r.model)?.model===f.model);
 const canonical=eligible.filter(r=>familyKey(r.model)===f.model);
 const choices=canonical.length?canonical:eligible;
 return choices.length===1?choices[0].path:null;
}
