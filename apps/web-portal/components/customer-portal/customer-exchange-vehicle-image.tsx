"use client";
import {useState,useRef} from "react";
import {neutralVehicleArt} from "@/lib/customer-exchange-vehicle-art";
export function ExchangeVehicleImage({src,label,kind,showroom=false}:{src:string;label:string;kind:"model"|"category"|"placeholder"|"photo";showroom?:boolean}){
  const [failed,setFailed]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const displaySrc=failed?neutralVehicleArt:src;
  return <div ref={ref} className={showroom?"exchange-vehicle-stage":"exchange-vehicle-thumbnail"} onPointerMove={event=>{
    if(!showroom||event.pointerType!=="mouse"||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const box=event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--rx",((.5-(event.clientY-box.top)/box.height)*7).toFixed(2)+"deg");
    event.currentTarget.style.setProperty("--ry",(((event.clientX-box.left)/box.width-.5)*9).toFixed(2)+"deg");
  }} onPointerLeave={()=>{ref.current?.style.removeProperty("--rx");ref.current?.style.removeProperty("--ry");}}>
    {!loaded&&!failed?<span aria-hidden="true" className="exchange-vehicle-shimmer"/>:null}
    {failed&&displaySrc===src?<span className="text-[10px] text-slate-500">Image unavailable</span>:<img src={displaySrc} alt={failed||kind==="placeholder"?"Vehicle image unavailable":kind==="photo"?label:kind==="model"?label+" representative model image":"Representative vehicle category illustration"} loading="lazy" decoding="async" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} className={`exchange-vehicle-img ${loaded||failed?"is-ready":""} ${kind==="photo"&&!failed?"is-photo":""}`}/>}
    {showroom?<span className="exchange-vehicle-label">{failed||kind==="placeholder"?"Image unavailable":kind==="model"?"Representative model image":"Representative category image"}</span>:null}
  </div>;
}
