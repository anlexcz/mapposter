const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const code=fs.readFileSync("src/app.js","utf8").split('\n$("searchForm")')[0];
function setup(fetch){
  const defaults={radius:"1.4",format:"2:3",scheme:"dark",rotation:"0",titleText:"VOZOVNA KOBYLISY",subtitle:"ČESKO"};
  const elements={};
  for(const name of ["radius","format","scheme","rotation","titleText","subtitle","rail","tram","roads","buildings","poster","radiusValue","rotationValue","status","diagnostics","load","svgExport","pngExport"]){
    elements[name]={value:defaults[name]||"",checked:true,disabled:false,innerHTML:"",textContent:""};
  }
  const sandbox={document:{getElementById:name=>elements[name]},fetch,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,performance,console};
  vm.createContext(sandbox);
  const app=vm.runInContext(code+"\n({loadMap,svgMarkup,state,bbox})",sandbox);
  return {app,elements};
}
function sample(){
  return {elements:[
    {type:"way",tags:{railway:"tram"},geometry:[{lat:50.132,lon:14.449},{lat:50.133,lon:14.451}]},
    {type:"way",tags:{highway:"residential"},geometry:[{lat:50.131,lon:14.449},{lat:50.133,lon:14.450}]}
  ]};
}
test("loads actual geometry, enables export and reuses cache",async()=>{
  let calls=0;
  const {app,elements}=setup(async()=>{calls++;return {ok:true,json:async()=>sample()};});
  await app.loadMap();
  assert.equal(calls,1);
  assert.equal(app.state.ways.length,2);
  assert.match(app.svgMarkup(),/stroke="#ff3600"/);
  assert.equal(elements.svgExport.disabled,false);
  await app.loadMap();
  assert.equal(calls,1);
  assert.match(elements.status.textContent,/cache/);
});
test("tries another source when first source fails",async()=>{
  let calls=0;
  const {app,elements}=setup(async()=>{
    calls++;if(calls===1)throw Error("blocked");
    return {ok:true,json:async()=>sample()};
  });
  await app.loadMap();
  assert.equal(calls,2);
  assert.match(elements.diagnostics.textContent,/overpass-api.de/);
});
test("never silently exports an empty map when all servers fail",async()=>{
  let calls=0;
  const {app,elements}=setup(async()=>{calls++;throw Error("offline");});
  await app.loadMap();
  assert.equal(calls,3);
  assert.equal(elements.svgExport.disabled,true);
  assert.match(elements.status.textContent,/nelze načíst/);
  assert.match(elements.diagnostics.textContent,/offline/);
});
