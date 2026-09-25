import type { ImageSourcePropType } from 'react-native';

const insurerLogos: Record<string, ImageSourcePropType> = {
  adityabirlasunlife: require('../assets/catalog/insurers/aditya-birla-sun-life.png'),
  axismaxlife: require('../assets/catalog/insurers/axis-max-life.png'),
  bajajallianz: require('../assets/vehicles/bajaj-allianz.png'),
  bajajlife: require('../assets/catalog/insurers/bajaj-life.png'),
  bandhanlife: require('../assets/catalog/insurers/bandhan-life.png'),
  carehealth: require('../assets/catalog/insurers/care-health.png'),
  cholamandalamsgeneral: require('../assets/catalog/insurers/cholamandalam-ms-general.png'),
  generalicentral: require('../assets/catalog/insurers/generali-central.png'),
  hdfcergo: require('../assets/catalog/insurers/hdfc-ergo.png'),
  hdfclife: require('../assets/catalog/insurers/hdfc-life.png'),
  icicilombard: require('../assets/catalog/insurers/icici-lombard.png'),
  iffcotokio: require('../assets/catalog/insurers/iffco-tokio.png'),
  indusindgeneral: require('../assets/catalog/insurers/indusind-general.png'),
  kiwigeneral: require('../assets/catalog/insurers/kiwi-general.png'),
  kotakgeneral: require('../assets/catalog/insurers/kotak-general.png'),
  libertygeneral: require('../assets/catalog/insurers/liberty-general.png'),
  lic: require('../assets/catalog/insurers/lic.png'),
  magmageneral: require('../assets/catalog/insurers/magma-general.png'),
  nationalinsurance: require('../assets/catalog/insurers/national-insurance.png'),
  newindiaassurance: require('../assets/catalog/insurers/new-india-assurance.png'),
  nivabupa: require('../assets/catalog/insurers/niva-bupa.png'),
  orientalinsurance: require('../assets/catalog/insurers/oriental-insurance.png'),
  pnbmetlife: require('../assets/catalog/insurers/pnb-metlife.png'),
  pramericalife: require('../assets/catalog/insurers/pramerica-life.png'),
  royalsundaram: require('../assets/catalog/insurers/royal-sundaram.png'),
  sbigeneral: require('../assets/catalog/insurers/sbi-general.png'),
  shriramgeneral: require('../assets/catalog/insurers/shriram-general.png'),
  starhealth: require('../assets/catalog/insurers/star-health.png'),
  tataaialife: require('../assets/catalog/insurers/tata-aia-life.png'),
  tataaig: require('../assets/catalog/insurers/tata-aig.png'),
  unitedindiainsurance: require('../assets/catalog/insurers/united-india-insurance.png'),
  universalsompo: require('../assets/catalog/insurers/universal-sompo.png'),
  zunogeneral: require('../assets/catalog/insurers/zuno-general.png'),
};

const insurerAliases: Record<string, keyof typeof insurerLogos> = {
  bajajgeneralinsurance: 'bajajallianz',
  bajajgeneralinsurancelimited: 'bajajallianz',
  bajajgeneralinsurancecompany: 'bajajallianz',
  bajajgeneralinsurancecompanylimited: 'bajajallianz',
  bajajallianzgeneralinsurance: 'bajajallianz',
  bajajallianzgeneralinsurancelimited: 'bajajallianz',
  bajajallianzgeneralinsurancecompanylimited: 'bajajallianz',
  cholamandalammsgeneralinsurancecompanylimited: 'cholamandalamsgeneral',
  cholamandalamsgeneralinsurancecompanylimited: 'cholamandalamsgeneral',
  generalicentralinsurancecompany: 'generalicentral',
  generalicentralinsurancecompanylimited: 'generalicentral',
  hdfcergogeneralinsurance: 'hdfcergo',
  hdfcergogeneralinsuranceco: 'hdfcergo',
  hdfcergogeneralinsurancecoltd: 'hdfcergo',
  hdfcergogeneralinsurancecompany: 'hdfcergo',
  hdfcergogeneralinsurancecompanylimited: 'hdfcergo',
  icicilombardgeneralinsurancecompanylimited: 'icicilombard',
  iffcotokiogeneralinsurancecompanylimited: 'iffcotokio',
  lifeinsurancecorporationofindia: 'lic',
  lifeinsurancecorporationofindialimited: 'lic',
  nationalinsurancecompany: 'nationalinsurance',
  nationalinsurancecompanylimited: 'nationalinsurance',
  newindiaassurancecompanylimited: 'newindiaassurance',
  orientalinsurancecompanylimited: 'orientalinsurance',
  sbigeneralinsurancecompanylimited: 'sbigeneral',
  shriramgeneralinsurancecompanylimited: 'shriramgeneral',
  tataaiggeneralinsurancecompanylimited: 'tataaig',
  thenewindiaassurancecompanylimited: 'newindiaassurance',
  unitedindiainsurancecompany: 'unitedindiainsurance',
  unitedindiainsurancecompanylimited: 'unitedindiainsurance',
};

const vehicleBrandLogos: Record<string, ImageSourcePropType> = {
  ace: require('../assets/catalog/vehicle-brands/ace.png'),
  ammann: require('../assets/catalog/vehicle-brands/ammann.png'),
  ather: require('../assets/catalog/vehicle-brands/ather.png'),
  atulauto: require('../assets/catalog/vehicle-brands/atul-auto.png'),
  bajajauto: require('../assets/catalog/vehicle-brands/bajaj-auto.png'),
  bharatbenz: require('../assets/catalog/vehicle-brands/bharatbenz.png'),
  bmw: require('../assets/catalog/vehicle-brands/bmw.png'),
  case: require('../assets/catalog/vehicle-brands/case.png'),
  caterpillar: require('../assets/catalog/vehicle-brands/caterpillar.png'),
  cummins: require('../assets/catalog/vehicle-brands/cummins.png'),
  eicher: require('../assets/catalog/vehicle-brands/eicher.png'),
  escorts: require('../assets/catalog/vehicle-brands/escorts.png'),
  euler: require('../assets/catalog/vehicle-brands/euler.png'),
  fiat: require('../assets/catalog/vehicle-brands/fiat.png'),
  forcemotors: require('../assets/catalog/vehicle-brands/force-motors.png'),
  ford: require('../assets/catalog/vehicle-brands/ford.png'),
  foton: require('../assets/catalog/vehicle-brands/foton.png'),
  generalmotors: require('../assets/catalog/vehicle-brands/general-motors.png'),
  gromax: require('../assets/catalog/vehicle-brands/gromax.png'),
  harleydavidson: require('../assets/catalog/vehicle-brands/harley-davidson.png'),
  heromotocorp: require('../assets/catalog/vehicle-brands/hero-motocorp.png'),
  hindustanmotors: require('../assets/catalog/vehicle-brands/hindustan-motors.png'),
  honda: require('../assets/catalog/vehicle-brands/honda.png'),
  hyundai: require('../assets/catalog/vehicle-brands/hyundai.png'),
  hitachi: require('../assets/catalog/vehicle-brands/hitachi.png'),
  indofarm: require('../assets/catalog/vehicle-brands/indo-farm.png'),
  internationalharvester: require('../assets/catalog/vehicle-brands/international-harvester.png'),
  isuzu: require('../assets/catalog/vehicle-brands/isuzu.png'),
  jaguar: require('../assets/catalog/vehicle-brands/jaguar.png'),
  jcb: require('../assets/catalog/vehicle-brands/jcb.png'),
  johndeere: require('../assets/catalog/vehicle-brands/john-deere.png'),
  jsw: require('../assets/catalog/vehicle-brands/jsw.png'),
  kawasaki: require('../assets/catalog/vehicle-brands/kawasaki.png'),
  kobelco: require('../assets/catalog/vehicle-brands/kobelco.png'),
  kubota: require('../assets/catalog/vehicle-brands/kubota.png'),
  mercedesbenz: require('../assets/catalog/vehicle-brands/mercedes-benz.png'),
  nissan: require('../assets/catalog/vehicle-brands/nissan.png'),
  olectra: require('../assets/catalog/vehicle-brands/olectra.png'),
  piaggio: require('../assets/catalog/vehicle-brands/piaggio.png'),
  preet: require('../assets/catalog/vehicle-brands/preet.png'),
  renault: require('../assets/catalog/vehicle-brands/renault.png'),
  sany: require('../assets/catalog/vehicle-brands/sany.png'),
  scania: require('../assets/catalog/vehicle-brands/scania.png'),
  schwingstetter: require('../assets/catalog/vehicle-brands/schwing-stetter.png'),
  skoda: require('../assets/catalog/vehicle-brands/skoda.png'),
  sml: require('../assets/catalog/vehicle-brands/sml.png'),
  stellantis: require('../assets/catalog/vehicle-brands/stellantis.png'),
  suzuki: require('../assets/catalog/vehicle-brands/suzuki.png'),
  tafe: require('../assets/catalog/vehicle-brands/tafe.png'),
  terex: require('../assets/catalog/vehicle-brands/terex.png'),
  tata: require('../assets/catalog/vehicle-brands/tata.png'),
  tigroup: require('../assets/catalog/vehicle-brands/ti-group.png'),
  toyota: require('../assets/catalog/vehicle-brands/toyota.png'),
  triumph: require('../assets/catalog/vehicle-brands/triumph.png'),
  tvs: require('../assets/catalog/vehicle-brands/tvs.png'),
  vinfast: require('../assets/catalog/vehicle-brands/vinfast.png'),
  volvo: require('../assets/catalog/vehicle-brands/volvo.png'),
  vsttillers: require('../assets/catalog/vehicle-brands/vst-tillers.png'),
  wirtgen: require('../assets/catalog/vehicle-brands/wirtgen.png'),
  yamaha: require('../assets/catalog/vehicle-brands/yamaha.png'),
};

const vehicleBrandAliases: Record<string, keyof typeof vehicleBrandLogos> = {
  bajaj: 'bajajauto',
  bharatbenzindia: 'bharatbenz',
  bharatbenzdcm: 'bharatbenz',
  daimler: 'bharatbenz',
  daimlerindia: 'bharatbenz',
  daimlerindiacommercialvehicles: 'bharatbenz',
  dicv: 'bharatbenz',
  eichertrucksandbuses: 'eicher',
  vecommercialvehicles: 'eicher',
  vecv: 'eicher',
  force: 'forcemotors',
  gm: 'generalmotors',
  hero: 'heromotocorp',
  hindustan: 'hindustanmotors',
  hondacars: 'honda',
  hondacarsindia: 'honda',
  hyundaimotor: 'hyundai',
  hyundaimotorindia: 'hyundai',
  johndeereindia: 'johndeere',
  mercedes: 'mercedesbenz',
  mercedesbenzindia: 'mercedesbenz',
  schwing: 'schwingstetter',
  smlisuzu: 'sml',
  suzukimotorcycle: 'suzuki',
  tatamotors: 'tata',
  tatamotorslimited: 'tata',
  tafemotors: 'tafe',
  toyotakirloskar: 'toyota',
  toyotakirloskarmotor: 'toyota',
  toyotakirloskarmotorprivatelimited: 'toyota',
  tvsmotor: 'tvs',
  vst: 'vsttillers',
};

function normalizeLogoKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function resolveLogo(
  value: string | null | undefined,
  logos: Record<string, ImageSourcePropType>,
  aliases: Record<string, string>,
) {
  const key = normalizeLogoKey(value);
  if (!key) return null;
  if (logos[key]) return logos[key];

  const alias = aliases[key];
  if (alias && logos[alias]) return logos[alias];

  const contained = Object.keys(logos)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => key.includes(candidate));

  if (contained) return logos[contained];
  if (logos.bajajallianz && key.startsWith('bajajgeneralinsurance')) return logos.bajajallianz;
  return null;
}

export function getInsurerLogoSource(insurerName: string | null | undefined) {
  return resolveLogo(insurerName, insurerLogos, insurerAliases);
}

export function getVehicleBrandLogoSource(make: string | null | undefined) {
  return resolveLogo(make, vehicleBrandLogos, vehicleBrandAliases);
}
