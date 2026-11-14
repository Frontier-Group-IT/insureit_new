/** Validate authenticated Supabase profile IDs (standard 8-4-4-4-12 UUIDs). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDailyProfileId(id:string):boolean {
  return UUID.test(id);
}

export function isValidDailyRecordId(id:string):boolean {
  return UUID.test(id);
}

export function selfDateWindow(day?:string) {
  if (!day || !ISO_DATE.test(day)) return null;
  const start = new Date(`${day}T00:00:00+05:30`);
  if (!Number.isFinite(start.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(start);
  const val=(part:string)=>p.find(x=>x.type===part)?.value??"";
  if (`${val("year")}-${val("month")}-${val("day")}`!==day) return null;
  return {from:start.toISOString(),to:new Date(start.getTime()+86_400_000).toISOString()};
}
