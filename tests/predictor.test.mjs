import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnnualPrediction,buildDailyPrediction,buildHourlyPrediction,buildMonthlyPrediction} from '../public/predictor.js';

test('buildHourlyPrediction anchors live observation and extracts up to 48h points',()=>{
  const now=Date.parse('2026-11-15T12:00:00Z');
  const currentObs={observedAt:'2026-11-15T12:00:00Z',temperature:24.5,isDay:true};
  const timeline=[
    {time:'2026-11-15T13:00:00Z',temperature:25.8,isDay:true},
    {time:'2026-11-15T16:00:00Z',temperature:27.2,isDay:true},
    {time:'2026-11-17T10:00:00Z',temperature:21.0,isDay:true},
    {time:'2026-11-18T00:00:00Z',temperature:19.0,isDay:false}
  ];
  const res=buildHourlyPrediction(timeline,currentObs,'T2M',now);
  assert.equal(res.points.length,4);
  assert.equal(res.points[0].isNow,true);
  assert.equal(res.points[0].value,24.5);
  assert.equal(res.max.value,27.2);
  assert.equal(res.min.value,21.0);
  assert.equal(res.unit,'°C');
});

test('buildDailyPrediction uses GFS ensemble P10-P90 band for T2M',()=>{
  const days=[
    {date:'2026-11-16',T2M:22.4,T2M_MIN:18.1,T2M_MAX:26.5,ensemble:{n:30,p10:21.2,p50:22.4,p90:23.6}},
    {date:'2026-11-17',T2M:23.0,T2M_MIN:18.5,T2M_MAX:27.0,ensemble:{n:30,p10:21.8,p50:23.0,p90:24.1}}
  ];
  const res=buildDailyPrediction(days,'T2M');
  assert.equal(res.points.length,2);
  assert.equal(res.points[0].lo,21.2);
  assert.equal(res.points[0].hi,23.6);
  assert.equal(res.max.date,'2026-11-17');
});

test('buildMonthlyPrediction preserves seasonal cycle, decays live anomaly, and clamps physical bounds',()=>{
  const monthly=[];
  for(let y=2001;y<=2025;y++){
    for(let m=1;m<=12;m++){
      const seasonal=m>=5&&m<=11?10.0:1.0;
      monthly.push({year:y,month:m,PRECTOTCORR:seasonal+(y%2===0?0.5:-0.5)});
    }
  }
  const nowDate=new Date(2026,10,15); // November (month 11)
  const forecastDays=[{PRECTOTCORR:14.0},{PRECTOTCORR:13.0},{PRECTOTCORR:12.0}];
  const res=buildMonthlyPrediction(monthly,'PRECTOTCORR',{forecastDays,annualSlope:0,nowDate,horizonMonths:12});
  assert.equal(res.points.length,12);
  assert.ok(res.liveAnomaly>2,'Expected positive live anomaly in wet November');
  // Next month (Dec, index 0) should be higher than dry-season Jan/Feb/Mar
  const dec=res.points[0];
  const feb=res.points[2];
  assert.ok(dec.predicted>feb.predicted,'Seasonal curve should drop in dry season');
  assert.ok(res.points.every(p=>p.predicted>=0),'Precipitation predictions must remain >= 0');
});

test('buildAnnualPrediction anchors Theil-Sen at median intercept and computes interannual sigma',()=>{
  const pts=Array.from({length:20},(_,i)=>({year:2001+i,value:20+0.05*i+(i%2===0?0.4:-0.4)}));
  const mk={slope:0.05,slopeCI:{lower:0.03,upper:0.07}};
  const res=buildAnnualPrediction(pts,mk,2035);
  assert.ok(res);
  assert.ok(res.sigma>0.2);
  assert.ok(res.variabilityBand[0]<res.predicted&&res.predicted<res.variabilityBand[1]);
  assert.ok(res.trendBand[0]<res.predicted&&res.predicted<res.trendBand[1]);
});
