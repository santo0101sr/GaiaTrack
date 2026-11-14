import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {aggregateHistory,parameters as params} from './history-science.mjs';
const refresh=process.argv.includes('--refresh');
async function save(url,value){const temporary=new URL(url.href+'.tmp');await writeFile(temporary,JSON.stringify(value,null,url.pathname.endsWith('manifest.json')?2:0));await rename(temporary,url);}
const dir=new URL('../public/data/',import.meta.url);await mkdir(dir,{recursive:true});
const names=['Heredia','Barva','Santo Domingo','Santa Bárbara','San Rafael','San Isidro','Belén','Flores','San Pablo','Sarapiquí'];
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function json(url){let last;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`${r.status}: ${(await r.text()).slice(0,250)}`);return await r.json();}catch(e){last=e;}}throw last;}
let previous;try{previous=JSON.parse(await readFile(new URL('manifest.json',dir),'utf8'));}catch{}
let meta=previous?.boundary,boundaries;
try{if(!meta)throw Error('Missing boundary metadata');boundaries=JSON.parse(await readFile(new URL('heredia.geojson',dir),'utf8'));}catch{meta=await json('https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/');boundaries=await json(meta.simplifiedGeometryGeoJSON);}
const selected=names.map(name=>{const feature=boundaries.features.find(f=>norm(f.properties.shapeName)===norm(name));if(!feature)throw Error(`Missing ${name}`);return {...feature,properties:{...feature.properties,name,id:norm(name).replaceAll(' ','-')}};});
function rings(g){return g.type==='Polygon'?g.coordinates:g.coordinates.flat();}
function insideRing(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function inside(p,g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(poly=>insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r)));}
function reference(g){const coords=rings(g).flat();const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];const mid=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];if(inside(mid,g))return mid;let best,score=Infinity;for(let i=1;i<30;i++)for(let j=1;j<30;j++){const p=[bounds[0]+i/30*(bounds[2]-bounds[0]),bounds[1]+j/30*(bounds[3]-bounds[1])];const d=(p[0]-mid[0])**2+(p[1]-mid[1])**2;if(d<score&&inside(p,g)){best=p;score=d;}}if(!best)throw Error('No interior point');return best;}
await save(new URL('heredia.geojson',dir),{type:'FeatureCollection',features:selected});
const manifest={retrievedAt:previous?.retrievedAt??null,generatedAt:new Date().toISOString(),start:2001,end:2025,source:'NASA POWER Daily API',boundary:{...meta},sites:[]};
let index=0;
async function worker(){while(index<selected.length){const f=selected[index++];const [lon,lat]=reference(f.geometry);const id=f.properties.id;const target=new URL(`${id}.json`,dir);let raw;const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params.join(',')}&community=AG&longitude=${lon.toFixed(5)}&latitude=${lat.toFixed(5)}&start=20010101&end=20251231&format=JSON`;
let sourceRetrievedAt=null,downloaded=false;
try{if(refresh)throw Error('Refresh requested');raw=JSON.parse(await readFile(new URL(`raw-${id}.json`,dir),'utf8'));console.log(`Cache ${id}`);}catch{console.log(`Downloading ${id}`);raw=await json(url);downloaded=true;sourceRetrievedAt=new Date().toISOString();}
if(!sourceRetrievedAt){try{sourceRetrievedAt=JSON.parse(await readFile(target,'utf8')).sourceRetrievedAt??null;}catch{}}
const monthly=aggregateHistory(raw,manifest.start,manifest.end);
if(downloaded)await save(new URL(`raw-${id}.json`,dir),raw);
const site={id,sourceRetrievedAt,processedAt:new Date().toISOString(),name:f.properties.name,longitude:lon,latitude:lat,url,header:raw.header,parameters:raw.parameters,monthly};
await save(target,site);manifest.sites.push({id,name:site.name,longitude:lon,latitude:lat,sourceRetrievedAt});console.log(`Saved ${id}: ${monthly.length} months`);
}}
await Promise.all([worker(),worker(),worker()]);manifest.sites.sort((a,b)=>names.indexOf(a.name)-names.indexOf(b.name));if(manifest.sites.every(s=>s.sourceRetrievedAt))manifest.retrievedAt=manifest.sites.map(s=>s.sourceRetrievedAt).sort()[0];await save(new URL('manifest.json',dir),manifest);console.log('Data ready');
