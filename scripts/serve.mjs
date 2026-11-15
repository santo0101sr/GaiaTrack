import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {getForecast} from './forecast-service.mjs';
import {cacheHeaders,publicResult} from '../server/cache-policy.mjs';
import {getCurrentWeather,getAllCurrentWeather} from './current-service.mjs';
import {createChatHandler} from '../server/gaia-chat.mjs';
const chatHandler=createChatHandler();
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.mp4':'video/mp4'};
function serveMedia(req,res,body,mime){
  const total=body.length;
  const range=req.headers.range;
  if(!range){res.writeHead(200,{'Content-Type':mime,'Accept-Ranges':'bytes','Content-Length':total,'Cache-Control':'no-cache'});return res.end(body);}
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  const start=m&&m[1]?Number(m[1]):0;
  const end=m&&m[2]?Math.min(total-1,Number(m[2])):total-1;
  if(!m||Number.isNaN(start)||Number.isNaN(end)||start<0||start>=total||start>end){res.writeHead(416,{'Content-Range':`bytes */${total}`});return res.end();}
  res.writeHead(206,{'Content-Type':mime,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${total}`,'Content-Length':end-start+1,'Cache-Control':'no-cache'});
  return res.end(body.subarray(start,end+1));
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);if(pathname==='/api/chat')return await chatHandler(req,res);if(pathname==='/api/forecast'||pathname==='/api/current'){try{const manifest=JSON.parse(await readFile(path.join(root,'data','manifest.json'),'utf8'));const siteParam=url.searchParams.get('site');if(pathname==='/api/current'&&siteParam==='all'){const all=await getAllCurrentWeather(manifest.sites);res.writeHead(200,{'Content-Type':'application/json',...cacheHeaders('current',all)});return res.end(JSON.stringify(all));}const site=manifest.sites.find(s=>s.id===siteParam);if(!site){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Cantón inválido'}));}const forecast=pathname==='/api/current'?await getCurrentWeather(site):await getForecast(site);res.writeHead(200,{'Content-Type':'application/json',...cacheHeaders(pathname==='/api/current'?'current':'forecast',forecast)});return res.end(JSON.stringify(publicResult(pathname==='/api/current'?'current':'forecast',forecast)));}catch(e){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:pathname==='/api/current'?e.message:'El pronóstico no está disponible en este momento. Reintentá la consulta.'}));}}const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const ext=path.extname(file).toLowerCase();const mime=types[ext]||'application/octet-stream';const body=await readFile(file);if(ext==='.mp4')return serveMedia(req,res,body,mime);res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(404);res.end('No encontrado');}});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('GaiaTrack: http://127.0.0.1:4173'));
