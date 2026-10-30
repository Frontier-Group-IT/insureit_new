/** Match the vehicle-class artwork used by the Customer mobile app's My Vehicles screen. */
export function customerExchangeVehicleArt(vehicleType?: string | null, category?: string | null): string {
  const kind = [vehicleType, category].filter(Boolean).join(" ").toUpperCase();
  if (/\b(TWP|TW|TWO.WHEEL|BIKE|SCOOTER|MOTORCYCLE)\b/.test(kind)) return "/assets/exchange-vehicles/bike-sketch.png";
  if (/\b(PCV|BUS|PASSENGER)\b/.test(kind)) return "/assets/exchange-vehicles/bus-sketch.png";
  if (/\b(MISD|CPM|JCB|CONSTRUCTION|PLANT|MACHINERY|EXCAVATOR)\b/.test(kind)) return "/assets/exchange-vehicles/jcb-sketch.png";
  if (/\b(PCP|CAR|PRIVATE)\b/.test(kind)) return "/assets/exchange-vehicles/car-sketch.png";
  return "/assets/exchange-vehicles/insureit-branded-truck.webp";
}
