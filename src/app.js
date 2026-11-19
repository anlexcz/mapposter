"use strict";
const $ = id => document.getElementById(id);
const state = {lat:50.052,lon:14.471,ways:[],color:"#ff3600",loading:false};
const escapeXML = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const WIDTH = 800;
const formats = {"2:3":1200,"3:4":1067,"1:1":800};
const numeric = value => Number(value) || 0;
function bbox(){
  const km=numeric($("radius").value), latDeg=km/111.32, lonDeg=km/(111.32*Math.cos(state.lat*Math.PI/180));
  // Map drawing area has portrait proportions, with room beyond the focal centre.
  return {south:state.lat-latDeg*.80,north:state.lat+latDeg*.80,west:state.lon-lonDeg/2,east:state.lon+lonDeg/2};
}
function pointToXY(lat,lon,box,H){
  return [((lon-box.west)/(box.east-box.west))*WIDTH, ((box.north-lat)/(box.north-box.south))*H];
}
function geoPath(way,box,H){
  if(!way.geometry || way.geometry.length<2)return "";
  return way.geometry.map((p,i)=>{const [x,y]=pointToXY(p.lat,p.lon,box,H);return (i?"L":"M")+x.toFixed(2)+","+y.toFixed(2)}).join(" ");
}
function currentPalette(){
  return $("scheme").value==="light" ? {bg:"#f6f5f1",street:"#a6a5a2",minor:"#d2d0cc",text:"#17191d",soft:"#686a6d",building:"#c4c2bf"} : {bg:"#101114",street:"#9d9c9c",minor:"#53545b",text:"#f0f1f4",soft:"#a2a3ad",building:"#505059"};
}
function svgMarkup(){
  const h=formats[$("format").value] || 1200;
  const mapEnd=Math.round(h*.745), mapTop=24, mapH=mapEnd-mapTop;
  const pal=currentPalette(), box=bbox(), color=state.color;
  const rotation=numeric($("rotation").value);
  const layers={building:[],road:[],rail:[],tram:[]};
  for(const way of state.ways){
    const tags=way.tags || {};let layer=null;
    if(tags.railway==="rail" || tags.railway==="light_rail" || tags.railway==="subway" || tags.railway==="narrow_gauge")layer="rail";
    else if(tags.railway==="tram")layer="tram";
    else if(tags.highway)layer="road";
    else if(tags.building)layer="building";
    if(!layer)continue;
    const d=geoPath(way,box,mapH);if(!d)continue;
    if(layer==="building" && $("buildings").checked)layers.building.push('<path d="'+d+' Z" fill="none" stroke="'+pal.building+'" stroke-width=".85" opacity=".65"/>');
    if(layer==="road" && $("roads").checked){const wide=/^(motorway|trunk|primary|secondary)$/.test(tags.highway);layers.road.push('<path d="'+d+'" fill="none" stroke="'+(wide?pal.street:pal.minor)+'" stroke-width="'+(wide?2.1:1)+'" opacity="'+(wide?.78:.60)+'" stroke-linejoin="round" stroke-linecap="round"/>')}
    if((layer==="rail" && $("rail").checked)||(layer==="tram" && $("tram").checked))layers[layer].push('<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+(layer==="tram"?1.9:2.15)+'" opacity=".94" stroke-linejoin="round" stroke-linecap="round"/>');
  }
  const title=escapeXML($("titleText").value || "MAP POSTER").toLocaleUpperCase("cs-CZ");
  const subtitle=escapeXML($("subtitle").value || "");
  const latDir=state.lat>=0?"N":"S",lonDir=state.lon>=0?"E":"W";
  const coords=Math.abs(state.lat).toFixed(4)+"°"+latDir+", "+Math.abs(state.lon).toFixed(4)+"°"+lonDir;
  const topH=Math.round(h*.77);
  let fontSize=title.length>38?37:title.length>28?47:60;
  const words=title.split(/\s+/);
  const lines=[];let line="";
  for(const word of words){if((line+" "+word).length>(title.length>38?32:27) && line){lines.push(line);line=word;}else line+=(line?" ":"")+word;}
  if(line)lines.push(line);
  const lineSVG=lines.slice(0,3).map((l,i)=>'<text x="82" y="'+(topH+73+i*(fontSize+4))+'" font-family="Barlow Condensed,Arial Narrow,Arial,sans-serif" font-size="'+fontSize+'" font-weight="700" fill="'+pal.text+'">'+escapeXML(l)+'</text>').join("");
  const afterTitle=topH+73+Math.min(lines.length,3)*(fontSize+4)+16;
  const footerY=Math.min(h-37,afterTitle+8);
  const attribution='© OpenStreetMap contributors · ODbL';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+WIDTH+'" height="'+h+'" viewBox="0 0 '+WIDTH+' '+h+'">'+
    '<rect width="'+WIDTH+'" height="'+h+'" fill="'+pal.bg+'"/>'+
    '<defs><clipPath id="mapClip"><rect x="44" y="'+mapTop+'" width="712" height="'+mapH+'"/></clipPath></defs>'+
    '<g clip-path="url(#mapClip)"><g transform="translate(400 '+(mapTop+mapH/2)+') rotate('+rotation+') translate(-400 -'+(mapH/2)+')"><g transform="translate(0 '+mapTop+')">'+
    layers.building.join("")+layers.road.join("")+layers.rail.join("")+layers.tram.join("")+'</g></g></g>'+
    '<line x1="82" y1="'+topH+'" x2="718" y2="'+topH+'" stroke="'+pal.soft+'" stroke-width="1" opacity=".7"/>'+
    lineSVG+
    '<text x="82" y="'+footerY+'" font-family="Arial,sans-serif" font-size="13" letter-spacing="2.3" fill="'+pal.soft+'">'+escapeXML(subtitle+" · "+coords)+'</text>'+
    '<text x="82" y="'+(h-18)+'" font-family="Arial,sans-serif" font-size="11" fill="'+pal.soft+'">'+escapeXML(attribution)+'</text>'+
    '</svg>';
}
function render(){
 $("poster").innerHTML=svgMarkup();
 $("radiusValue").textContent=numeric($("radius").value).toLocaleString("cs-CZ")+" km";
 $("rotationValue").textContent=$("rotation").value+"°";
}
function status(message){$("status").textContent=message}
async function loadMap(){
 if(state.loading)return;state.loading=true;$("load").disabled=true;status("Načítám OpenStreetMap…");
 const b=bbox();
 const q='[out:json][timeout:35];(way["railway"]('+b.south+','+b.west+','+b.north+','+b.east+');way["highway"]('+b.south+','+b.west+','+b.north+','+b.east+');way["building"]('+b.south+','+b.west+','+b.north+','+b.east+'););out geom;';
 const hosts=["https://overpass.private.coffee/api/interpreter","https://overpass.kumi.systems/api/interpreter","https://overpass-api.de/api/interpreter"];
 let error=null;
 for(const host of hosts){
  try{
   const response=await fetch(host,{method:"POST",body:new URLSearchParams({data:q}),headers:{"Content-Type":"application/x-www-form-urlencoded"}});
   if(!response.ok)throw new Error("HTTP "+response.status);
   const payload=await response.json();
   if(!Array.isArray(payload.elements))throw new Error("Chybí prvky mapy");
   state.ways=payload.elements.filter(x=>x.type==="way"&&x.geometry);
   status("Načteno "+state.ways.length.toLocaleString("cs-CZ")+" objektů");
   render();error=null;break;
  }catch(e){error=e;}
 }
 if(error){status("Data se nepodařilo načíst. Zkus to znovu.");console.error(error)}
 state.loading=false;$("load").disabled=false;
}
$("searchForm").addEventListener("submit",async e=>{
 e.preventDefault();const q=$("search").value.trim();if(!q)return;
 status("Vyhledávám…");$("results").replaceChildren();
 try{
  const url="https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=cs&q="+encodeURIComponent(q);
  const response=await fetch(url,{headers:{"Accept":"application/json"}});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const results=await response.json();if(!results.length){status("Nic nenalezeno – posuň mapu ručně");return;}
  for(const item of results){
   const btn=document.createElement("button");btn.type="button";btn.textContent=item.display_name;
   btn.addEventListener("click",()=>{state.lat=Number(item.lat);state.lon=Number(item.lon);$("results").replaceChildren();$("search").value=item.display_name.split(",")[0];$("titleText").value=item.display_name.split(",")[0].toLocaleUpperCase("cs-CZ");state.ways=[];syncPicker();render();loadMap()});
   $("results").append(btn);
  }
  status("Vyber výsledek hledání nebo posuň mapu");
 }catch(err){status("Vyhledávání se nezdařilo");console.error(err)}
});
document.querySelectorAll("[data-move]").forEach(btn=>btn.addEventListener("click",()=>{
 const [dx,dy]=btn.dataset.move.split(",").map(Number);const b=bbox();
 state.lon+=dx*(b.east-b.west)*.18;state.lat-=dy*(b.north-b.south)*.18;
 state.ways=[];syncPicker();
let picker=null, pickerOutline=null, pickerTimer=null, pickerBusy=false;
function updateCoordinateLabel(){
 const ns=state.lat>=0?"N":"S",ew=state.lon>=0?"E":"W";
 $("centerCoordinates").textContent=Math.abs(state.lat).toFixed(4)+"° "+ns+", "+Math.abs(state.lon).toFixed(4)+"° "+ew;
}
function syncPicker(){
 updateCoordinateLabel();
 if(!picker)return;
 pickerBusy=true;
 picker.panTo([state.lat,state.lon],{animate:false});
 updatePickerOutline();
 pickerBusy=false;
}
function updatePickerOutline(){
 if(!picker || !pickerOutline)return;
 const box=bbox();
 pickerOutline.setBounds([[box.south,box.west],[box.north,box.east]]);
}
function initializePicker(){
 updateCoordinateLabel();
 if(typeof L==="undefined"){status("Mapový podklad se nepodařilo načíst");return;}
 picker=L.map("locationPicker",{zoomControl:true,scrollWheelZoom:true,attributionControl:true}).setView([state.lat,state.lon],14);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  subdomains:"abc",maxZoom:19,attribution:"© OpenStreetMap contributors"
 }).addTo(picker);
 const b=bbox();
 pickerOutline=L.rectangle([[b.south,b.west],[b.north,b.east]],{color:"#ff3600",weight:2,fillColor:"#ff3600",fillOpacity:.09,interactive:false}).addTo(picker);
 picker.on("moveend",()=>{
  if(pickerBusy)return;
  const c=picker.getCenter();state.lat=c.lat;state.lon=c.lng;
  updateCoordinateLabel();updatePickerOutline();state.ways=[];render();
  status("Výřez změněn – načítám mapová data");
  clearTimeout(pickerTimer);pickerTimer=setTimeout(loadMap,900);
 });
 picker.on("zoomend",()=>{
  if(pickerBusy)return;
  const suggested=Math.min(4,Math.max(.4,1.4*Math.pow(2,14-picker.getZoom())));
  $("radius").value=(Math.round(suggested*5)/5).toFixed(1);
  updatePickerOutline();render();
 });
 $("resetPosition").addEventListener("click",()=>{
  state.lat=50.052;state.lon=14.471;$("radius").value="1.4";state.ways=[];
  pickerBusy=true;picker.setView([state.lat,state.lon],14,{animate:false});updatePickerOutline();pickerBusy=false;
  updateCoordinateLabel();render();loadMap();
 });
 setTimeout(()=>picker.invalidateSize(),100);
}

initializePicker();render();loadMap();
}));
$("load").addEventListener("click",loadMap);
for(const id of ["titleText","subtitle","scheme","rail","tram","roads","buildings","rotation","format"]){
 $(id).addEventListener("input",render);
}
$("radius").addEventListener("input",()=>{state.ways=[];syncPicker();render();status("Nový výřez – načti mapová data")});
$("swatches").addEventListener("click",e=>{
 const btn=e.target.closest("[data-color]");if(!btn)return;state.color=btn.dataset.color;
 $("customColor").value=state.color;
 document.querySelectorAll("[data-color]").forEach(b=>b.classList.toggle("active",b===btn));render();
});
$("customColor").addEventListener("input",e=>{state.color=e.target.value;document.querySelectorAll("[data-color]").forEach(b=>b.classList.remove("active"));render()});
function download(blob,filename){
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const filename=()=>("mapposter-"+($("titleText").value||"mapa").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55));
$("svgExport").addEventListener("click",()=>download(new Blob([svgMarkup()],{type:"image/svg+xml;charset=utf-8"}),filename()+".svg"));
$("pngExport").addEventListener("click",async()=>{
 const button=$("pngExport");button.disabled=true;status("Připravuji PNG…");
 try{
  const markup=svgMarkup();const svgBlob=new Blob([markup],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(svgBlob),img=new Image();
  try{
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("Obrázek nelze dekódovat"));img.src=url;});
   const canvas=document.createElement("canvas");canvas.width=2400;canvas.height=Math.round(2400*(formats[$("format").value]||1200)/WIDTH);
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas není dostupný");
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
   if(!blob)throw new Error("PNG nelze vytvořit");
   download(blob,filename()+".png");status("PNG exportováno");
  }finally{URL.revokeObjectURL(url)}
 }catch(e){console.error(e);status("Export PNG selhal – zkus SVG")}
 button.disabled=false;
});
render();loadMap();