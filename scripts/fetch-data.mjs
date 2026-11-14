import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir=new URL('../public/data/',import.meta.url);await mkdir(dir,{recursive:true});
const names=['Heredia','Barva','Santo Domingo','Santa Bárbara','San Rafael','San Isidro','Belén','Flores','San Pablo','Sarapiquí'];
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function json(url){let last;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`${r.status}: ${(await r.text()).slice(0,250)}`);return await r.json();}catch(e){last=e;}}throw last;}
const meta=await json('https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/');
const boundaries=await json(meta.simplifiedGeometryGeoJSON);
const selected=names.map(name=>{const feature=boundaries.features.find(f=>norm(f.properties.shapeName)===norm(name));if(!feature)throw Error(`Missing ${name}`);return {...feature,properties:{...feature.properties,name,id:norm(name).replaceAll(' ','-')}};});
function rings(g){return g.type==='Polygon'?g.coordinates:g.coordinates.flat();}
function insideRing(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function inside(p,g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(poly=>insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r)));}
function reference(g){const coords=rings(g).flat();const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];const mid=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];if(inside(mid,g))return mid;let best,score=Infinity;for(let i=1;i<30;i++)for(let j=1;j<30;j++){const p=[bounds[0]+i/30*(bounds[2]-bounds[0]),bounds[1]+j/30*(bounds[3]-bounds[1])];const d=(p[0]-mid[0])**2+(p[1]-mid[1])**2;if(d<score&&inside(p,g)){best=p;score=d;}}if(!best)throw Error('No interior point');return best;}
await writeFile(new URL('heredia.geojson',dir),JSON.stringify({type:'FeatureCollection',features:selected}));
const params=['T2M','T2M_MIN','T2M_MAX','ALLSKY_SFC_SW_DWN','PRECTOTCORR','GWETTOP','RH2M'];
const manifest={retrievedAt:new Date().toISOString(),start:2001,end:2025,source:'NASA POWER Daily API',boundary:{...meta},sites:[]};
let index=0;
async function worker(){while(index<selected.length){const f=selected[index++];const [lon,lat]=reference(f.geometry);const id=f.properties.id;const target=new URL(`${id}.json`,dir);let raw;const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params.join(',')}&community=AG&longitude=${lon.toFixed(5)}&latitude=${lat.toFixed(5)}&start=20010101&end=20251231&format=JSON`;
try{raw=JSON.parse(await readFile(new URL(`raw-${id}.json`,dir),'utf8'));console.log(`Cache ${id}`);}catch{console.log(`Downloading ${id}`);raw=await json(url);await writeFile(new URL(`raw-${id}.json`,dir),JSON.stringify(raw));}
if(!raw.properties?.parameter)throw Error(`Invalid source ${id}`);
const groups=new Map();for(const date of Object.keys(raw.properties.parameter.T2M)){const key=date.slice(0,6);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(date);}
const monthly=[...groups].map(([key,dates])=>{const row={year:+key.slice(0,4),month:+key.slice(4,6),days:dates.length};for(const p of params){const values=dates.map(d=>raw.properties.parameter[p][d]).filter(v=>Number.isFinite(v)&&v!==raw.header.fill_value);row[p]=values.length>=dates.length*.9?values.reduce((a,b)=>a+b,0)/values.length:null;row[p+'_n']=values.length;}return row;});
const site={id,name:f.properties.name,longitude:lon,latitude:lat,url,header:raw.header,parameters:raw.parameters,monthly};
await writeFile(target,JSON.stringify(site));manifest.sites.push({id,name:site.name,longitude:lon,latitude:lat});console.log(`Saved ${id}: ${monthly.length} months`);
}}
await Promise.all([worker(),worker(),worker()]);manifest.sites.sort((a,b)=>names.indexOf(a.name)-names.indexOf(b.name));await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));console.log('Data ready');
