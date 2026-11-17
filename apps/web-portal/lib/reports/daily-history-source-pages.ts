/**
 * Defensive, bounded read-only source pagination for the Daily Report.
 * A failed source returns its successfully read prefix and a warning marker.
 * No user identifiers or record content are written to diagnostic logs.
 */
export type ActivitySource = "Audit logs" | "Policies" | "Intake submissions" |
  "Intake finalizations" | "Case creation" | "Case conversions" |
  "Claim creation" | "Claim stage edits" | "Claim verification" | "Claim status history";
export type SourceRead<T> = {rows:T[];partial:boolean;failed:boolean};
export type PageResult<T> = {data:T[]|null;error:{message:string;code?:string}|null};

const BATCH = 500;
const MAX_ROWS_PER_SOURCE = 12000;
export async function readDailyHistoryPages<T>(
  source:ActivitySource,
  load:(from:number,to:number)=>PromiseLike<PageResult<T>>,
  options?: { retryFailedPage?: boolean },
):Promise<SourceRead<T>> {
  const rows:T[] = [];
  try {
    for(let offset=0;offset<MAX_ROWS_PER_SOURCE;offset+=BATCH) {
      let response:PageResult<T>;
      try {
        response = await load(offset,offset+BATCH-1);
        if(response.error && options?.retryFailedPage) {
          // One bounded retry for transient read failures. Do not skip a failed
          // page or return misleading complete totals.
          response = await load(offset,offset+BATCH-1);
        }
      } catch {
        if(!options?.retryFailedPage) throw new Error("history_page_request_failed");
        // A temporary transport failure can occur even when the database query
        // succeeds. Retry the same offset only, never advance past missing data.
        response = await load(offset,offset+BATCH-1);
      }
      const {data,error} = response;
      if(error) {
        console.error("[daily-report] history source unavailable",{source,code:error.code||"request_error"});
        return {rows,partial:true,failed:true};
      }
      rows.push(...(data??[]));
      if((data??[]).length < BATCH) return {rows,partial:false,failed:false};
    }
    return {rows,partial:true,failed:false};
  } catch {
    console.error("[daily-report] history source request failed",{source});
    return {rows,partial:true,failed:true};
  }
}
