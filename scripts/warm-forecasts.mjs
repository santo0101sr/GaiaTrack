import {readFile} from 'node:fs/promises';
import {getForecast} from './forecast-service.mjs';
// Precarga el pronóstico de respaldo (public/data/forecast) para cada provincia y cantón del manifiesto.
const manifest=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url),'utf8'));
const only=process.argv.includes('--missing');let ok=0,failed=[];
for(const site of manifest.sites){if(only){try{await readFile(new URL(`../public/data/forecast/${site.id}.json`,import.meta.url));continue;}catch{}}
try{const r=await getForecast(site);if(!r.rawEnsemble)throw Error('sin conjunto GFS');ok++;console.log(`Forecast ${site.id}: ${r.days[0].date} → ${r.days.at(-1).date}`);}catch(e){failed.push(site.id);console.error(`Forecast ${site.id} failed: ${e.message}`);}
await new Promise(r=>setTimeout(r,350));}
console.log(`Forecasts ready: ${ok}, failed: ${failed.length}${failed.length?' ('+failed.join(', ')+')':''}`);if(failed.length)process.exitCode=1;
