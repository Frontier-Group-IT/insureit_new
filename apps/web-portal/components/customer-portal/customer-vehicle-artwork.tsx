"use client";
import { useState,type ReactNode } from "react";
export function CustomerVehicleArtwork({accountId,vehicleId,model,fallback,className}:{accountId:string;vehicleId:string;model:string;fallback:ReactNode;className?:string}){
 const src="/api/customer/vehicle-image?"+new URLSearchParams({account:accountId,vehicle:vehicleId});
 const [failed,setFailed]=useState<string|null>(null);
 return failed===src?<>{fallback}</>:<img src={src} alt={model||"Vehicle"} className={className??"h-10 w-16 object-contain"} loading="lazy" onError={()=>setFailed(src)}/>;
}
