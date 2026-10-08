const vehicles: Record<string,string> = {
  honda:"honda.svg", tata:"tata.svg", maruti:"maruti-suzuki.svg", suzuki:"suzuki.png",
  mahindra:"mahindra.svg", hyundai:"hyundai.svg", toyota:"toyota.svg", jcb:"jcb.png",
  bharatbenz:"bharatbenz.png", eicher:"eicher.png", ashokeleyland:"ashok-leyland.svg",
  "ashok leyland":"ashok-leyland.svg", hero:"hero-motocorp.png", ammann:"ammann.png",
  volvo:"volvo.png", force:"force-motors.png", bmw:"bmw.png", ford:"ford.png",
  isuzu:"isuzu.png", bajaj:"bajaj-auto.png",
};
const insurers: [RegExp,string][] = [
  [/united india/i,"united-india-insurance.png"], [/new india/i,"new-india-assurance.png"],
  [/icici lombard/i,"icici-lombard.png"], [/hdfc ergo/i,"hdfc-ergo.png"],
  [/tata aig/i,"tata-aig.png"], [/bajaj/i,"bajaj-allianz.png"],
  [/chola/i,"cholamandalam-ms-general.png"], [/iffco/i,"iffco-tokio.png"],
  [/magma/i,"magma-general.png"], [/oriental/i,"oriental-insurance.png"],
  [/national insurance/i,"national-insurance.png"], [/royal sundaram/i,"royal-sundaram.png"],
  [/sbi general/i,"sbi-general.png"], [/shriram/i,"shriram-general.png"],
  [/aditya birla sun life/i,"aditya-birla-sun-life.png"],
];
export function CustomerClaimLogo({value,kind="vehicle",size=48}:{value:string|null|undefined;kind?:"vehicle"|"insurer";size?:number}) {
  const raw=(value||"").trim().toLowerCase();
  const slug=raw.replace(/[^a-z0-9]/g,"");
  const file=kind==="vehicle"?(vehicles[raw]||vehicles[slug]||null):insurers.find(([rx])=>rx.test(raw))?.[1];
  const src=file?(kind==="vehicle"?"/assets/vehicle-brands/":"/assets/insurers/")+file:null;
  return <span className="inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white" style={{width:size,height:size}}>
    {src?<img src={src} alt={value||kind} loading="lazy" className="max-h-[85%] max-w-[85%] object-contain"/>:<span className="text-lg font-black text-[#174EA6]">{(value||"I").slice(0,1).toUpperCase()}</span>}
  </span>;
}
