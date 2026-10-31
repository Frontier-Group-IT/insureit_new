"use client";
import { useFormStatus } from "react-dom";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function SaveButton({canceling}:{canceling:boolean}) {
 const {pending}=useFormStatus();
 return <button type="submit" disabled={pending||canceling} aria-disabled={pending||canceling} className="rounded-lg bg-[#17365D] px-5 py-2 text-white disabled:cursor-wait disabled:opacity-50">{pending?"Saving...":"Save Changes"}</button>;
}
export function GroupEditFormActions({returnHref}:{returnHref:string}) {
 const router=useRouter();
 const [canceling,setCanceling]=useState(false);
 const [navigating,startTransition]=useTransition();
 return <div className="flex justify-end gap-3"><button type="button" disabled={canceling||navigating} onClick={()=>{setCanceling(true);startTransition(()=>router.push(returnHref));}} className="rounded-lg border px-5 py-2 disabled:cursor-wait disabled:opacity-50">{canceling||navigating?"Canceling...":"Cancel"}</button><SaveButton canceling={canceling||navigating}/></div>;
}
