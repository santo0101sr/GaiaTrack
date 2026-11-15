import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWeatherTerritories} from '../public/weather-territories.js';
const now=Date.parse('2026-11-15T15:00:00Z');
const territories=[{id:'heredia',type:'province',province:'heredia'},{id:'sarapiqui',type:'canton',province:'heredia'},{id:'barva',type:'canton',province:'heredia'},{id:'limon',type:'province',province:'limon'}];
const sample=(site,precipitation,extra={})=>({site,precipitation,intervalSeconds:900,observedAt:'2026-11-15T14:45:00Z',...extra});

test('A wet canton remains visible when its provincial reference is dry',()=>{
  const records={heredia:sample('heredia',0),sarapiqui:sample('sarapiqui',2),barva:sample('barva',0),limon:sample('limon',0)};
  const layers=selectWeatherTerritories(territories,id=>records[id],{now});
  assert.deepEqual(layers.map(item=>item.territory.id),['sarapiqui','barva','limon']);
  assert.equal(layers[0].normalized.precipitation,8);
  assert.equal(layers[1].normalized.precipitation,0);
});
test('A provincial estimate cannot paint over a dry canton or fill missing cantons as measured coverage',()=>{
  const records={heredia:sample('heredia',4),barva:sample('barva',0)};
  assert.deepEqual(selectWeatherTerritories(territories,id=>records[id],{now}).map(item=>item.territory.id),['barva']);
});
test('Province filtering and stale or mismatched samples cannot leak rain across places',()=>{
  const records={heredia:sample('heredia',0),sarapiqui:sample('sarapiqui',2,{observedAt:'2026-11-15T12:00:00Z'}),barva:sample('limon',3),limon:sample('limon',5)};
  const layers=selectWeatherTerritories(territories,id=>records[id],{province:'heredia',now});
  assert.deepEqual(layers.map(item=>item.territory.id),['heredia']);
  assert.equal(layers[0].normalized.precipitation,0);
});
