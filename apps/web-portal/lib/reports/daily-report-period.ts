import { selfDateWindow } from "@/lib/reports/daily-history-validation";

export type DailyReportPeriod = "90d" | "mtd" | "ytd" | "all" | "custom";
export type DailyReportPeriodQuery = {period?:string;from?:string;to?:string};

export function resolveDailyReportPeriod(query:DailyReportPeriodQuery, now=new Date()) {
  const period:DailyReportPeriod = query.period === "90d" || query.period === "mtd" ||
    query.period === "ytd" || query.period === "custom" || query.period === "all"
      ? query.period : "all";
  if(period==="all") return {period,from:undefined,to:undefined,valid:true};
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  const today=`${part("year")}-${part("month")}-${part("day")}`;
  let from:string, to:string=today;
  if(period==="custom"){
    if(!query.from || !query.to || !selfDateWindow(query.from) || !selfDateWindow(query.to) ||
       query.from>query.to || query.to>today) {
      return {period,from:undefined,to:undefined,valid:false};
    }
    from=query.from;to=query.to;
  } else if(period==="mtd"){
    from=`${today.slice(0,7)}-01`;
  } else if(period==="ytd"){
    from=`${today.slice(0,4)}-01-01`;
  } else {
    const todayStart=selfDateWindow(today);
    if(!todayStart) throw new Error("Unable to resolve IST reporting date");
    from=new Date(new Date(todayStart.from).getTime()-89*86400000)
      .toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"});
    // en-CA formatting can vary by runtime; derive the local calendar date via parts.
    const earlier=new Date(new Date(todayStart.from).getTime()-89*86400000);
    const earlierParts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
    }).formatToParts(earlier);
    const get=(type:string)=>earlierParts.find(p=>p.type===type)?.value??"";
    from=`${get("year")}-${get("month")}-${get("day")}`;
  }
  return {period,from,to,valid:true};
}

export function dailyReportRangeWindow(from?:string,to?:string) {
  if(!from && !to) return null;
  const start=from?selfDateWindow(from):null;
  const end=to?selfDateWindow(to):null;
  if(!start || !end || from!>to!) throw new Error("Invalid Daily Report date range");
  return {from:start.from,to:end.to};
}
