import {mkdir,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {aggregateHistory,parameters as params} from './history-science.mjs';
import {annualSeries} from '../public/science.js';
// Resumen anual compacto: el mapa y la escena 3D lo usan sin descargar los 90 históricos mensuales.
const annualSummary=monthly=>Object.fromEntries(params.map(p=>[p,annualSeries(monthly,p).map(d=>Number.isFinite(d.value)?+d.value.toFixed(5):null)]));
// Genera el catálogo territorial completo: 7 provincias + 83 cantones (geoBoundaries ADM2) con historia NASA POWER.
const refresh=process.argv.includes('--refresh');
const dir=new URL('../public/data/',import.meta.url);await mkdir(dir,{recursive:true});
async function save(url,value){const temporary=new URL(url.href+'.tmp');await writeFile(temporary,JSON.stringify(value,null,url.pathname.endsWith('manifest.json')?2:0));await rename(temporary,url);}
async function json(url){let last;for(let i=0;i<4;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`${r.status}: ${(await r.text()).slice(0,250)}`);return await r.json();}catch(e){last=e;await new Promise(ok=>setTimeout(ok,2000*(i+1)));}}throw last;}
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const PROVINCES=[['san-jose','San José'],['alajuela','Alajuela'],['cartago','Cartago'],['heredia','Heredia'],['guanacaste','Guanacaste'],['puntarenas','Puntarenas'],['limon','Limón']];
// División cantonal oficial (83 cantones presentes en geoBoundaries CRI ADM2).
const CANTONS={
'san-jose':['San José','Escazú','Desamparados','Puriscal','Tarrazú','Aserrí','Mora','Goicoechea','Santa Ana','Alajuelita','Vázquez de Coronado','Acosta','Tibás','Moravia','Montes de Oca','Turrubares','Dota','Curridabat','Pérez Zeledón','León Cortés Castro'],
'alajuela':['Alajuela','San Ramón','Grecia','San Mateo','Atenas','Naranjo','Palmares','Poás','Orotina','San Carlos','Zarcero','Sarchí','Upala','Los Chiles','Guatuso','Río Cuarto'],
'cartago':['Cartago','Paraíso','La Unión','Jiménez','Turrialba','Alvarado','Oreamuno','El Guarco'],
'heredia':['Heredia','Barva','Santo Domingo','Santa Bárbara','San Rafael','San Isidro','Belén','Flores','San Pablo','Sarapiquí'],
'guanacaste':['Liberia','Nicoya','Santa Cruz','Bagaces','Carrillo','Cañas','Abangares','Tilarán','Nandayure','La Cruz','Hojancha'],
'puntarenas':['Puntarenas','Esparza','Buenos Aires','Montes de Oro','Osa','Quepos','Golfito','Coto Brus','Parrita','Corredores','Garabito','Puerto Jiménez'],
'limon':['Limón','Pococí','Siquirres','Talamanca','Matina','Guácimo']};
const ALIASES={palmares:'palmeras'}; // nombre con error tipográfico en la fuente
const provinceIds=new Set(PROVINCES.map(p=>p[0]));
function cantonId(name){const id=slug(name);return provinceIds.has(id)?`${id}-centro`:id;}
let previous;try{previous=JSON.parse(await readFile(new URL('manifest.json',dir),'utf8'));}catch{}
const meta=previous?.boundary??await json('https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/');
let source;try{if(refresh)throw 0;source=JSON.parse(await readFile(new URL('../.cache/cri-adm2.geojson',import.meta.url),'utf8'));}catch{console.log('Downloading boundaries');source=await json(meta.simplifiedGeometryGeoJSON);await mkdir(new URL('../.cache/',import.meta.url),{recursive:true});await writeFile(new URL('../.cache/cri-adm2.geojson',import.meta.url),JSON.stringify(source));}
function rings(g){return g.type==='Polygon'?g.coordinates:g.coordinates.flat();}
function insideRing(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function inside(p,g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(poly=>insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r)));}
function reference(g){const coords=rings(g).flat();const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];const mid=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];if(inside(mid,g))return mid;let best,score=Infinity;for(let i=1;i<30;i++)for(let j=1;j<30;j++){const p=[bounds[0]+i/30*(bounds[2]-bounds[0]),bounds[1]+j/30*(bounds[3]-bounds[1])];const d=(p[0]-mid[0])**2+(p[1]-mid[1])**2;if(d<score&&inside(p,g)){best=p;score=d;}}if(!best)throw Error('No interior point');return best;}
// Douglas-Peucker para aligerar la geometría que se dibuja en 3D y Leaflet.
function simplifyRing(ring,tol){if(ring.length<=8)return ring;const keep=new Uint8Array(ring.length);keep[0]=keep[ring.length-1]=1;const stack=[[0,ring.length-1]];while(stack.length){const [a,b]=stack.pop();let max=0,idx=-1;const [x1,y1]=ring[a],[x2,y2]=ring[b],dx=x2-x1,dy=y2-y1,len=dx*dx+dy*dy;for(let i=a+1;i<b;i++){const [x,y]=ring[i];let t=len?((x-x1)*dx+(y-y1)*dy)/len:0;t=Math.max(0,Math.min(1,t));const d=(x-x1-t*dx)**2+(y-y1-t*dy)**2;if(d>max){max=d;idx=i;}}if(max>tol*tol){keep[idx]=1;stack.push([a,idx],[idx,b]);}}const out=ring.filter((_,i)=>keep[i]).map(([x,y])=>[+x.toFixed(4),+y.toFixed(4)]);return out.length>=4?out:null;}
function simplify(g,tol=.0012){const polys=(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(poly=>poly.map(r=>simplifyRing(r,tol)).filter(Boolean)).filter(poly=>poly.length);return polys.length===1?{type:'Polygon',coordinates:polys[0]}:{type:'MultiPolygon',coordinates:polys};}
// Clasificación ecológica curada por región natural (la celda NASA de 0,5° no resuelve el relieve).
const KIND_GROUPS={mountain:['tarrazu','dota','leon-cortes-castro','aserri','acosta','puriscal','poas','zarcero','cartago-centro','paraiso','alvarado','oreamuno','el-guarco','coto-brus','tilaran','barva','san-rafael','santa-barbara','san-isidro','cartago'],
'rural-wet':['perez-zeledon','san-carlos','upala','los-chiles','guatuso','rio-cuarto','jimenez','turrialba','parrita','quepos','osa','golfito','puerto-jimenez','corredores','buenos-aires','limon-centro','pococi','siquirres','talamanca','matina','guacimo','sarapiqui','limon'],
'dry-coast':['turrubares','orotina','san-mateo','liberia','nicoya','santa-cruz','bagaces','carrillo','canas','abangares','nandayure','la-cruz','hojancha','puntarenas-centro','esparza','montes-de-oro','garabito','guanacaste','puntarenas']};
const KIND=new Map(Object.entries(KIND_GROUPS).flatMap(([kind,ids])=>ids.map(id=>[id,kind])));
function climateProfile(monthly,id){const t=monthly.map(r=>r.T2M).filter(Number.isFinite),p=monthly.map(r=>r.PRECTOTCORR).filter(Number.isFinite);const temp=t.reduce((a,b)=>a+b,0)/t.length,rain=p.reduce((a,b)=>a+b,0)/p.length*365.25;return {kind:KIND.get(id)??'urban-valley',meanTempC:+temp.toFixed(1),annualPrecipMm:Math.round(rain)};}
const previousSites=new Map((previous?.sites??[]).map(s=>[s.id,s]));
const features=[];
for(const [province] of PROVINCES)for(const name of CANTONS[province]){const key=ALIASES[norm(name)]??norm(name);const feature=source.features.find(f=>norm(f.properties.shapeName)===key);if(!feature)throw Error(`Missing canton ${name}`);features.push({name,province,id:cantonId(name),feature});}
if(features.length!==source.features.length)throw Error(`Expected ${source.features.length} cantons, mapped ${features.length}`);
const manifest={retrievedAt:previous?.retrievedAt??null,generatedAt:new Date().toISOString(),start:2001,end:2025,source:'NASA POWER Daily API',boundary:{...meta},provinces:PROVINCES.map(([id,name])=>({id,name,siteId:id})),sites:[]};
async function history(site){const target=new URL(`${site.id}.json`,dir);const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params.join(',')}&community=AG&longitude=${site.longitude.toFixed(5)}&latitude=${site.latitude.toFixed(5)}&start=20010101&end=20251231&format=JSON`;let raw,downloaded=false,sourceRetrievedAt=site.sourceRetrievedAt??null;
try{if(refresh)throw Error('Refresh requested');raw=JSON.parse(await readFile(new URL(`raw-${site.id}.json`,dir),'utf8'));}catch{console.log(`Downloading ${site.id}`);raw=await json(url);downloaded=true;sourceRetrievedAt=new Date().toISOString();}
if(!downloaded){try{const old=JSON.parse(await readFile(target,'utf8'));sourceRetrievedAt=old.sourceRetrievedAt??sourceRetrievedAt;if(old.url)site.url=old.url;}catch{}}
const monthly=aggregateHistory(raw,manifest.start,manifest.end);if(downloaded)await save(new URL(`raw-${site.id}.json`,dir),raw);
await save(target,{id:site.id,sourceRetrievedAt,processedAt:new Date().toISOString(),name:site.name,type:site.type,province:site.province,longitude:site.longitude,latitude:site.latitude,url:site.url??url,header:raw.header,parameters:raw.parameters,monthly});
return {sourceRetrievedAt,profile:climateProfile(monthly,site.id),annual:annualSummary(monthly)};}
const jobs=[];
for(const [id,name] of PROVINCES){const old=previousSites.get(id);if(!old)throw Error(`Missing province site ${id}`);jobs.push({id,name,type:'province',province:id,longitude:old.longitude,latitude:old.latitude,sourceRetrievedAt:old.sourceRetrievedAt});}
const geo={type:'FeatureCollection',features:[]};
for(const c of features){const old=previousSites.get(c.id);const [lon,lat]=old&&old.type!=='province'?[old.longitude,old.latitude]:reference(c.feature.geometry);jobs.push({id:c.id,name:c.name,type:'canton',province:c.province,longitude:lon,latitude:lat,sourceRetrievedAt:old?.sourceRetrievedAt??null});geo.features.push({type:'Feature',properties:{id:c.id,name:c.name,province:c.province,shapeID:c.feature.properties.shapeID},geometry:simplify(c.feature.geometry)});}
const results=new Map();let index=0;
async function worker(){while(index<jobs.length){const job=jobs[index++];const r=await history(job);results.set(job.id,r);console.log(`Saved ${job.id} (${r.profile.kind})`);}}
await Promise.all([worker(),worker(),worker()]);
manifest.sites=jobs.map(j=>({id:j.id,name:j.name,type:j.type,province:j.province,longitude:j.longitude,latitude:j.latitude,sourceRetrievedAt:results.get(j.id).sourceRetrievedAt,climate:results.get(j.id).profile}));
await save(new URL('annual.json',dir),{start:manifest.start,end:manifest.end,parameters:params,sites:Object.fromEntries(jobs.map(j=>[j.id,results.get(j.id).annual]))});
if(manifest.sites.every(s=>s.sourceRetrievedAt))manifest.retrievedAt=manifest.sites.map(s=>s.sourceRetrievedAt).sort()[0];
await save(new URL('cantons.geojson',dir),geo);await rm(new URL('heredia.geojson',dir),{force:true});
await save(new URL('manifest.json',dir),manifest);console.log(`Data ready: ${manifest.sites.length} sites, ${geo.features.length} cantons`);
