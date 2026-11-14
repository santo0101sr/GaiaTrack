import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {aggregateHistory,parameters} from '../scripts/history-science.mjs';
import {annualSeries,historyCoverage} from '../public/science.js';

test('Missing dates count against calendar coverage, including leap days',()=>{
  const source=Object.fromEntries(parameters.map(p=>[p,{}]));
  for(let day=1;day<=26;day++)source.T2M['202402'+String(day).padStart(2,'0')]=20;
  const raw={header:{fill_value:-999},properties:{parameter:source}};
  let rows=aggregateHistory(raw,2024,2024);
  assert.equal(rows.length,12);assert.equal(rows[1].days,29);
  assert.equal(rows[1].T2M,null);assert.equal(rows[1].T2M_n,26);
  source.T2M['20240227']=0;source.T2M['20240228']=-999;source.T2M['20240229']=null;
  rows=aggregateHistory(raw,2024,2024);
  assert.equal(rows[1].T2M_n,27);assert.equal(rows[1].T2M,520/27);
  assert.equal(rows[0].T2M,null);assert.equal(rows[0].T2M_n,0);
});

test('Twelve duplicate or truncated months cannot create a valid annual metric',()=>{
  const rows=Array.from({length:12},(_,i)=>({year:2024,month:i+1,days:new Date(Date.UTC(2024,i+1,0)).getUTCDate(),T2M:20}));
  assert.equal(annualSeries(rows,'T2M')[0].value,20);
  assert.equal(annualSeries([...rows.slice(0,11),rows[0]],'T2M')[0].value,null);
  assert.equal(annualSeries(rows.map(r=>({...r,days:20})),'T2M')[0].value,null);
});

test('Coverage exposes missing days and estimated precipitation',()=>{
  const rows=Array.from({length:12},(_,i)=>{const days=new Date(Date.UTC(2024,i+1,0)).getUTCDate();return {year:2024,month:i+1,days,PRECTOTCORR:2,PRECTOTCORR_n:days-(i===0?1:0)};});
  const q=historyCoverage(rows,'PRECTOTCORR',2024);
  assert.equal(q.validDays,365);assert.equal(q.expectedDays,366);
  assert.equal(q.validMonths,12);assert.equal(q.estimated,true);
});

test('All historical monthly metrics reproduce the saved original daily NASA response',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url)));
  for(const site of manifest.sites){
    const raw=JSON.parse(await readFile(new URL(`../public/data/raw-${site.id}.json`,import.meta.url)));
    const saved=JSON.parse(await readFile(new URL(`../public/data/${site.id}.json`,import.meta.url)));
    assert.deepEqual(saved.monthly,aggregateHistory(raw,manifest.start,manifest.end),site.id);
  }
});
