/** Date calculations match Case Open & Issue; all calculations use calendar dates in UTC. */
export const validScheduleDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value+"T00:00:00Z").getTime()) && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
export type DateCalculationMode="minusOne"|"sameDay";
function yearsFromTerm(value:string){
  const normalized=value.trim().toLowerCase();
  if(!normalized||normalized.includes("single"))return null;
  const match=normalized.match(/(\d+(?:\.\d+)?)/);
  if(!match)return null;
  const years=Number(match[1]);
  return Number.isFinite(years)&&years>0?years:null;
}

export function addYearsByMode(start:string,term:string,mode:DateCalculationMode){
  if(!validScheduleDate(start))return"";
  const years=yearsFromTerm(term);
  if(!years||!Number.isInteger(years))return"";
  const date=new Date(`${start}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear()+years);
  if(mode==="minusOne")date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}
function addMonthsClamped(start:string,months:number){
  if(!validScheduleDate(start))return"";
  const [y,m,d]=start.split("-").map(Number);
  const targetMonth=(m-1)+months;
  const targetYear=y+Math.floor(targetMonth/12);
  const monthIndex=((targetMonth%12)+12)%12;
  const lastDay=new Date(Date.UTC(targetYear,monthIndex+1,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,monthIndex,Math.min(d,lastDay))).toISOString().slice(0,10);
}
export function canonicalPaymentFrequency(value:string){
  const normalized=value.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
  if(normalized==="monthly"||normalized==="month")return"Monthly";
  if(normalized==="quarterly"||normalized==="quarter")return"Quarterly";
  if(normalized==="half yearly"||normalized==="half year"||normalized==="semi annual"||normalized==="semi annually"||normalized==="semiannual")return"Half Yearly";
  if(normalized==="annual"||normalized==="annually"||normalized==="yearly"||normalized==="year")return"Annually";
  if(normalized==="one time"||normalized==="single"||normalized==="single pay")return"One Time";
  return value.trim();
}
export function nextInstallmentFrom(start:string,frequency:string){
  if(!validScheduleDate(start))return"";
  const canonical=canonicalPaymentFrequency(frequency);
  if(canonical==="One Time")return"";
  if(canonical==="Monthly")return addMonthsClamped(start,1);
  if(canonical==="Quarterly")return addMonthsClamped(start,3);
  if(canonical==="Half Yearly")return addMonthsClamped(start,6);
  if(canonical==="Annually")return addMonthsClamped(start,12);
  return"";
}

