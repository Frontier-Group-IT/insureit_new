"use client";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import type {CatalogItem} from "@/lib/vehicle-image-catalog";
import {modelSearch} from "@/lib/vehicle-image-family";
export const modelOptionKey=(m:CatalogItem)=>JSON.stringify([m.manufacturerId,m.model]);
const label=(m:CatalogItem)=>m.make+" "+m.model.toUpperCase();
export function ModelPicker({models,value,onChange,disabled}:{models:CatalogItem[];value:string;onChange:(v:string)=>void;disabled:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[index,setIndex]=useState(0);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),list=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;top:number;width:number;maxHeight:number}|null>(null);
 const id=useId();
 const filtered=useMemo(()=>models.filter(m=>modelSearch(label(m),query)).sort((a,b)=>label(a).localeCompare(label(b),"en",{numeric:true,sensitivity:"base"})),[models,query]);
 const selected=models.find(m=>modelOptionKey(m)===value);
 function close(){setOpen(false);setQuery("");setIndex(0);setPosition(null);}
 function measure(){const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const left=Math.max(8,rect.left);const top=rect.bottom+4;setPosition({left,top,width:Math.max(0,Math.min(rect.width,window.innerWidth-left-8)),maxHeight:Math.max(80,Math.min(360,window.innerHeight-top-8))});}
 function select(m:CatalogItem){onChange(modelOptionKey(m));close();trigger.current?.focus();}
 useEffect(()=>{if(!open)return;measure();const outside=(e:PointerEvent)=>{const target=e.target as Node;if(!root.current?.contains(target)&&!panel.current?.contains(target))close();};const update=()=>measure();document.addEventListener("pointerdown",outside);window.addEventListener("resize",update);window.addEventListener("scroll",update,true);const observer=new ResizeObserver(update);if(trigger.current)observer.observe(trigger.current);return()=>{document.removeEventListener("pointerdown",outside);window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true);observer.disconnect();};},[open]);
 const positioned=position!==null;
 useEffect(()=>{if(open&&positioned)input.current?.focus({preventScroll:true});},[open,positioned]);
 useEffect(()=>{if(disabled)close();},[disabled]);
 useEffect(()=>{if(!open||!positioned)return;const el=document.getElementById(id+"-"+index),container=list.current;if(!el||!container)return;const item=el.getBoundingClientRect(),bounds=container.getBoundingClientRect();if(item.top<bounds.top)container.scrollTop-=bounds.top-item.top;else if(item.bottom>bounds.bottom)container.scrollTop+=item.bottom-bounds.bottom;},[open,positioned,index,id]);
 return <div ref={root} className="relative min-w-0" onBlur={e=>{const next=e.relatedTarget as Node|null;if(next&&!root.current?.contains(next)&&!panel.current?.contains(next))close();}}>
 <button ref={trigger} type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" className="flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-left text-slate-800" onClick={()=>{if(open)close();else{measure();setOpen(true);}}}><span className="min-w-0 flex-1 truncate">{selected?label(selected):"Select make & model"}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"ml-auto h-4 w-4 shrink-0 self-center transition-transform duration-150 motion-reduce:transition-none "+(open?"rotate-180":"")}><path d="m6 9 6 6 6-6"/></svg></button>
 {open&&!disabled&&position&&createPortal(<div ref={panel} className="fixed isolate flex min-w-0 flex-col rounded-lg border border-slate-200 p-2 text-slate-800 shadow-xl" style={{...position,zIndex:10000,backgroundColor:"#fff",opacity:1}}>
 <input ref={input} role="combobox" aria-label="Search make or model" aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={filtered[index]?id+"-"+index:undefined} className="w-full rounded border px-3 py-2" placeholder="Search make or model…" value={query} onChange={e=>{setQuery(e.target.value);setIndex(0);}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();close();trigger.current?.focus();}else if(e.key==="ArrowDown"){e.preventDefault();setIndex(i=>Math.min(i+1,Math.max(0,filtered.length-1)));}else if(e.key==="ArrowUp"){e.preventDefault();setIndex(i=>Math.max(0,i-1));}else if(e.key==="Enter"&&filtered[index]){e.preventDefault();select(filtered[index]);}}}/>
 <p className="px-2 py-1 text-xs text-slate-500">{filtered.length} results · A–Z</p>
 <div ref={list} id={id} role="listbox" aria-label="Vehicle models" className="min-h-0 max-h-60 flex-1 overflow-y-auto overscroll-contain">{filtered.map((m,i)=><div key={modelOptionKey(m)}>{(i===0||label(filtered[i-1])[0].toUpperCase()!==label(m)[0].toUpperCase())&&<div aria-hidden="true" className="bg-slate-100 px-2 py-1 text-xs font-semibold">{label(m)[0].toUpperCase()}</div>}<button id={id+"-"+i} type="button" role="option" aria-selected={value===modelOptionKey(m)} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>select(m)} className={"block w-full rounded px-2 py-2 text-left text-sm "+(i===index?"bg-indigo-50":"hover:bg-slate-50")}>{label(m)}{value===modelOptionKey(m)?" ✓":""}</button></div>)}{!filtered.length&&<p className="p-3 text-sm text-slate-500">No matching models found.</p>}</div>
 </div>,document.body)}
 </div>;
}
