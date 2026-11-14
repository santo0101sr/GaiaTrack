import test from 'node:test';
import assert from 'node:assert/strict';
import current from '../api/current.mjs';
import forecast from '../api/forecast.mjs';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=JSON.parse(body);}};}
for(const [name,handler] of [['current',current],['forecast',forecast]]){
test(`Vercel ${name} validates method before calling provider`,async()=>{const res=response();await handler({method:'POST',url:`/api/${name}?site=heredia`},res);assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'GET');});
test(`Vercel ${name} rejects unknown sites and disables public cache`,async()=>{const res=response();await handler({method:'GET',url:`/api/${name}?site=invalid`},res);assert.equal(res.statusCode,400);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.error,'Cantón inválido');});}
