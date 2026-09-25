"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type PortfolioChartRow={key:string;label:string;primary:number;secondary:number};
export type PortfolioChartVariant={
  id:string;
  label:string;
  rows:PortfolioChartRow[];
  primaryLabel:string;
  secondaryLabel:string;
  primaryFormat?:"count"|"number";
  secondaryFormat?:"count"|"number";
};

export function PortfolioInteractiveChart({
  title,
  variants,
  defaultId,
}:{
  title:string;
  variants:PortfolioChartVariant[];
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

  return <>
    <div className="portfolio-card-head">
      <h2>{title}</h2>
      <div className="portfolio-chart-select" ref={rootRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={()=>setOpen((current)=>!current)}
        >
          {selected.label}
          <ChevronDown className={open?"open":""} />
        </button>
        {open?<div className="portfolio-chart-menu" role="menu">
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
    <PortfolioDualBarChart variant={selected}/>
  </>;
}

function PortfolioDualBarChart({variant}:{variant:PortfolioChartVariant}){
  const primaryMax=Math.max(...variant.rows.map((row)=>row.primary),1);
  const secondaryMax=Math.max(...variant.rows.map((row)=>row.secondary),1);

  return <div className="portfolio-chart">
    <div className="portfolio-legend">
      <span><i className="primary"/>{variant.primaryLabel}</span>
      <span><i className="secondary"/>{variant.secondaryLabel}</span>
    </div>
    <div className="portfolio-chart-plot" style={{gridTemplateColumns:`repeat(${Math.max(variant.rows.length,5)}, minmax(58px, 1fr))`,minWidth:variant.rows.length>5?`${variant.rows.length*82}px`:undefined}}>
      {variant.rows.map((row)=><div className="portfolio-chart-group" key={row.key}>
        <div className="portfolio-chart-bars">
          <div className="portfolio-bar-wrap">
            <strong>{formatValue(row.primary,variant.primaryFormat??"number")}</strong>
            <i className="portfolio-bar primary" style={{height:`${Math.max(row.primary?5:0,(row.primary/primaryMax)*100)}%`}}/>
          </div>
          <div className="portfolio-bar-wrap">
            <strong>{formatValue(row.secondary,variant.secondaryFormat??"number")}</strong>
            <i className="portfolio-bar secondary" style={{height:`${Math.max(row.secondary?5:0,(row.secondary/secondaryMax)*100)}%`}}/>
          </div>
        </div>
        <span className="portfolio-chart-label" title={row.label}>{row.label}</span>
      </div>)}
    </div>
  </div>;
}

function formatValue(value:number,format:"count"|"number"){
  return new Intl.NumberFormat("en-IN",{
    maximumFractionDigits:format==="count"?0:1,
  }).format(value||0);
}
