const VEHICLE_BRAND_LOGOS: Record<string, string> = {
  ace: "/assets/vehicle-brands/ace.png",
  ammann: "/assets/vehicle-brands/ammann.png",
  ashokleyland: "/assets/vehicle-brands/ashok-leyland.svg",
  ather: "/assets/vehicle-brands/ather.png",
  atulauto: "/assets/vehicle-brands/atul-auto.png",
  bajajauto: "/assets/vehicle-brands/bajaj-auto.png",
  bharatbenz: "/assets/vehicle-brands/bharatbenz.png",
  bmw: "/assets/vehicle-brands/bmw.png",
  case: "/assets/vehicle-brands/case.png",
  caterpillar: "/assets/vehicle-brands/caterpillar.png",
  cummins: "/assets/vehicle-brands/cummins.png",
  eicher: "/assets/vehicle-brands/eicher.png",
  escorts: "/assets/vehicle-brands/escorts.png",
  euler: "/assets/vehicle-brands/euler.png",
  fiat: "/assets/vehicle-brands/fiat.png",
  forcemotors: "/assets/vehicle-brands/force-motors.png",
  ford: "/assets/vehicle-brands/ford.png",
  foton: "/assets/vehicle-brands/foton.png",
  generalmotors: "/assets/vehicle-brands/general-motors.png",
  gromax: "/assets/vehicle-brands/gromax.png",
  harleydavidson: "/assets/vehicle-brands/harley-davidson.png",
  heromotocorp: "/assets/vehicle-brands/hero-motocorp.png",
  hindustanmotors: "/assets/vehicle-brands/hindustan-motors.png",
  hitachi: "/assets/vehicle-brands/hitachi.png",
  honda: "/assets/vehicle-brands/honda.svg",
  hyundai: "/assets/vehicle-brands/hyundai.svg",
  indofarm: "/assets/vehicle-brands/indo-farm.png",
  internationalharvester: "/assets/vehicle-brands/international-harvester.png",
  isuzu: "/assets/vehicle-brands/isuzu.png",
  jaguar: "/assets/vehicle-brands/jaguar.png",
  jcb: "/assets/vehicle-brands/jcb.png",
  johndeere: "/assets/vehicle-brands/john-deere.png",
  jsw: "/assets/vehicle-brands/jsw.png",
  kawasaki: "/assets/vehicle-brands/kawasaki.png",
  kia: "/assets/vehicle-brands/kia.svg",
  kobelco: "/assets/vehicle-brands/kobelco.png",
  kubota: "/assets/vehicle-brands/kubota.png",
  mahindra: "/assets/vehicle-brands/mahindra.svg",
  marutisuzuki: "/assets/vehicle-brands/maruti-suzuki.svg",
  mercedesbenz: "/assets/vehicle-brands/mercedes-benz.png",
  nissan: "/assets/vehicle-brands/nissan.png",
  olectra: "/assets/vehicle-brands/olectra.png",
  piaggio: "/assets/vehicle-brands/piaggio.png",
  preet: "/assets/vehicle-brands/preet.png",
  renault: "/assets/vehicle-brands/renault.png",
  sany: "/assets/vehicle-brands/sany.png",
  scania: "/assets/vehicle-brands/scania.png",
  schwingstetter: "/assets/vehicle-brands/schwing-stetter.png",
  skoda: "/assets/vehicle-brands/skoda.png",
  sml: "/assets/vehicle-brands/sml.png",
  stellantis: "/assets/vehicle-brands/stellantis.png",
  suzuki: "/assets/vehicle-brands/suzuki.png",
  tafe: "/assets/vehicle-brands/tafe.png",
  tata: "/assets/vehicle-brands/tata.svg",
  terex: "/assets/vehicle-brands/terex.png",
  tigroup: "/assets/vehicle-brands/ti-group.png",
  toyota: "/assets/vehicle-brands/toyota.svg",
  triumph: "/assets/vehicle-brands/triumph.png",
  tvs: "/assets/vehicle-brands/tvs.png",
  vinfast: "/assets/vehicle-brands/vinfast.png",
  volvo: "/assets/vehicle-brands/volvo.png",
  vsttillers: "/assets/vehicle-brands/vst-tillers.png",
  wirtgen: "/assets/vehicle-brands/wirtgen.png",
  yamaha: "/assets/vehicle-brands/yamaha.png",
};

const VEHICLE_BRAND_ALIASES: Record<string, keyof typeof VEHICLE_BRAND_LOGOS> = {
  ashokleylandlimited: "ashokleyland",
  bajaj: "bajajauto",
  bharatbenzindia: "bharatbenz",
  bharatbenzdcm: "bharatbenz",
  daimler: "bharatbenz",
  daimlerindia: "bharatbenz",
  daimlerindiacommercialvehicles: "bharatbenz",
  dicv: "bharatbenz",
  eichertrucksandbuses: "eicher",
  vecommercialvehicles: "eicher",
  vecv: "eicher",
  force: "forcemotors",
  gm: "generalmotors",
  hero: "heromotocorp",
  hindustan: "hindustanmotors",
  johndeereindia: "johndeere",
  mahindraandmahindra: "mahindra",
  mandm: "mahindra",
  maruti: "marutisuzuki",
  mercedes: "mercedesbenz",
  mercedesbenzindia: "mercedesbenz",
  schwing: "schwingstetter",
  smlisuzu: "sml",
  suzukimotorcycle: "suzuki",
  tafemotors: "tafe",
  tatamotors: "tata",
  tvsmotor: "tvs",
  vst: "vsttillers",
};

export function normalizeVehicleBrandKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function getVehicleBrandLogo(make: string | null | undefined) {
  const key = normalizeVehicleBrandKey(make);
  if (!key) return null;

  const direct = VEHICLE_BRAND_LOGOS[key];
  if (direct) return direct;

  const alias = VEHICLE_BRAND_ALIASES[key];
  if (alias) return VEHICLE_BRAND_LOGOS[alias];

  const orderedKeys = Object.keys(VEHICLE_BRAND_LOGOS).sort((a, b) => b.length - a.length);
  const contained = orderedKeys.find((brandKey) => key.includes(brandKey));
  return contained ? VEHICLE_BRAND_LOGOS[contained] : null;
}
