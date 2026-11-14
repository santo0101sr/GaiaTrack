import test from 'node:test';
import assert from 'node:assert/strict';
import {metnoTimeline,normalizeMetnoCurrent,normalizeMetnoForecast,getMetnoData} from '../scripts/metno-service.mjs';

const site={id:'unit-test',name:'Prueba',latitude:10.128563,longitude:-84.039229};
// Synthetic fixture used only in unit tests, never served as environmental data.
function fixture(){const rows=[];for(let i=0;i<=8*24;i++){const time=new Date(Date.parse('2026-11-14T06:00:00Z')+i*3600000).toISOString();rows.push({time,data:{instant:{details:{air_temperature:20,relative_humidity:80,air_pressure_at_sea_level:1010,cloud_area_fraction:50,wind_speed:0}},next_1_hours:{details:{precipitation_amount:1}}}});}return {geometry:{coordinates:[-84,10,1000]},properties:{meta:{updated_at:'2026-11-14T00:00:00Z'},timeseries:rows}};}

test('MET Norway preserves UTC/local time, forward rainfall, sea-level pressure and missing variables',()=>{
const raw=fixture(),current=normalizeMetnoCurrent(raw,site,new Date('2026-11-14T06:15:00Z'));
assert.equal(current.observedAt,'2026-11-14T07:00:00.000Z');assert.equal(current.time,'2026-11-14T01:00');assert.equal(current.precipitationDirection,'following');assert.equal(current.pressureReference,'sea-level');assert.equal(current.solarRadiation,null);assert.equal(current.soilMoisture,null);assert.equal(current.windSpeed,0);assert.throws(()=>metnoTimeline({}));
});

test('Daily rainfall does not double count overlapping intervals and omits incomplete totals',()=>{
const raw=fixture();for(const row of raw.properties.timeseries)row.data.next_6_hours={details:{precipitation_amount:6}};
const forecast=normalizeMetnoForecast(raw,site,new Date('2026-11-14T12:00:00Z'));
assert.equal(forecast.days.length,7);assert.equal(forecast.days[0].date,'2026-11-15');assert.equal(forecast.days[0].PRECTOTCORR,24);assert.equal(forecast.days[0].T2M,20);assert.equal(forecast.days[0].ensemble,null);
delete raw.properties.timeseries[25].data.next_1_hours;
assert.equal(normalizeMetnoForecast(raw,site,new Date('2026-11-14T12:00:00Z')).days[0].PRECTOTCORR,null);
});

test('Six-hourly data remain six-hourly; daily metrics require complete coverage',()=>{
const raw=fixture();raw.properties.timeseries=raw.properties.timeseries.filter((_,i)=>i%6===0);for(const row of raw.properties.timeseries){delete row.data.next_1_hours;row.data.next_6_hours={details:{precipitation_amount:6}};}
const f=normalizeMetnoForecast(raw,site,new Date('2026-11-14T12:00:00Z'));
assert.equal(f.days[0].sampleCount,4);assert.equal(f.days[0].PRECTOTCORR,24);assert.equal(f.timeline[0].intervalSeconds,21600);
raw.properties.timeseries.splice(5,1);assert.throws(()=>normalizeMetnoForecast(raw,site,new Date('2026-11-14T12:00:00Z')),/siete días/);
});

test('Live provider stays inactive without accepted terms and identification',async()=>{
const before=process.env.METNO_TERMS_ACCEPTED;delete process.env.METNO_TERMS_ACCEPTED;
try{await assert.rejects(getMetnoData(site),/pendiente de configuración/);}finally{if(before!==undefined)process.env.METNO_TERMS_ACCEPTED=before;}
});
