import {readFile} from 'node:fs/promises';
import {getCurrentWeather} from '../scripts/openweather-service.mjs';
import {getForecast} from '../scripts/forecast-service.mjs';
let sites;
export function createHandler(kind){return async function(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'Método no permitido'});}
try{sites??=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url),'utf8')).sites;const url=new URL(req.url,'https://gaiatrack.local');const site=sites.find(s=>s.id===url.searchParams.get('site'));if(!site)return send(400,{error:'Cantón inválido'});const result=kind==='current'?await getCurrentWeather(site):await getForecast(site,url.searchParams.get('refresh')==='1');return send(200,result);}catch(e){return send(503,{error:kind==='current'?e.message:'El pronóstico no está disponible en este momento. Reintentá la consulta.'});}};}
