/**
 * Approved operational rule: when manufacturing year is absent, use a
 * separately printed vehicle registration year/date as a *year-only fallback*.
 * Never infer manufacturing month/day, use the policy issue date, or overwrite
 * an actual manufacture year. Financial extraction is outside this helper.
 */
export function resolveManufacturingYearEvidence(fields) {
  const unique=(key)=>{
    const values=fields.filter(f=>f.key===key);
    return values.length<=1 ? (values[0]?.value?.trim()??"") : null;
  };
  const mfg=unique("vehicle_manufacturing_year");
  const regYear=unique("vehicle_registration_year");
  const regDate=unique("vehicle_registration_date");
  if(mfg===null||regYear===null||regDate===null)
    return {year:"",source:"missing"};
  const allowedYear=(s)=> /^(?:19|20)\d{2}$/.test(s)
    && Number(s)<=new Date().getUTCFullYear() && Number(s)>=1900;
  if(allowedYear(mfg))return {year:mfg,source:"manufacturing_year"};
  if(mfg && !/^(?:--|N\/A|NA|NOT AVAILABLE|UNKNOWN)$/i.test(mfg))
    return {year:"",source:"missing"};
  const datedYear=regDate ? (()=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(regDate))return "";
    const time=new Date(regDate+"T00:00:00Z");
    return Number.isFinite(time.getTime())
      && time.toISOString().slice(0,10)===regDate ? regDate.slice(0,4):"";
  })() : "";
  if(regDate && !datedYear)return {year:"",source:"missing"};
  if(regYear && !allowedYear(regYear))return {year:"",source:"missing"};
  if(regYear && datedYear && regYear!==datedYear)
    return {year:"",source:"missing"};
  const year=regYear||datedYear;
  if(!year||!allowedYear(year))return {year:"",source:"missing"};
  return {year,source:"registration_year_fallback"};
}
