import {vehicleAssetMaster, type VehicleAsset, type VehicleBody} from "./customer-exchange-vehicle-master";
export type VehicleArtInput={make?:string|null; model?:string|null; variant?:string|null; vehicle_type?:string|null; vehicle_category?:string|null; body_type?:string|null};
export const neutralVehicleArt="/assets/exchange-vehicles/neutral-vehicle.svg";
export function normalizeVehicleName(value?:string|null){return (value??"").normalize("NFKC").toUpperCase().replace(/\+/g," PLUS ").replace(/[^A-Z0-9]+/g," ").trim().replace(/\s+/g," ");}
const manufacturerAliases:Record<string,string>={"BAJAJ AUTO":"BAJAJ","BAJAJ AUTO LTD":"BAJAJ","BAJAJ AUTO LIMITED":"BAJAJ","HERO MOTOCORP":"HERO","HERO MOTOCORP LTD":"HERO","HERO MOTOCORP LIMITED":"HERO","HONDA MOTORCYCLE AND SCOOTER INDIA":"HONDA","HONDA MOTORCYCLE AND SCOOTER INDIA PVT LTD":"HONDA","SUZUKI MOTORCYCLE INDIA":"SUZUKI","SUZUKI MOTORCYCLE INDIA PVT LTD":"SUZUKI","MAHINDRA MAHINDRA":"MAHINDRA","MAHINDRA AND MAHINDRA":"MAHINDRA","MAHINDRA MAHINDRA LTD":"MAHINDRA","DAIMLER INDIA COMMERCIAL VEHICLES":"BHARATBENZ","TATA MOTORS":"TATA","TATA MOTORS LTD":"TATA","JCB INDIA":"JCB"};
function bodyFromText(value:string):VehicleBody{
  if(/\b(SCOOTER|MOPED)\b/.test(value))return "scooter";
  if(/\b(MOTORCYCLE|MOTOR BIKE|BIKE)\b/.test(value))return "motorcycle";
  if(/\b(BUS|OMNIBUS|SCHOOL BUS)\b/.test(value))return "bus";
  if(/\b(PICKUP|PICK UP|PIK UP)\b/.test(value))return "pickup";
  if(/\b(TIPPER|DUMPER)\b/.test(value))return "tipper";
  if(/\b(TRAILER|SEMITRAILER)\b/.test(value))return "trailer";
  if(/\b(BACKHOE|EXCAVATOR|CONSTRUCTION EQUIPMENT)\b/.test(value))return "construction";
  if(/\b(THREE WHEELER|AUTO RICKSHAW|E RICKSHAW)\b/.test(value))return "three-wheeler";
  if(/\b(TRACTOR)\b/.test(value))return "tractor";
  if(/\b(SUV|SPORT UTILITY)\b/.test(value))return "suv";
  if(/\b(TRUCK|LORRY)\b/.test(value))return "truck";
  if(/\b(CAR|SEDAN|HATCHBACK)\b/.test(value))return "car";
  return "unknown";
}
function compatible(body:VehicleBody, type:string){
  if(body==="unknown")return true;
  if(/^(TWP|TW|2WN|TWO WHEELER)$/.test(type))return body==="scooter"||body==="motorcycle";
  if(type==="PCP")return body==="car"||body==="suv";
  if(type==="GCV")return ["pickup","truck","tipper","trailer","three-wheeler"].includes(body);
  if(type==="PCV")return ["bus","car","three-wheeler"].includes(body);
  if(type==="CPM")return body==="construction";
  return true;
}
const fallbacks:Partial<Record<VehicleBody,string>>={car:"/assets/exchange-vehicles/pcp-car.webp",bus:"/assets/exchange-vehicles/pcv-bus.webp",construction:"/assets/exchange-vehicles/misd-cpm-jcb.png",truck:"/assets/exchange-vehicles/insureit-branded-truck.webp",motorcycle:"/assets/exchange-vehicles/bike-sketch.png"};
export function resolveCustomerExchangeVehicleArt(input:VehicleArtInput, catalogue:readonly VehicleAsset[]=vehicleAssetMaster){
  const rawMake=normalizeVehicleName(input.make),make=manufacturerAliases[rawMake]??rawMake,model=normalizeVehicleName(input.model),variant=normalizeVehicleName(input.variant);
  const type=normalizeVehicleName(input.vehicle_type),category=normalizeVehicleName(input.vehicle_category);
  const explicit=[input.body_type,input.vehicle_type,input.vehicle_category].map(v=>bodyFromText(normalizeVehicleName(v))).filter(v=>v!=="unknown");
  const explicitBody:VehicleBody=explicit.length>0?explicit[0]:"unknown";
  const neutral={src:neutralVehicleArt,kind:"placeholder" as const,body:"unknown" as VehicleBody,asset:undefined};
  if(new Set(explicit).size>1||!compatible(explicitBody,type)||!compatible(explicitBody,category))return neutral;
  const candidates=make&&model?catalogue.filter(a=>normalizeVehicleName(a.make)===make&&(normalizeVehicleName(a.model)===model||a.aliases.some(alias=>normalizeVehicleName(alias)===model))):[];
  const exact=candidates.filter(a=>variant&&normalizeVehicleName(a.variant)===variant);
  const eligible=exact.length?exact:candidates.filter(a=>!a.variant);
  if(eligible.length>1)return neutral;
  const asset=eligible[0];
  const body=asset?.body&&asset.body!=="unknown"?asset.body:explicitBody;
  if((explicitBody!=="unknown"&&body!==explicitBody)||!compatible(body,type)||!compatible(body,category))return neutral;
  if(asset?.verified&&asset.webp?.startsWith("/assets/exchange-vehicles/")&&asset.webp.endsWith(".webp")&&asset.source&&asset.licence&&body!=="unknown")return {src:asset.webp,kind:"model" as const,body,asset};
  const fallback=fallbacks[body];
  return {src:fallback??neutralVehicleArt,kind:fallback?"category" as const:"placeholder" as const,body,asset};
}
export function customerExchangeVehicleArt(vehicleType?:string|null,category?:string|null){return resolveCustomerExchangeVehicleArt({vehicle_type:vehicleType,vehicle_category:category}).src;}
