// Static, customer-independent catalogue. Only reviewed, licensed files may be published.
export type VehicleBody = "scooter"|"motorcycle"|"car"|"suv"|"pickup"|"truck"|"bus"|"trailer"|"tipper"|"construction"|"tractor"|"three-wheeler"|"unknown";
export type VehicleAsset = {
  make: string; model: string; variant?: string; aliases: readonly string[];
  body: VehicleBody; webp?: string; glb?: string; source?: string; licence?: string; verified: boolean;
};
export const vehicleAssetMaster: readonly VehicleAsset[] = [
  {make:"BAJAJ",model:"CHETAK 3503",aliases:["C3503","CHETAK C3503","CHETAK / C3503"],body:"scooter",verified:false},
  {make:"BAJAJ",model:"CHETAK 3502",aliases:["C3502","CHETAK C3502","CHETAK / C3502"],body:"scooter",verified:false},
  {make:"BAJAJ",model:"CHETAK 3001",aliases:["C3001","CHETAK / C3001"],body:"scooter",verified:false},
  {make:"BAJAJ",model:"CHETAK 3501",aliases:["C3501"],body:"scooter",verified:false},
  {make:"BAJAJ",model:"CHETAK 2501",aliases:["C2501"],body:"scooter",verified:false},
  {make:"BAJAJ",model:"CHETAK",aliases:[],body:"scooter",verified:false},
  {make:"HERO",model:"SPLENDOR PLUS",aliases:["SPLENDOR+"],body:"motorcycle",verified:false},
  {make:"HERO",model:"HF DELUX",aliases:["HF DELUXE"],body:"motorcycle",verified:false},
  {make:"HERO",model:"PLEASURE PLUS",aliases:["PLEASURE+"],body:"scooter",verified:false},
  {make:"HONDA",model:"SHINE",aliases:["CB SHINE","SHINE 125"],body:"motorcycle",verified:false},
  {make:"SUZUKI",model:"ACCESS 125",aliases:["ACCESS125"],body:"scooter",verified:false},
  {make:"MAHINDRA",model:"BOLERO MAXX PIK-UP CITY",aliases:["BOLERO MAXX PICK UP CITY","BOLERO MAXX PIK UP CITY"],body:"pickup",verified:false},
  {make:"MAHINDRA",model:"BOLERO XL 2WD",aliases:[],body:"unknown",verified:false},
  {make:"BHARATBENZ",model:"5532T",aliases:["5532 TRAILER","5532T - 4X2 BSVI","BHARATBENZ 5532TT 4X2 BSVI-14"],body:"truck",verified:false},
  {make:"JCB",model:"3DX",aliases:["3 DX","3 DX 2WD / BACKHOE LOADER"],body:"construction",verified:false},
  {make:"TATA",model:"ACE GOLD",aliases:[],body:"pickup",verified:false},
  {make:"KIA",model:"SELTOS",aliases:[],body:"suv",verified:false},
];
