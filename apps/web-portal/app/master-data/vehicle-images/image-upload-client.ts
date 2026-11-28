export async function optimizeVehicleImage(file:File){
 if(file.size>20*1024*1024)throw new Error("Original exceeds 20 MB");
 const image=await createImageBitmap(file);
 try{
 const scale=Math.min(1,1200/image.width,900/image.height);
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image decoding unavailable");
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",0.82));
 if(!blob||blob.type!=="image/webp"||blob.size>2097152)throw new Error("Unable to optimize image");
 return blob;
 }finally{image.close();}
}

export async function uploadVehicleImage(file:File,manufacturerId:string,model:string,replace:boolean){
 const blob=await optimizeVehicleImage(file);
 const body=new FormData();body.set("image",blob,"vehicle.webp");body.set("manufacturerId",manufacturerId);body.set("model",model);body.set("replace",String(replace));
 const res=await fetch("/api/master-data/vehicle-images",{method:"POST",body});
 const result=await res.json();if(!res.ok)throw new Error(result.error||"Upload failed");
 return result;
}
