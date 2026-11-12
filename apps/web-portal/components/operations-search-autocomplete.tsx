"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

/** Search suggestions are built only from the register's already-authorized rows. */
export function OperationsSearchAutocomplete({value,onChange,options,placeholder,hints,className="",label}:{
  value:string;onChange:(next:string)=>void;options:readonly string[];
  placeholder:string;hints?:readonly string[];className?:string;label:string;
}) {
  const anchor=useRef<HTMLSpanElement>(null);
  const [focused,setFocused]=useState(false);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [hintIndex,setHintIndex]=useState(0);
  const [mounted,setMounted]=useState(false);
  const [position,setPosition]=useState<CSSProperties>({});
  const [reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{setMounted(true);const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduceMotion(media.matches);update();
    media.addEventListener("change",update);
    return ()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{if(focused||value||reduceMotion||!hints?.length)return;
    const timer=window.setInterval(()=>setHintIndex(i=>i+1),3200);
    return ()=>window.clearInterval(timer);
  },[focused,value,reduceMotion,hints?.length]);
  const matches=useMemo(()=>{
    const q=value.trim().toLowerCase();if(q.length<2)return [];
    const seen=new Set<string>();
    return options.filter(item=>{const normalized=item?.trim().toLowerCase();
      if(!normalized||seen.has(normalized)||!normalized.includes(q))return false;
      seen.add(normalized);return true;
    }).slice(0,5);
  },[value,options]);
  const visible=mounted&&focused&&open&&value.trim().length>=2;
  useEffect(()=>{if(!visible)return;
    const place=()=>{const rect=anchor.current?.getBoundingClientRect();if(!rect)return;
      setPosition({position:"fixed",left:Math.max(8,rect.left),top:rect.bottom+5,width:rect.width,
        maxHeight:Math.max(120,Math.min(260,window.innerHeight-rect.bottom-12)),zIndex:500});
    };place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return ()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[visible]);
  function select(item:string){onChange(item);setOpen(false);setActive(0);}
  function keys(e:KeyboardEvent<HTMLSpanElement>){
    if(e.key==="Escape"){setOpen(false);return;}
    if(e.key==="ArrowDown"&&matches.length){e.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,matches.length-1));}
    if(e.key==="ArrowUp"&&matches.length){e.preventDefault();setActive(i=>Math.max(i-1,0));}
    if(e.key==="Enter"&&visible&&matches[active]){e.preventDefault();select(matches[active]);}
  }
  return <span ref={anchor} className="relative flex min-w-0 flex-1 items-center" onKeyDownCapture={keys}>
    <input type="search" value={value} autoComplete="off" aria-label={label}
      aria-autocomplete="list" aria-expanded={visible}
      placeholder={focused||value||reduceMotion?placeholder:(hints?.[hintIndex%(hints.length||1)]||placeholder)}
      onFocus={()=>{setFocused(true);setOpen(true);}}
      onBlur={()=>{setFocused(false);setOpen(false);}}
      onChange={e=>{onChange(e.target.value);setActive(0);setOpen(true);}}
      className={className}/>
    {visible?createPortal(
      <div role="listbox" aria-label={label+" suggestions"} style={position}
        className="overflow-y-auto rounded-xl border border-[#DCE5EF] bg-white p-1 shadow-[0_14px_35px_rgba(15,23,42,.18)]">
        {matches.length?matches.map((item,i)=><button key={item} type="button" role="option"
          aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>select(item)}
          className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs ${i===active?"bg-[#EEF4FF] text-[#17365D]":"text-[#334155] hover:bg-[#F8FAFC]"}`}>{item}</button>)
          :<p className="px-3 py-2 text-xs text-[#64748B]">No matching suggestions</p>}
      </div>,document.body):null}
  </span>;
}
