"use client";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import type {CatalogItem} from "@/lib/vehicle-image-catalog";
import {modelSearch} from "@/lib/vehicle-image-family";
export const modelOptionKey=(m:CatalogItem)=>JSON.stringify([m.manufacturerId,m.model]);
const label=(m:CatalogItem)=>m.make+" "+m.model.toUpperCase();
export function ModelPicker({models,value,onChange,disabled}:{models:CatalogItem[];value:string;onChange:(v:string)=>void;disabled:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[index,setIndex]=useState(0);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const id=useId();
 const filtered=useMemo(()=>models.filter(m=>modelSearch(label(m),query)).sort((a,b)=>label(a).localeCompare(label(b),"en",{numeric:true,sensitivity:"base"})),[models,query]);
 const selected=models.find(m=>modelOptionKey(m)===value);
 function close(){setOpen(false);setQuery("");setIndex(0);}
 function select(m:CatalogItem){onChange(modelOptionKey(m));close();trigger.current?.focus();}
 useEffect(()=>{if(!open)return;input.current?.focus();const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setOpen(false);setQuery("");setIndex(0);}};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[open]);
 useEffect(()=>{if(open)document.getElementById(id+"-"+index)?.scrollIntoView({block:"nearest"});},[open,index,id]);
 return <div ref={root} className="relative min-w-0" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))close();}}>
 <button ref={trigger} type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-slate-800" onClick={()=>{if(open)close();else setOpen(true);}}>{selected?label(selected):"Select make & model"}<span aria-hidden="true">⌄</span></button>
 {open&&!disabled&&<div className="absolute left-0 top-full z-50 mt-1 w-full min-w-0 rounded-lg border bg-white p-2 text-slate-800 shadow-xl">
 <input ref={input} role="combobox" aria-label="Search make or model" aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={filtered[index]?id+"-"+index:undefined} className="w-full rounded border px-3 py-2" placeholder="Search make or model…" value={query} onChange={e=>{setQuery(e.target.value);setIndex(0);}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();close();trigger.current?.focus();}else if(e.key==="ArrowDown"){e.preventDefault();setIndex(i=>Math.min(i+1,Math.max(0,filtered.length-1)));}else if(e.key==="ArrowUp"){e.preventDefault();setIndex(i=>Math.max(0,i-1));}else if(e.key==="Enter"&&filtered[index]){e.preventDefault();select(filtered[index]);}}}/>
 <p className="px-2 py-1 text-xs text-slate-500">{filtered.length} results · A–Z</p>
 <div id={id} role="listbox" aria-label="Vehicle models" className="max-h-60 overflow-y-auto overscroll-contain">{filtered.map((m,i)=><div key={modelOptionKey(m)}>{(i===0||label(filtered[i-1])[0].toUpperCase()!==label(m)[0].toUpperCase())&&<div aria-hidden="true" className="bg-slate-100 px-2 py-1 text-xs font-semibold">{label(m)[0].toUpperCase()}</div>}<button id={id+"-"+i} type="button" role="option" aria-selected={value===modelOptionKey(m)} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>select(m)} className={"block w-full rounded px-2 py-2 text-left text-sm "+(i===index?"bg-indigo-50":"hover:bg-slate-50")}>{label(m)}{value===modelOptionKey(m)?" ✓":""}</button></div>)}{!filtered.length&&<p className="p-3 text-sm text-slate-500">No matching models found.</p>}</div>
 </div>}
 </div>;
}
