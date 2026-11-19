import React, {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';

const KEY='mapposter-clean-v3';
const DEFAULT={center:[14.4515,50.132],zoom:14.5,bearing:0,title:'VOZOVNA KOBYLISY',subtitle:'ČESKO',format:'2:3',accent:'#ff3600',paper:'dark',rails:true,style:'liberty'};
const STYLES={
 liberty:'https://tiles.openfreemap.org/styles/liberty',
 bright:'https://tiles.openfreemap.org/styles/bright',
 raster:{version:8,name:'OpenStreetMap raster fallback',
  sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},
  layers:[{id:'osm-tiles',type:'raster',source:'osm'}]}
};
const STEPS=['Lokalita','Kompozice','Vrstvy','Vzhled','Export'];
function load(){
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved && Array.isArray(saved.center)&&saved.center.length===2)return {...DEFAULT,...saved};}catch{}
 return {...DEFAULT};
}
function coords(s){return Math.abs(s.center[1]).toFixed(4)+'°'+(s.center[1]>=0?'N':'S')+', '+Math.abs(s.center[0]).toFixed(4)+'°'+(s.center[0]>=0?'E':'W');}
function filename(s){return 'mapposter-'+(s.title||'mapa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,45)+'.png';}
function railSource(map){
 const layers=map.getStyle()?.layers||[];
 return layers.find(l=>l['source-layer']==='transportation'&&l.source)?.source||null;
}
function updateRail(map,s){
 if(!map.isStyleLoaded())return false;
 const id='mapposter-rail';
 if(map.getLayer(id))map.removeLayer(id);
 if(!s.rails)return true;
 const source=railSource(map);if(!source)return false;
 try{
  map.addLayer({
   id,type:'line',source,'source-layer':'transportation',
   filter:['any',['==',['get','class'],'rail'],['==',['get','class'],'tram'],['==',['get','class'],'subway'],['==',['get','subclass'],'rail'],['==',['get','subclass'],'tram']],
   paint:{'line-color':s.accent,'line-width':['interpolate',['linear'],['zoom'],10,1,13,1.8,16,3,19,5],'line-opacity':.95}
  });
  return true;
 }catch(error){console.warn('Rail overlay unavailable',error);return false;}
}
function textLines(ctx,text,maxWidth){
 const words=(text||'MAP POSTER').trim().split(/\s+/),lines=[];let line='';
 for(const word of words){
  const next=line?line+' '+word:word;
  if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;
 }
 if(line)lines.push(line);
 return lines.slice(0,3);
}
// A loaded map style is not proof that the WebGL framebuffer has geographic content.
// Inspect pixels and fail closed instead of generating a misleading empty poster.
function mapHasVisibleContent(canvas){
 const width=canvas.width,height=canvas.height;
 if(width<2||height<2)return false;
 const probe=document.createElement('canvas');
 probe.width=32;probe.height=32;
 const ctx=probe.getContext('2d',{willReadFrequently:true});
 if(!ctx)return false;
 ctx.drawImage(canvas,0,0,32,32);
 const pixels=ctx.getImageData(0,0,32,32).data;
 const bins=new Set();
 let opaque=0;
 for(let y=3;y<29;y+=3)for(let x=3;x<29;x+=3){
  const p=(y*32+x)*4;
  if(pixels[p+3]<40)continue;
  opaque++;
  bins.add([pixels[p]>>4,pixels[p+1]>>4,pixels[p+2]>>4].join(':'));
 }
 return opaque>15 && bins.size>=4;
}
function waitForMapFrame(map,timeoutMs=6500){
 return new Promise((resolve,reject)=>{
  let finished=false;
  const finish=(error)=>{
   if(finished)return;
   finished=true;clearTimeout(timer);map.off('render',onRender);
   if(error)reject(error);else resolve();
  };
  const onRender=()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>finish()));};
  const timer=setTimeout(()=>finish(Error('MapLibre nevykreslil nový snímek')),timeoutMs);
  map.on('render',onRender);
  map.resize();
  map.triggerRepaint();
 });
}
async function readableMapFrame(map){
 // Do not trust idle alone: a WebGL canvas may have been cleared by the browser.
 for(let attempt=0;attempt<3;attempt++){
  await waitForMapFrame(map);
  const canvas=map.getCanvas();
  if(mapHasVisibleContent(canvas))return canvas;
 }
 throw Error('Mapový podklad je prázdný. Export byl zastaven. Zkontroluj dlaždice/WebGL a zkus mapu znovu načíst.');
}

export default function App(){
 const [s,setS]=useState(load);
 const [step,setStep]=useState(0);
 const [term,setTerm]=useState('Vozovna Kobylisy, Praha');
 const [results,setResults]=useState([]);
 const [searchBusy,setSearchBusy]=useState(false);
 const [status,setStatus]=useState('Spouštím mapu…');
 const [mapPhase,setMapPhase]=useState('loading');
 const [detail,setDetail]=useState('');
 const [exportBusy,setExportBusy]=useState(false);
 const host=useRef(null),mapRef=useRef(null),settings=useRef(s),request=useRef(null);
 settings.current=s;
 const patch=(change)=>setS(prev=>({...prev,...change}));
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}},[s]);
 useEffect(()=>{
  if(!host.current)return;
  let map;
  try{
   map=new maplibregl.Map({
    container:host.current,
    style:STYLES[settings.current.style]||STYLES.liberty,
    center:settings.current.center,zoom:settings.current.zoom,
    bearing:settings.current.bearing,pitch:0,
    attributionControl:false,preserveDrawingBuffer:true,
    maxZoom:19,minZoom:3
   });
  }catch(error){setMapPhase('error');setStatus('Mapu nelze spustit');setDetail(String(error));return;}
  mapRef.current=map;
  let triedRasterFallback=false;
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
  map.on('style.load',()=>{
   setStatus('Mapový styl načten, čekám na dlaždice…');
   setMapPhase('loading');
   const ok=updateRail(map,settings.current);
   if(!ok)setDetail('Zvýraznění jednotlivých kolejí tento styl nemusí podporovat.');
  });
  map.on('idle',()=>{
   // The style can report idle even if no visible map pixels were rendered.
   const canvas=map.getCanvas();
   if(mapHasVisibleContent(canvas)){
    setMapPhase('ready');setStatus('Mapa připravena');
   }else{
    if(!triedRasterFallback && settings.current.style!=='raster'){
     triedRasterFallback=true;
     setStatus('Vektorová mapa je prázdná, zkouším záložní podklad…');
     setDetail('OpenFreeMap nevrátil viditelný obraz; přepínám na rastrovou mapu OpenStreetMap.');
     setS(prev=>({...prev,style:'raster'}));
     map.setStyle(STYLES.raster);
    }else{
     setMapPhase('error');
     setStatus('Mapové podklady jsou prázdné');
     setDetail('Ani záložní podklad se nevykreslil. Zkontroluj síťové požadavky nebo WebGL.');
    }
   }
  });
  map.on('error',event=>{
   console.warn('MapLibre map error',event.error);
   const msg=String(event.error?.message||'Neznámá chyba');
   setDetail(msg.slice(0,200));
   setStatus('Chyba mapových podkladů');
   setMapPhase('error');
  });
  map.on('moveend',()=>{
   const c=map.getCenter();
   setS(p=>({...p,center:[+c.lng.toFixed(6),+c.lat.toFixed(6)],zoom:+map.getZoom().toFixed(2),bearing:+map.getBearing().toFixed(1)}));
  });
  // Fixed container dimensions prevent map initializing at 0 px height.
  const observer=new ResizeObserver(()=>map.resize());
  observer.observe(host.current);
  setTimeout(()=>map.resize(),200);
  return ()=>{observer.disconnect();mapRef.current=null;map.remove();};
 },[]);
 useEffect(()=>{
  const map=mapRef.current;if(!map||!map.isStyleLoaded())return;
  const ok=updateRail(map,s);
  if(!ok)setDetail('Vektorové dlaždice nepodporují detailní zvýraznění kolejí.');
 },[s.rails,s.accent]);
 useEffect(()=>{mapRef.current?.resize();},[s.format,step]);
 async function search(event){
  event.preventDefault();
  if(term.trim().length<2)return;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setSearchBusy(true);setResults([]);
  try{
   const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=cs&q='+encodeURIComponent(term.trim());
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   setResults(await response.json());
  }catch(error){if(!controller.signal.aborted)setDetail('Hledání selhalo: '+String(error));}
  finally{if(!controller.signal.aborted)setSearchBusy(false);}
 }
 function choose(place){
  const center=[Number(place.lon),Number(place.lat)];
  if(!center.every(Number.isFinite))return;
  setResults([]);setTerm(place.display_name.split(',')[0]);
  patch({center,zoom:15});mapRef.current?.flyTo({center,zoom:15,duration:650});
 }
 function changeStyle(style){
  if(style===s.style)return;
  patch({style});setMapPhase('loading');setStatus('Načítám mapový styl…');
  mapRef.current?.setStyle(STYLES[style]||STYLES.liberty);
 }
 function reset(){
  setS({...DEFAULT});setTerm('Vozovna Kobylisy, Praha');
  mapRef.current?.jumpTo({center:DEFAULT.center,zoom:DEFAULT.zoom,bearing:0});
 }
 async function download(){
  const map=mapRef.current;
  if(!map||mapPhase!=='ready')return;
  setExportBusy(true);
  try{
   if(!map.loaded()){
    await Promise.race([new Promise(resolve=>map.once('idle',resolve)),new Promise((_,reject)=>setTimeout(()=>reject(Error('Mapové dlaždice se nenačetly')),6000))]);
   }
   const h={'2:3':2400,'3:4':2133,'1:1':1600}[s.format]||2400,w=1600;
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas není dostupný');
   ctx.fillStyle=s.paper==='dark'?'#101215':'#f6f5f1';ctx.fillRect(0,0,w,h);
   const photo=await readableMapFrame(map);
   if(!photo.width||!photo.height)throw Error('Mapový obraz není k dispozici');
   const mh=Math.round(h*.76);
   ctx.drawImage(photo,0,0,photo.width,photo.height,0,0,w,mh);
   ctx.fillStyle=s.paper==='dark'?'#101215':'#f6f5f1';ctx.fillRect(0,mh,w,h-mh);
   ctx.strokeStyle=s.paper==='dark'?'#60656a':'#999';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(135,mh+40);ctx.lineTo(w-135,mh+40);ctx.stroke();
   await document.fonts.ready;
   ctx.font='700 88px "Bebas Neue",Impact,sans-serif';
   ctx.fillStyle=s.paper==='dark'?'#fff':'#20242a';
   textLines(ctx,s.title.toLocaleUpperCase('cs-CZ'),w-270).forEach((line,i)=>ctx.fillText(line,135,mh+140+i*90));
   ctx.font='21px Montserrat,sans-serif';ctx.fillStyle=s.paper==='dark'?'#a4b1bb':'#5b626a';
   ctx.fillText((s.subtitle||'ČESKO')+' · '+coords(s),135,Math.min(h-95,mh+240));
   ctx.font='16px Montserrat,sans-serif';
   ctx.fillText('© OpenStreetMap contributors · ODbL',135,h-30);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('PNG se nepodařilo vytvořit');
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=filename(s);document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setDetail('Soubor PNG byl připraven ke stažení.');
  }catch(error){setDetail('Export selhal: '+String(error));}
  finally{setExportBusy(false);}
 }
 return <div className="shell">
  <header className="header"><div className="logo"><span>▥</span> MAPPOSTER <b>STUDIO</b><small>3.0</small></div><a href="https://github.com/anlexcz/mapposter" target="_blank" rel="noreferrer">GitHub ↗</a></header>
  <main className="layout">
   <aside className="sidebar">
    <div className="eyebrow">MAPOVÝ PLAKÁT · WIZARD</div><h1>Vytvoř vlastní mapu.</h1>
    <nav className="steps">{STEPS.map((label,i)=><button type="button" key={label} className={i===step?'active':''} onClick={()=>setStep(i)}><span>{i+1}</span>{label}</button>)}</nav>
    <section className="editor">
     <div className="eyebrow">KROK {step+1} Z 5</div><h2>{STEPS[step]}</h2>
     {step===0&&<div className="fields"><label>Hledat lokalitu</label><form onSubmit={search} className="search"><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Vozovna, nádraží, město…"/><button disabled={searchBusy}>{searchBusy?'…':'Najít'}</button></form>
      {results.length>0&&<div className="results">{results.map((r,i)=><button key={i} onClick={()=>choose(r)}>{r.display_name}</button>)}</div>}
      <p className="info">Mapou posouvej přímo na plakátu. Není potřeba používat druhý mapový náhled.</p><button className="muted" onClick={reset}>Vrátit vozovnu Kobylisy</button></div>}
     {step===1&&<div className="fields"><label>Formát</label><select value={s.format} onChange={e=>patch({format:e.target.value})}><option value="2:3">2:3 – klasický plakát</option><option value="3:4">3:4 – portrét</option><option value="1:1">1:1 – čtverec</option></select>
      <label>Přiblížení <output>{s.zoom.toFixed(1)}</output></label><input type="range" min="3" max="19" step=".1" value={s.zoom} onChange={e=>mapRef.current?.zoomTo(+e.target.value,{duration:0})}/>
      <label>Natočení <output>{s.bearing.toFixed(0)}°</output></label><input type="range" min="-180" max="180" value={s.bearing} onChange={e=>mapRef.current?.rotateTo(+e.target.value,{duration:0})}/></div>}
     {step===2&&<div className="fields"><label>Podklad mapy</label><select value={s.style} onChange={e=>changeStyle(e.target.value)}><option value="liberty">OpenFreeMap Liberty</option><option value="bright">OpenFreeMap Bright</option><option value="raster">OpenStreetMap – záložní podklad</option></select>
      <label className="check"><span>Zvýraznit koleje (pokud je zdroj obsahuje)</span><input type="checkbox" checked={s.rails} onChange={e=>patch({rails:e.target.checked})}/></label>
      <p className="info">Mapové vrstvy záměrně nepřebarvujeme hromadně. Nejdřív ověřujeme funkční geografický podklad.</p></div>}
     {step===3&&<div className="fields"><label>Barva kolejí</label><div className="swatches">{['#ff3600','#c02caa','#005682','#00aeae','#e5af38'].map(color=><button key={color} style={{background:color}} className={s.accent===color?'chosen':''} title={color} aria-label={'Barva '+color} onClick={()=>patch({accent:color})}/>)}</div>
       <label>Barva plakátu</label><select value={s.paper} onChange={e=>patch({paper:e.target.value})}><option value="dark">Anlex Dark</option><option value="light">Minimal Light</option></select>
       <label>Název</label><input value={s.title} maxLength={70} onChange={e=>patch({title:e.target.value})}/>
       <label>Podtitulek</label><input value={s.subtitle} maxLength={55} onChange={e=>patch({subtitle:e.target.value})}/></div>}
     {step===4&&<div className="fields"><div className="summary"><div><small>LOKALITA</small><strong>{coords(s)}</strong></div><div><small>FORMÁT</small><strong>{s.format}</strong></div><div><small>ZDROJ</small><strong>OpenFreeMap · {s.style}</strong></div></div>
       <button className="primary wide" disabled={mapPhase!=='ready'||exportBusy} onClick={download}>{exportBusy?'Připravuji…':'Stáhnout PNG'}</button>
       <p className="info">Exportuje se aktuální vykreslený záběr mapy. Rozlišení mapového podkladu závisí na velikosti náhledu. Vektorové SVG zatím není součástí této verze.</p></div>}
    </section>
    <div className="nav-buttons"><button className="muted" disabled={step===0} onClick={()=>setStep(i=>Math.max(0,i-1))}>← Zpět</button><button className="primary" onClick={()=>setStep(i=>i===4?0:i+1)}>{step===4?'Upravit':'Pokračovat →'}</button></div>
   </aside>
   <section className="workspace">
    <div className="workspace-head"><div><div className="eyebrow">ŽIVÝ NÁHLED</div><h2>Tvůj mapový plakát</h2></div><span>{coords(s)}</span></div>
    <div className="stage"><div className="paper" style={{aspectRatio:s.format.replace(':',' / ')}}>
      <div className={'poster '+s.paper}>
       <div className="map-container"><div ref={host} className="map-host"/>{mapPhase!=='ready'&&<div className="map-message"><strong>{status}</strong><span>{detail}</span><button onClick={()=>{setMapPhase('loading');setDetail('');mapRef.current?.setStyle(STYLES[s.style]||STYLES.liberty);}}>Znovu načíst mapu</button></div>}</div>
       <div className="caption"><div className="line"/><div className="poster-title">{s.title||'MAP POSTER'}</div><div className="poster-subtitle">{s.subtitle||'ČESKO'} · {coords(s)}</div><div className="attribution">© OpenStreetMap contributors · ODbL</div></div>
      </div>
    </div>
    <div className="zoom-tools"><button onClick={()=>mapRef.current?.zoomIn()} aria-label="Přiblížit">+</button><button onClick={()=>mapRef.current?.zoomOut()} aria-label="Oddálit">−</button><button onClick={()=>mapRef.current?.resetNorth()} aria-label="Sever nahoru">N</button></div>
    </div>
    <div className="footer-status"><span className={'dot '+mapPhase}/><strong>{status}</strong><span>{detail||'Zdrojem mapy jsou vektorové dlaždice OpenFreeMap (OpenStreetMap).'}</span></div>
   </section>
  </main>
 </div>;
}
