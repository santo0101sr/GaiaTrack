import {readFile,access} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
for(const file of ['public/index.html','public/app.js','public/immersive.js','public/vendor/three.module.js','api/current.mjs','api/forecast.mjs'])await access(new URL(file,root));
const manifest=JSON.parse(await readFile(new URL('public/data/manifest.json',root),'utf8'));
for(const site of manifest.sites){const source=JSON.parse(await readFile(new URL(`public/data/${site.id}.json`,root),'utf8'));if(!source.monthly?.length)throw Error(`Missing data: ${site.id}`);}
console.log(`GaiaTrack listo: archivos estáticos y ${manifest.sites.length} cantones verificados.`);
