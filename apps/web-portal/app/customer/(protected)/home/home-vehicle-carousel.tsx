"use client";
import Link from "next/link";
import {useRef,useState,useEffect} from "react";
import {CarFront, Bike, Truck, Bus, CirclePlus, ChevronLeft, ChevronRight, Tractor} from "lucide-react";
type Item={id:string;number:string;model:string;vehicleType:string;insured:boolean};
export function HomeVehicleArt({vehicleType}:{vehicleType?:string|null}){
  const kind=(vehicleType||"").toUpperCase();
  const Icon=/^(TWP|TW|2WN)$/.test(kind)?Bike:kind==="GCV"?Truck:kind==="PCV"?Bus:kind==="MISD"||kind==="CPM"?Tractor:CarFront;
  return <span className="ref-home-vehicle-art" role="img" aria-label="Representative vehicle category icon"><Icon strokeWidth={1.5}/></span>;
}
export function HomeVehicleCarousel({items,accountId}:{items:Item[];accountId:string}){
 const rail=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState(0),[max,setMax]=useState(0);
 function sync(){const el=rail.current;if(!el)return;setPosition(el.scrollLeft);setMax(Math.max(0,el.scrollWidth-el.clientWidth));}
 useEffect(()=>{const el=rail.current;if(!el)return;const ro=new ResizeObserver(sync);ro.observe(el);sync();return()=>ro.disconnect();},[items.length]);
 function move(direction:number){const el=rail.current;if(!el)return;el.scrollBy({left:direction*el.clientWidth*.75,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}
 const pages=Math.min(7,Math.max(1,Math.ceil(max/(rail.current?.clientWidth||1))+1));
 return <div className="ref-home-carousel">
   <button type="button" className="ref-home-prev" aria-label="Previous vehicles" onClick={()=>move(-1)} disabled={position<2}><ChevronLeft size={17}/></button>
   <div ref={rail} onScroll={sync} className="ref-home-rail" tabIndex={0} aria-label="Your vehicles">
     {items.map(v=><Link key={v.id} className="ref-home-vehicle" href={{pathname:`/customer/vehicles/${v.id}`,query:{account:accountId}}}><HomeVehicleArt vehicleType={v.vehicleType}/><strong>{v.number}</strong><span title={v.model}>{v.model}</span><small className={v.insured?"insured":"uninsured"}>{v.insured?"Insured":"Not Insured"}</small></Link>)}
     <Link className="ref-home-vehicle ref-home-add" href={{pathname:"/customer/add-vehicle",query:{account:accountId}}}><CirclePlus size={32}/><strong>Add Vehicle</strong></Link>
   </div>
   <button type="button" className="ref-home-next" aria-label="Next vehicles" onClick={()=>move(1)} disabled={position>=max-2}><ChevronRight size={17}/></button>
   <div className="ref-home-dots">{Array.from({length:pages},(_,i)=><button key={i} type="button" aria-label={`Vehicle page ${i+1}`} aria-current={i===Math.round((max?position/max:0)*(pages-1))?"true":undefined} onClick={()=>rail.current?.scrollTo({left:pages===1?0:max*i/(pages-1),behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}/>)}</div>
 </div>;
}
