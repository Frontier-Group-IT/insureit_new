const INSURER_LOGOS: Record<string, string> = {
  adityabirlasunlife: "/assets/insurers/aditya-birla-sun-life.png",
  axismaxlife: "/assets/insurers/axis-max-life.png",
  bajajlife: "/assets/insurers/bajaj-life.png",
  bandhanlife: "/assets/insurers/bandhan-life.png",
  carehealth: "/assets/insurers/care-health.png",
  cholamandalamsgeneral: "/assets/insurers/cholamandalam-ms-general.png",
  generalicentral: "/assets/insurers/generali-central.png",
  hdfcergo: "/assets/insurers/hdfc-ergo.png",
  hdfclife: "/assets/insurers/hdfc-life.png",
  icicilombard: "/assets/insurers/icici-lombard.png",
  iffcotokio: "/assets/insurers/iffco-tokio.png",
  indusindgeneral: "/assets/insurers/indusind-general.png",
  kiwigeneral: "/assets/insurers/kiwi-general.png",
  kotakgeneral: "/assets/insurers/kotak-general.png",
  libertygeneral: "/assets/insurers/liberty-general.png",
  lic: "/assets/insurers/lic.png",
  magmageneral: "/assets/insurers/magma-general.png",
  nationalinsurance: "/assets/insurers/national-insurance.png",
  newindiaassurance: "/assets/insurers/new-india-assurance.png",
  nivabupa: "/assets/insurers/niva-bupa.png",
  orientalinsurance: "/assets/insurers/oriental-insurance.png",
  pnbmetlife: "/assets/insurers/pnb-metlife.png",
  pramericalife: "/assets/insurers/pramerica-life.png",
  royalsundaram: "/assets/insurers/royal-sundaram.png",
  sbigeneral: "/assets/insurers/sbi-general.png",
  shriramgeneral: "/assets/insurers/shriram-general.png",
  starhealth: "/assets/insurers/star-health.png",
  tataaialife: "/assets/insurers/tata-aia-life.png",
  tataaig: "/assets/insurers/tata-aig.png",
  unitedindiainsurance: "/assets/insurers/united-india-insurance.png",
  universalsompo: "/assets/insurers/universal-sompo.png",
  zunogeneral: "/assets/insurers/zuno-general.png",
};

const INSURER_ALIASES: Record<string, keyof typeof INSURER_LOGOS> = {
  nationalinsurancecompanylimited: "nationalinsurance",
  nationalinsurancecompany: "nationalinsurance",
  unitedindiainsurancecompanylimited: "unitedindiainsurance",
  unitedindiainsurancecompany: "unitedindiainsurance",
  thenewindiaassurancecompanylimited: "newindiaassurance",
  newindiaassurancecompanylimited: "newindiaassurance",
  orientalinsurancecompanylimited: "orientalinsurance",
  hdfcergogeneralinsurancecompanylimited: "hdfcergo",
  icicilombardgeneralinsurancecompanylimited: "icicilombard",
  iffcotokiogeneralinsurancecompanylimited: "iffcotokio",
  sbigeneralinsurancecompanylimited: "sbigeneral",
  shriramgeneralinsurancecompanylimited: "shriramgeneral",
  tataaiggeneralinsurancecompanylimited: "tataaig",
};

export function normalizeInsurerLogoKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function getInsurerLogo(insurerName: string | null | undefined) {
  const key = normalizeInsurerLogoKey(insurerName);
  if (!key) return null;
  if (INSURER_LOGOS[key]) return INSURER_LOGOS[key];
  const alias = INSURER_ALIASES[key];
  if (alias) return INSURER_LOGOS[alias];
  const ordered = Object.keys(INSURER_LOGOS).sort((a,b)=>b.length-a.length);
  const contained = ordered.find((candidate)=>key.includes(candidate));
  return contained ? INSURER_LOGOS[contained] : null;
}
