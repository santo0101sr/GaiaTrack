import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTimeline,weatherScales,weatherForScene,isThunderstorm} from '../public/weather-state.js';

test('Each territory uses its own fresh current data and precipitation interval',()=>{
  const now=Date.parse('2026-11-14T21:35:00Z');
  const raw={site:'heredia',observedAt:'2026-11-14T21:30:00Z',precipitation:.1,intervalSeconds:900,weatherCode:51};
  const scene=weatherForScene('current','heredia',raw,now);
  assert.equal(scene.precipitation,.4);
  assert.equal(raw.precipitation,.1);
  assert.equal(weatherForScene('current','limon',raw,now),null);
  assert.equal(weatherForScene('current','heredia',raw,now+3600000),null);
  assert.equal(weatherForScene('current','heredia',{...raw,observedAt:null},now),null);
  assert.equal(weatherForScene('current','heredia',{...raw,intervalSeconds:null},now).precipitation,null);
  assert.equal(weatherForScene('forecast','heredia',{precipitation:.1},now).precipitation,.1);
});

test('Overcast and fog do not rain; drizzle stays light and lightning requires a thunderstorm code',()=>{
  for(const weatherCode of [0,1,2,3,45,48,71,73,75,77,85,86]) {
    assert.equal(weatherScales({weatherCode,precipitation:2,clouds:100}).rain,0);
  }
  assert.equal(weatherScales({weatherCode:61,precipitation:0}).rain,0);
  assert.equal(weatherScales({weatherCode:61,precipitation:null}).rain,null);
  const drizzle=weatherScales({weatherCode:51,precipitation:.4});
  assert.ok(drizzle.rain>0&&drizzle.rain<.15);
  assert.ok(weatherScales({weatherCode:65,precipitation:10}).rain>drizzle.rain);
  assert.equal(isThunderstorm({weatherCode:65,precipitation:20}),false);
  assert.equal(isThunderstorm({weatherCode:95}),true);
});
test('Hourly timeline preserves local times, source values and missing fields',()=>{const raw={hourly:{time:['2026-11-14T23:00','2026-11-15T00:00','2026-11-15T12:00'],temperature_2m:[22,18,27],cloud_cover:[100,80,20],shortwave_radiation:[0,0,900],precipitation:[1,2,0],soil_moisture_0_to_1cm:[.4,.42,.35]}};const timeline=normalizeTimeline(raw,'2026-11-14');assert.equal(timeline.length,2);assert.equal(timeline[0].time,'2026-11-15T00:00');assert.equal(timeline[0].precipitation,2);assert.equal(timeline[0].humidity,null);assert.equal(timeline[1].solarRadiation,900);assert.deepEqual(normalizeTimeline({},'2026-11-14'),[]);});
test('Visual scales increase with source values and preserve unknown values',()=>{const low=weatherScales({solarRadiation:0,clouds:0,precipitation:0,soilMoisture:.1}),high=weatherScales({solarRadiation:1000,clouds:100,precipitation:20,soilMoisture:.45});assert.equal(low.sun,0);assert.equal(low.rain,0);assert.equal(high.sun,1);assert.ok(high.cloud>low.cloud&&high.rain>low.rain&&high.soil>low.soil);assert.deepEqual(weatherScales({}),{sun:null,cloud:null,rain:null,soil:null});});
