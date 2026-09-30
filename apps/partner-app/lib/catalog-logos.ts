import type { ImageSourcePropType } from 'react-native';

function normalize(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const insurers: Array<[string[], ImageSourcePropType]> = [
  [['oriental insurance', 'the oriental insurance'], require('../assets/catalog/insurers/oriental-insurance.png')],
  [['new india assurance', 'the new india assurance'], require('../assets/catalog/insurers/new-india-assurance.png')],
  [['national insurance'], require('../assets/catalog/insurers/national-insurance.png')],
  [['united india insurance'], require('../assets/catalog/insurers/united-india-insurance.png')],
  [['icici lombard'], require('../assets/catalog/insurers/icici-lombard.png')],
  [['hdfc ergo'], require('../assets/catalog/insurers/hdfc-ergo.png')],
  [['tata aig'], require('../assets/catalog/insurers/tata-aig.png')],
  [['iffco tokio'], require('../assets/catalog/insurers/iffco-tokio.png')],
  [['sbi general'], require('../assets/catalog/insurers/sbi-general.png')],
  [['shriram general'], require('../assets/catalog/insurers/shriram-general.png')],
  [['royal sundaram'], require('../assets/catalog/insurers/royal-sundaram.png')],
  [['liberty general'], require('../assets/catalog/insurers/liberty-general.png')],
  [['cholamandalam', 'chola ms'], require('../assets/catalog/insurers/cholamandalam-ms-general.png')],
  [['zuno'], require('../assets/catalog/insurers/zuno-general.png')],
  [['generali central', 'future generali'], require('../assets/catalog/insurers/generali-central.png')],
  [['kotak general'], require('../assets/catalog/insurers/kotak-general.png')],
  [['magma'], require('../assets/catalog/insurers/magma-general.png')],
  [['universal sompo'], require('../assets/catalog/insurers/universal-sompo.png')],
  [['care health'], require('../assets/catalog/insurers/care-health.png')],
  [['star health'], require('../assets/catalog/insurers/star-health.png')],
  [['niva bupa'], require('../assets/catalog/insurers/niva-bupa.png')],
  [['lic', 'life insurance corporation'], require('../assets/catalog/insurers/lic.png')],
  [['hdfc life'], require('../assets/catalog/insurers/hdfc-life.png')],
  [['tata aia'], require('../assets/catalog/insurers/tata-aia-life.png')],
  [['axis max life', 'max life'], require('../assets/catalog/insurers/axis-max-life.png')],
  [['pnb metlife'], require('../assets/catalog/insurers/pnb-metlife.png')],
  [['aditya birla sun life'], require('../assets/catalog/insurers/aditya-birla-sun-life.png')],
  [['bajaj life'], require('../assets/catalog/insurers/bajaj-life.png')],
];

// Keep only catalog files that are actually bundled. Unknown/unavailable brands resolve to
// null so the Customer Detail screen can render its existing default fallback artwork/icon.
const manufacturers: Array<[string[], ImageSourcePropType]> = [
  [['bharatbenz', 'bharat benz', 'daimler'], require('../assets/catalog/vehicle-brands/bharatbenz.png')],
  [['eicher', 've commercial'], require('../assets/catalog/vehicle-brands/eicher.png')],
  [['jcb'], require('../assets/catalog/vehicle-brands/jcb.png')],
  [['volvo'], require('../assets/catalog/vehicle-brands/volvo.png')],
  [['sany'], require('../assets/catalog/vehicle-brands/sany.png')],
  [['caterpillar', 'cat'], require('../assets/catalog/vehicle-brands/caterpillar.png')],
  [['john deere'], require('../assets/catalog/vehicle-brands/john-deere.png')],
  [['case'], require('../assets/catalog/vehicle-brands/case.png')],
  [['kobelco'], require('../assets/catalog/vehicle-brands/kobelco.png')],
  [['hitachi'], require('../assets/catalog/vehicle-brands/hitachi.png')],
  [['suzuki', 'maruti'], require('../assets/catalog/vehicle-brands/suzuki.png')],
  [['isuzu'], require('../assets/catalog/vehicle-brands/isuzu.png')],
  [['force motors', 'force'], require('../assets/catalog/vehicle-brands/force-motors.png')],
  [['piaggio'], require('../assets/catalog/vehicle-brands/piaggio.png')],
  [['bajaj auto', 'bajaj'], require('../assets/catalog/vehicle-brands/bajaj-auto.png')],
  [['tvs'], require('../assets/catalog/vehicle-brands/tvs.png')],
  [['hero motocorp', 'hero'], require('../assets/catalog/vehicle-brands/hero-motocorp.png')],
  [['kubota'], require('../assets/catalog/vehicle-brands/kubota.png')],
  [['scania'], require('../assets/catalog/vehicle-brands/scania.png')],
  [['mercedes benz'], require('../assets/catalog/vehicle-brands/mercedes-benz.png')],
];

function resolve(value: string | null | undefined, entries: Array<[string[], ImageSourcePropType]>) {
  const key = normalize(value);
  if (!key) return null;
  for (const [aliases, source] of entries) {
    if (aliases.some((alias) => key.includes(alias))) return source;
  }
  return null;
}

export function getPartnerInsurerLogoSource(value?: string | null) {
  return resolve(value, insurers);
}

export function getPartnerManufacturerLogoSource(value?: string | null) {
  return resolve(value, manufacturers);
}
