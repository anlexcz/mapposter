import {useEffect, useRef, useState} from 'react';
import maplibregl, {type Map as LibreMap, type LayerSpecification} from 'maplibre-gl';

type Settings = {
  center: [number,number]; zoom:number; bearing:number;
  title:string; subtitle:string; ratio:'2:3'|'3:4'|'1:1';
  accent:string; theme:'dark'|'light';
  rail:boolean; roads:boolean; buildings:boolean; labels:boolean;
};
type SearchHit={display_name:string;lat:string;lon:string};
const DEFAULT:Settings={
  center:[14.4515,50.132],zoom:14.4,bearing:0,
  title:'VOZOVNA KOBYLISY',subtitle:'ČESKO',ratio:'2:3',
  accent:'#ff3600',theme:'dark',rail:true,roads:true,buildings:true,labels:false
};
const STEPS=['Lokalita','Kompozice','Mapové vrstvy','Vzhled','Export'];
const STYLE='https://tiles.openfreemap.org/styles/liberty';
const storageKey='mapposter-studio-v2';
function loadSaved():Settings{
  try{
    const stored=JSON.parse(localStorage.getItem(storageKey)??'null');
    if(stored && Array.isArray(stored.center) && stored.center.length===2 &&
       Number.isFinite(stored.center[0]) && Number.isFinite(stored.center[1]))
      return {...DEFAULT,...stored};
  }catch {/* ignore corrupt settings */}
  return DEFAULT;
}
function getPresetColor(key:string){return ['#ff3600','#d631a9','#005682','#00aead','#eab547'].includes(key);}
function classify(id:string,sourceLayer:string){
  const name=(id+' '+sourceLayer).toLowerCase();
  return {
    building:/building/.test(name),
    road:/road|highway|transportation|bridge|tunnel/.test(name),
    rail:/rail|tram|subway/.test(name),
    label:/label|symbol|place|poi/.test(name),
    water:/water/.test(name),
    park:/park|landcover|landuse|grass|forest/.test(name)
  };
}
function applyMapStyle(map:LibreMap,settings:Settings){
  if(!map.isStyleLoaded())return;
  const dark=settings.theme==='dark';
  const bg=dark?'#111315':'#f6f5f1';
  const road=dark?'#6e737a':'#aaa7a3';
  const minor=dark?'#3a3f46':'#d3d1ce';
  const buildings=dark?'#333840':'#cac7c2';
  const water=dark?'#171e27':'#e6edf0';
  const park=dark?'#141a17':'#f0f1eb';
  const layers=map.getStyle().layers ?? [];
  for(const layer of layers){
    const sourceLayer=('source-layer' in layer ? layer['source-layer'] : '') || '';
    const kind=classify(layer.id,sourceLayer);
    try{
      if(layer.type==='symbol'){
        map.setLayoutProperty(layer.id,'visibility',settings.labels?'visible':'none');
      }else if(layer.type==='background'){
        map.setPaintProperty(layer.id,'background-color',bg);
      }else if(layer.type==='fill'){
        map.setPaintProperty(layer.id,'fill-color',kind.building?buildings:kind.water?water:kind.park?park:bg);
        map.setPaintProperty(layer.id,'fill-opacity',kind.building?(settings.buildings?.68:0):1);
      }else if(layer.type==='line'){
        const hidden=(kind.road&&!settings.roads&&!kind.rail) || (kind.rail&&!settings.rail);
        map.setLayoutProperty(layer.id,'visibility',hidden?'none':'visible');
        map.setPaintProperty(layer.id,'line-color',kind.rail?settings.accent:kind.road?road:minor);
      }else if(layer.type==='fill-extrusion'){
        map.setLayoutProperty(layer.id,'visibility','none');
      }else if(layer.type==='circle'){
        map.setLayoutProperty(layer.id,'visibility','none');
      }
    }catch(error){console.debug('Skipping unsupported style property',layer.id,error);}
  }
  // Emphasize individual rail/tram lines when the vector tiles contain that detail.
  const transportation=layers.find(layer=>('source-layer' in layer) &&
    layer['source-layer']==='transportation' && 'source' in layer && typeof layer.source==='string');
  if(transportation && 'source' in transportation && typeof transportation.source==='string'){
    const id='poster-rail-highlight';
    if(map.getLayer(id))map.removeLayer(id);
    if(settings.rail){
      try{
        const highlight={
          id,type:'line',source:transportation.source,'source-layer':'transportation',
          filter:['any',['==',['get','class'],'rail'],['==',['get','class'],'tram'],
            ['==',['get','class'],'subway'],['==',['get','subclass'],'tram'],
            ['==',['get','subclass'],'rail']],
          paint:{'line-color':settings.accent,'line-width':['interpolate',['linear'],['zoom'],10,0.7,13,1.3,16,2.5,18,4],
            'line-opacity':0.98}
        } as LayerSpecification;
        map.addLayer(highlight);
      }catch(error){console.warn('Rail highlight unavailable for this vector style',error);}
    }
  }
}
function coordinates(settings:Settings){
  const [lon,lat]=settings.center;
  return Math.abs(lat).toFixed(4)+'°'+(lat>=0?'N':'S')+', '+Math.abs(lon).toFixed(4)+'°'+(lon>=0?'E':'W');
}
function wrapText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
  const words=text.split(/\s+/),lines:string[]=[];
  let line='';
  for(const word of words){
    const candidate=(line?line+' ':'')+word;
    if(ctx.measureText(candidate).width>maxWidth && line){lines.push(line);line=word;}
    else line=candidate;
  }
  if(line)lines.push(line);
  return lines.slice(0,3);
}
function saveCanvas(canvas:HTMLCanvasElement,name:string){
  canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  },'image/png');
}
export default function App(){
  const [settings,setSettings]=useState<Settings>(loadSaved);
  const [step,setStep]=useState(0);
  const [query,setQuery]=useState('Vozovna Kobylisy, Praha');
  const [hits,setHits]=useState<SearchHit[]>([]);
  const [searching,setSearching]=useState(false);
  const [mapStatus,setMapStatus]=useState('Připravuji vektorovou mapu…');
  const [mapReady,setMapReady]=useState(false);
  const [exporting,setExporting]=useState(false);
  const canvasHost=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<LibreMap|null>(null);
  const settingsRef=useRef(settings);
  const searchAbort=useRef<AbortController|null>(null);
  const patch=(change:Partial<Settings>)=>setSettings(p=>({...p,...change}));
  settingsRef.current=settings;
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}},[settings]);
  useEffect(()=>{
    if(!canvasHost.current)return;
    let map:LibreMap;
    try{
      map=new maplibregl.Map({
        container:canvasHost.current,style:STYLE,center:settingsRef.current.center,
        zoom:settingsRef.current.zoom,bearing:settingsRef.current.bearing,pitch:0,
        attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},
        maxZoom:19,minZoom:4
      });
    }catch(e){setMapStatus('Mapu nelze spustit: '+String(e));return;}
    mapRef.current=map;
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
    map.on('load',()=>{setMapReady(true);setMapStatus('Vektorová mapa připravena');applyMapStyle(map,settingsRef.current);});
    map.on('style.load',()=>{setMapReady(true);setMapStatus('Vektorová mapa připravena');applyMapStyle(map,settingsRef.current);});
    map.on('error',event=>{
      const error=event.error;
      console.warn('MapLibre:',error);
      setMapStatus('Nelze načíst některé mapové podklady. Zkontroluj připojení.');
    });
    map.on('moveend',()=>{
      const center=map.getCenter();
      setSettings(p=>({...p,center:[Number(center.lng.toFixed(6)),Number(center.lat.toFixed(6))],
        zoom:Number(map.getZoom().toFixed(2)),bearing:Number(map.getBearing().toFixed(1))}));
    });
    const observer=new ResizeObserver(()=>map.resize());
    observer.observe(canvasHost.current);
    return ()=>{observer.disconnect();mapRef.current=null;map.remove();};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;
    if(!map || !map.isStyleLoaded())return;
    applyMapStyle(map,settings);
  },[settings.accent,settings.theme,settings.rail,settings.roads,settings.buildings,settings.labels]);
  useEffect(()=>{
    mapRef.current?.resize();
  },[settings.ratio,step]);
  const find=async(event:React.FormEvent)=>{
    event.preventDefault();
    const search=query.trim();if(search.length<2)return;
    searchAbort.current?.abort();const controller=new AbortController();
    searchAbort.current=controller;setSearching(true);setHits([]);
    try{
      const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=cs&q='+encodeURIComponent(search);
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const found=await response.json() as SearchHit[];
      setHits(found);
      if(!found.length)setMapStatus('Místo nenalezeno. Zkus přesnější název.');
    }catch(e){if(!controller.signal.aborted)setMapStatus('Vyhledávání se nezdařilo: '+String(e));}
    finally{if(!controller.signal.aborted)setSearching(false);}
  };
  const selectPlace=(hit:SearchHit)=>{
    const lon=Number(hit.lon),lat=Number(hit.lat);
    if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
    const center:[number,number]=[lon,lat];
    patch({center,zoom:15});
    mapRef.current?.flyTo({center,zoom:15,duration:650});
    setHits([]);setQuery(hit.display_name.split(',')[0]);
    setMapStatus('Lokalita vybrána');
  };
  const zoom=(delta:number)=>mapRef.current?.zoomTo(Math.min(19,Math.max(4,(mapRef.current?.getZoom()||14)+delta)),{duration:300});
  const reset=()=>{setSettings(DEFAULT);mapRef.current?.jumpTo({center:DEFAULT.center,zoom:DEFAULT.zoom,bearing:0});setQuery('Vozovna Kobylisy, Praha');};
  const exportPng=async()=>{
    const map=mapRef.current;if(!map||!mapReady)return;
    setExporting(true);
    try{
      // Export composes the same live map viewport with poster typography.
      // Export resolution is 1600 px wide; map imagery is upscaled from WebGL viewport.
      if(!map.loaded())await new Promise<void>(resolve=>{
        const timeout=setTimeout(resolve,3500);
        map.once('idle',()=>{clearTimeout(timeout);resolve();});
      });
      const width=1600,heights:{[key:string]:number}={'2:3':2400,'3:4':2133,'1:1':1600};
      const height=heights[settings.ratio],mapHeight=Math.round(height*.77);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D není dostupný');
      const dark=settings.theme==='dark';
      ctx.fillStyle=dark?'#101215':'#f6f5f1';ctx.fillRect(0,0,width,height);
      const img=map.getCanvas();
      ctx.drawImage(img,0,0,img.width,img.height,0,0,width,mapHeight);
      ctx.fillStyle=dark?'#101215':'#f6f5f1';ctx.fillRect(0,mapHeight,width,height-mapHeight);
      ctx.strokeStyle=dark?'#696d72':'#a9a9aa';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(145,mapHeight+40);ctx.lineTo(width-145,mapHeight+40);ctx.stroke();
      ctx.fillStyle=dark?'#f4f5f5':'#18191b';
      const fontSize=settings.title.length>30?70:90;
      ctx.font='700 '+fontSize+'px "Bebas Neue","Arial Narrow",Arial,sans-serif';
      const titleLines=wrapText(ctx,settings.title.toLocaleUpperCase('cs-CZ'),width-290);
      titleLines.forEach((line,index)=>ctx.fillText(line,145,mapHeight+150+index*(fontSize+6)));
      ctx.fillStyle=dark?'#bfc4c8':'#656970';
      ctx.font='24px Montserrat,Arial,sans-serif';
      ctx.fillText(settings.subtitle.toLocaleUpperCase('cs-CZ')+'  ·  '+coordinates(settings),145,Math.min(height-95,mapHeight+230+Math.max(0,titleLines.length-1)*(fontSize+6)));
      ctx.font='17px Montserrat,Arial,sans-serif';
      ctx.fillText('© OpenStreetMap contributors · ODbL',145,height-34);
      const name='mapposter-'+settings.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50)+'.png';
      saveCanvas(canvas,name);
      setMapStatus('PNG bylo připraveno ke stažení');
    }catch(e){setMapStatus('Export se nezdařil: '+String(e));}
    finally{setExporting(false);}
  };
  const propsOf=(key:keyof Settings)=>settings[key];
  return <div className="app-shell">
    <header className="header">
      <div className="brand"><span className="brand-mark">▥</span><span>MAPPOSTER <em>STUDIO</em></span><small>2.0</small></div>
      <div className="header-right"><span>Mapa · Design · Export</span><a href="https://github.com/anlexcz/mapposter" target="_blank" rel="noreferrer">GitHub ↗</a></div>
    </header>
    <main className="main">
      <aside className="wizard">
        <div className="intro"><span className="eyebrow">TVORBA MAPOVÉHO PLAKÁTU</span><h1>Vytvoř si vlastní mapu.</h1><p>Vyber místo, nastav kompozici a uprav vzhled. Náhled reaguje na změny okamžitě.</p></div>
        <nav className="step-nav" aria-label="Kroky generátoru">
          {STEPS.map((name,i)=><button key={name} className={'step-pill '+(i===step?'selected':'')} onClick={()=>setStep(i)} aria-current={step===i?'step':undefined}><span>{i+1}</span>{name}</button>)}
        </nav>
        <section className="step-content" aria-labelledby="step-title">
          <div className="step-counter">KROK {step+1} / 05</div>
          <h2 id="step-title">{STEPS[step]}</h2>
          {step===0&&<div className="fields">
            <label htmlFor="place">Vyhledat lokalitu</label>
            <form className="search" onSubmit={find}><input id="place" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Název města, vozovny, stanice…"/><button type="submit" disabled={searching}>{searching?'…':'Hledat'}</button></form>
            {hits.length>0&&<div className="hits">{hits.map(hit=><button key={hit.lat+hit.lon+hit.display_name} onClick={()=>selectPlace(hit)}>{hit.display_name}</button>)}</div>}
            <div className="notice">Mapu posouvej přímo na plakátu. Kolečkem myši nebo tlačítky přiblížíš místo.</div>
            <button className="secondary reset" onClick={reset}>Vrátit výchozí Kobylisy</button>
          </div>}
          {step===1&&<div className="fields">
            <label htmlFor="ratio">Formát plakátu</label>
            <select id="ratio" value={settings.ratio} onChange={e=>patch({ratio:e.target.value as Settings['ratio']})}><option value="2:3">2 : 3 – klasický plakát</option><option value="3:4">3 : 4 – portrét</option><option value="1:1">1 : 1 – čtverec</option></select>
            <label htmlFor="angle">Natočení mapy <output>{Math.round(settings.bearing)}°</output></label>
            <input id="angle" type="range" min="-180" max="180" step="1" value={settings.bearing} onChange={e=>{const bearing=Number(e.target.value);patch({bearing});mapRef.current?.rotateTo(bearing,{duration:0});}}/>
            <label htmlFor="zoom">Přiblížení <output>{settings.zoom.toFixed(1)}</output></label>
            <input id="zoom" type="range" min="4" max="19" step=".1" value={settings.zoom} onChange={e=>{const z=Number(e.target.value);patch({zoom:z});mapRef.current?.zoomTo(z,{duration:0});}}/>
            <div className="notice">Výřez nastavíš tažením přímo uvnitř mapové části plakátu.</div>
          </div>}
          {step===2&&<div className="fields">
            {([['rail','Zvýraznit železnici a tramvaje'],['roads','Silnice a ulice'],['buildings','Budovy'],['labels','Mapové popisky']] as const).map(([key,label])=><label className="switch-row" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(propsOf(key))} onChange={e=>patch({[key]:e.target.checked})}/></label>)}
            <div className="notice">Podrobnost kolejí závisí na obsahu mapových dlaždic. Detailní kolejiště nemusí být úplná.</div>
          </div>}
          {step===3&&<div className="fields">
            <label htmlFor="theme">Barevné schéma</label>
            <select id="theme" value={settings.theme} onChange={e=>patch({theme:e.target.value as Settings['theme']})}><option value="dark">Anlex Dark</option><option value="light">Minimal Light</option></select>
            <label>Barva zvýraznění</label>
            <div className="swatches">{['#ff3600','#d631a9','#005682','#00aead','#eab547'].map(color=><button type="button" key={color} aria-label={'Barva '+color} aria-pressed={settings.accent===color} className={settings.accent===color?'chosen':''} style={{background:color}} onClick={()=>patch({accent:color})}/>)}</div>
            <input type="color" aria-label="Vlastní barva" value={getPresetColor(settings.accent)?settings.accent:settings.accent} onChange={e=>patch({accent:e.target.value})}/>
            <label htmlFor="poster-title">Název plakátu</label><input id="poster-title" maxLength={75} value={settings.title} onChange={e=>patch({title:e.target.value})}/>
            <label htmlFor="poster-subtitle">Podtitulek</label><input id="poster-subtitle" maxLength={50} value={settings.subtitle} onChange={e=>patch({subtitle:e.target.value})}/>
          </div>}
          {step===4&&<div className="fields">
            <div className="summary"><div><span>LOKALITA</span><strong>{coordinates(settings)}</strong></div><div><span>FORMÁT</span><strong>{settings.ratio}</strong></div><div><span>VZHLED</span><strong>{settings.theme==='dark'?'Anlex Dark':'Minimal Light'}</strong></div></div>
            <button className="primary export-action" disabled={!mapReady||exporting} onClick={exportPng}>{exporting?'Připravuji PNG…':'Stáhnout PNG'}</button>
            <div className="notice">PNG obsahuje aktuálně vykreslenou mapu a texty. Rozlišení mapových detailů je omezeno velikostí WebGL náhledu. Plně vektorové SVG a PDF nejsou zatím implementované.</div>
          </div>}
        </section>
        <div className="step-footer"><button className="secondary" disabled={step===0} onClick={()=>setStep(p=>Math.max(0,p-1))}>← Zpět</button><button className="primary" onClick={()=>step===4?setStep(0):setStep(p=>Math.min(4,p+1))}>{step===4?'Upravit znovu':'Pokračovat →'}</button></div>
      </aside>
      <section className="workbench">
        <div className="workbench-head"><div><span className="eyebrow">ŽIVÝ NÁHLED</span><h2>Tvůj mapový plakát</h2></div><div className="coordinates">{coordinates(settings)}</div></div>
        <div className="preview-stage">
          <div className="poster-wrap" style={{aspectRatio:settings.ratio.replace(':',' / ')}}>
            <div className={'poster '+settings.theme}>
              <div className="map-area"><div className="map-canvas" ref={canvasHost}/>{!mapReady&&<div className="map-loading">{mapStatus}</div>}</div>
              <div className="poster-footer"><div className="rule"/><div className="poster-title">{settings.title||'MAP POSTER'}</div><div className="poster-meta">{settings.subtitle||'ČESKO'} · {coordinates(settings)}</div><div className="poster-credit">© OpenStreetMap contributors · ODbL</div></div>
            </div>
          </div>
          <div className="map-tools"><button onClick={()=>zoom(1)} aria-label="Přiblížit">+</button><button onClick={()=>zoom(-1)} aria-label="Oddálit">−</button><button onClick={()=>mapRef.current?.resetNorth({duration:400})} aria-label="Sever nahoru">N</button></div>
        </div>
        <div className="map-status"><span className={'signal '+(mapReady?'on':'')}/><span>{mapStatus}</span><span>Mapová data: OpenFreeMap / OpenStreetMap</span></div>
      </section>
    </main>
  </div>;
}
