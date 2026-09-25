"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type OperationsInteractiveRow={
  key:string;
  label:string;
  values:number[];
};

export type OperationsInteractiveVariant={
  id:string;
  label:string;
  series:string[];
  rows:OperationsInteractiveRow[];
};

export function OperationsInteractiveChart({
  title,
  variants,
  defaultId,
}:{
  title:string;
  variants:OperationsInteractiveVariant[];
  defaultId:string;
}){
  const initial=variants.find((variant)=>variant.id===defaultId)??variants[0];
  const [selectedId,setSelectedId]=useState(initial?.id??"");
  const [open,setOpen]=useState(false);
  const rootRef=useRef<HTMLDivElement>(null);
  const selected=variants.find((variant)=>variant.id===selectedId)??initial;

  useEffect(()=>{
    if(!open)return;
    function onPointerDown(event:MouseEvent){
      if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);
    }
    function onKeyDown(event:KeyboardEvent){
      if(event.key==="Escape")setOpen(false);
    }
    document.addEventListener("mousedown",onPointerDown);
    document.addEventListener("keydown",onKeyDown);
    return()=>{
      document.removeEventListener("mousedown",onPointerDown);
      document.removeEventListener("keydown",onKeyDown);
    };
  },[open]);

  if(!selected)return null;

  const allValues=selected.rows.flatMap((row)=>row.values);
  const max=Math.max(...allValues,1);

  return <>
    <div className="operations-card-head">
      <h2>{title}</h2>
      <div className="operations-chart-select" ref={rootRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={()=>setOpen((current)=>!current)}
        >
          {selected.label}
          <ChevronDown className={open?"open":""}/>
        </button>
        {open?<div className="operations-chart-menu" role="menu">
          {variants.map((variant)=><button
            key={variant.id}
            type="button"
            role="menuitemradio"
            aria-checked={variant.id===selected.id}
            className={variant.id===selected.id?"active":""}
            onClick={()=>{
              setSelectedId(variant.id);
              setOpen(false);
            }}
          >
            <span>{variant.label}</span>
            {variant.id===selected.id?<Check className="h-3.5 w-3.5"/>:null}
          </button>)}
        </div>:null}
      </div>
    </div>

    <div className="operations-chart">
      <div className="operations-legend">
        {selected.series.map((series,index)=><span key={series}><i className={tone(index)}/>{series}</span>)}
      </div>
      <div
        className="operations-chart-plot"
        style={{
          gridTemplateColumns:`repeat(${Math.max(selected.rows.length,5)}, minmax(58px, 1fr))`,
          minWidth:selected.rows.length>5?`${selected.rows.length*82}px`:undefined,
        }}
      >
        {selected.rows.map((row)=><div className="operations-chart-group" key={row.key}>
          <div className={`operations-chart-bars ${row.values.length===1?"single":""}`}>
            {row.values.map((value,index)=><div className="operations-bar-wrap" key={`${row.key}-${index}`}>
              <strong>{integer(value)}</strong>
              <i className={`operations-bar ${tone(index)}`} style={{height:`${Math.max(value?5:0,(value/max)*100)}%`}}/>
            </div>)}
          </div>
          <span className="operations-chart-label" title={row.label}>{row.label}</span>
        </div>)}
      </div>
    </div>
  </>;
}

function tone(index:number){
  if(index===0)return "missing";
  if(index===1)return "expired";
  return "due";
}

function integer(value:number){
  return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(value||0);
}
