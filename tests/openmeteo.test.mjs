import test from 'node:test';
import assert from 'node:assert/strict';
import {getCurrentWeather,getAllCurrentWeather} from '../scripts/current-service.mjs';
import {openMeteoUrl} from '../scripts/provider-cache.mjs';

test('Incomplete national response cannot reuse another territory weather', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ok:true,json:async()=>({current:{time:'2026-11-14T19:00',temperature_2m:22}})});
  try {
    await assert.rejects(getAllCurrentWeather([
      {id:'incomplete-a',name:'A',latitude:10,longitude:-84},
      {id:'incomplete-b',name:'B',latitude:9,longitude:-83}
    ]), /todos los territorios/);
  } finally {
    globalThis.fetch = original;
  }
});
test('Active current provider uses Open-Meteo without credentials and requests solar and soil fields',async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=async url=>{calls++;const u=new URL(url);assert.equal(u.hostname,'api.open-meteo.com');assert.ok(!u.searchParams.has('appid')&&!u.searchParams.has('apikey'));assert.ok(u.searchParams.get('current').includes('shortwave_radiation'));assert.ok(u.searchParams.get('current').includes('soil_moisture_0_to_1cm'));assert.ok(u.searchParams.get('current').includes('is_day'));return {ok:true,json:async()=>({current:{time:'2026-11-14T19:00',temperature_2m:22,interval:900,precipitation:.2,shortwave_radiation:600,is_day:1,soil_moisture_0_to_1cm:.4,surface_pressure:900}})};};try{const site={id:'unit-openmeteo',name:'Heredia',latitude:10,longitude:-84};const a=await getCurrentWeather(site),b=await getCurrentWeather(site);assert.equal(calls,1);assert.equal(a.provider,'open-meteo');assert.equal(a.pressureReference,'surface');assert.equal(a.precipitationDirection,'preceding');assert.equal(a.solarRadiation,600);assert.equal(a.isDay,true);assert.equal(b.soilMoisture,.4);assert.equal(a.observedAt,'2026-11-14T19:00:00.000Z');}finally{globalThis.fetch=original;}});
test('openMeteoUrl uses customer domain with apikey when configured and standard domain otherwise',()=>{const pub=new URL(openMeteoUrl('https://api.open-meteo.com/v1/forecast',{latitude:'10',longitude:'-84'},''));assert.equal(pub.hostname,'api.open-meteo.com');assert.ok(!pub.searchParams.has('apikey'));const paid=new URL(openMeteoUrl('https://api.open-meteo.com/v1/forecast',{latitude:'10',longitude:'-84'},'secret-key'));assert.equal(paid.hostname,'customer-api.open-meteo.com');assert.equal(paid.searchParams.get('apikey'),'secret-key');const ens=new URL(openMeteoUrl('https://ensemble-api.open-meteo.com/v1/ensemble',{latitude:'10',longitude:'-84'},'secret-key'));assert.equal(ens.hostname,'customer-ensemble-api.open-meteo.com');assert.equal(ens.searchParams.get('apikey'),'secret-key');});
test('getAllCurrentWeather batches multiple sites in a single Open-Meteo call',async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('latitude'),'10.00000,9.93000');assert.equal(u.searchParams.get('longitude'),'-84.12000,-84.08000');const fields=u.searchParams.get('current')||'';assert.ok(fields.includes('apparent_temperature'));assert.ok(fields.includes('relative_humidity_2m'));return {ok:true,json:async()=>[{current:{time:'2026-11-14T19:00',temperature_2m:21,is_day:0,interval:900}},{current:{time:'2026-11-14T19:00',temperature_2m:24,is_day:1,interval:900}}]};};try{const batch=await getAllCurrentWeather([{id:'unit-heredia',name:'Heredia',latitude:10,longitude:-84.12},{id:'unit-sj',name:'San José',latitude:9.93,longitude:-84.08}]);assert.equal(calls,1);assert.equal(batch.sites.length,2);assert.equal(batch.sites[0].temperature,21);assert.equal(batch.sites[1].temperature,24);assert.equal(batch.sites[0].isDay,false);assert.equal(batch.sites[1].isDay,true);}finally{globalThis.fetch=original;}});
