// Multi-horizon climate & weather prediction using live Open-Meteo data
// and 25-year NASA POWER climatology (no fabricated observations).

const MONTH_ES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function quantile(sorted,q){
  if(!sorted.length)return null;
  const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return sorted[lo];
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}

function median(vals){
  if(!vals.length)return null;
  const s=[...vals].sort((a,b)=>a-b);
  return quantile(s,0.5);
}

function clampPhysical(varKey,v){
  if(!Number.isFinite(v))return null;
  if(varKey==='PRECTOTCORR'||varKey==='ALLSKY_SFC_SW_DWN')return Math.max(0,v);
  if(varKey==='GWETTOP')return Math.max(0,Math.min(1,v));
  if(varKey==='RH2M')return Math.max(0,Math.min(100,v));
  return v;
}

const HOURLY_MAP={
  T2M:{field:'temperature',curField:'temperature',unit:'°C',d:1},
  T2M_MAX:{field:'temperature',curField:'temperature',unit:'°C',d:1},
  T2M_MIN:{field:'temperature',curField:'temperature',unit:'°C',d:1},
  PRECTOTCORR:{field:'precipitation',curField:'precipitation',unit:'mm/h',d:2},
  ALLSKY_SFC_SW_DWN:{field:'solarRadiation',curField:'solarRadiation',unit:'W/m²',d:0},
  GWETTOP:{field:'soilMoisture',curField:'soilMoisture',unit:'0–1',d:2},
  RH2M:{field:'humidity',curField:'humidity',unit:'%',d:0}
};

export function hourlyMeta(varKey){
  return HOURLY_MAP[varKey]||HOURLY_MAP.T2M;
}

/**
 * Extracts up to 48 hours of live + forecast hourly points from Open-Meteo timeline.
 */
export function buildHourlyPrediction(timeline,currentObs,varKey,nowMs=Date.now()){
  const meta=hourlyMeta(varKey);
  const cutoff=nowMs+48*3600*1000;
  const pts=[];

  const curVal=currentObs?.[meta.curField];
  const curMs=currentObs?.observedAt?Date.parse(currentObs.observedAt):nowMs;
  if(Number.isFinite(curVal)&&Number.isFinite(curMs)&&nowMs-curMs<=7200*1000){
    pts.push({timeMs:curMs,label:'Ahora',value:curVal,isNow:true,isDay:currentObs.isDay??true});
  }

  for(const row of (timeline||[])){
    const tMs=Date.parse(row.time);
    const val=row[meta.field];
    if(!Number.isFinite(tMs)||!Number.isFinite(val))continue;
    if(tMs<nowMs-1800*1000||tMs>cutoff)continue;
    if(pts.length&&tMs<=pts[pts.length-1].timeMs+1200*1000)continue;
    const hr=new Date(tMs).getHours();
    pts.push({timeMs:tMs,time:row.time,label:`${String(hr).padStart(2,'0')}h`,value:val,isNow:false,isDay:row.isDay});
  }

  const sliced=pts.slice(0,49);
  if(sliced.length<2)return {points:sliced,unit:meta.unit,digits:meta.d,min:null,max:null,mean:null,sum:null};
  const vals=sliced.map(p=>p.value);
  const min=sliced.reduce((a,b)=>b.value<a.value?b:a,sliced[0]);
  const max=sliced.reduce((a,b)=>b.value>a.value?b:a,sliced[0]);
  const sum=vals.reduce((a,b)=>a+b,0);
  return {points:sliced,unit:meta.unit,digits:meta.d,min,max,mean:sum/vals.length,sum};
}

/**
 * Extracts 7-day forecast points with uncertainty/range bands from Open-Meteo + GFS ensemble.
 */
export function buildDailyPrediction(days,varKey){
  const pts=(days||[]).slice(0,7).map(d=>{
    const val=d[varKey];
    if(!Number.isFinite(val))return null;
    let lo=null,hi=null;
    if(varKey==='T2M'&&d.ensemble){lo=d.ensemble.p10;hi=d.ensemble.p90;}
    else if((varKey==='T2M'||varKey==='T2M_MAX'||varKey==='T2M_MIN')&&Number.isFinite(d.T2M_MIN)&&Number.isFinite(d.T2M_MAX)){
      lo=d.T2M_MIN;hi=d.T2M_MAX;
    }
    return {date:d.date,label:d.date.slice(5),value:val,lo,hi,rainProb:d.rainProbability??null};
  }).filter(Boolean);

  if(!pts.length)return {points:[],mean:null,sum:null,max:null,min:null};
  const vals=pts.map(p=>p.value);
  return {
    points:pts,
    mean:vals.reduce((a,b)=>a+b,0)/vals.length,
    sum:vals.reduce((a,b)=>a+b,0),
    max:pts.reduce((a,b)=>b.value>a.value?b:a,pts[0]),
    min:pts.reduce((a,b)=>b.value<a.value?b:a,pts[0])
  };
}

/**
 * Predicts the next 12 months by combining:
 *   y_hat(h) = mu_{m(h)} + phi^h * A_0 + annualSlope * (h / 12)
 * where mu_m is the 2001-2025 NASA POWER calendar-month mean, A_0 is the live anomaly,
 * and phi is the empirical lag-1 anomaly autocorrelation.
 */
export function buildMonthlyPrediction(monthly,varKey,{currentObs=null,forecastDays=null,annualSlope=0,nowDate=new Date(),horizonMonths=12,lang='es'}={}){
  if(!Array.isArray(monthly)||!monthly.length)return {points:[],phi:0.45,liveAnomaly:0,currentMonthNormal:null};

  const byMonth=Array.from({length:12},()=>[]);
  for(const row of monthly){
    const m=row.month,v=row[varKey];
    if(m>=1&&m<=12&&Number.isFinite(v))byMonth[m-1].push(v);
  }
  const monthStats=byMonth.map(arr=>{
    if(!arr.length)return {mean:null,p10:null,p90:null};
    const s=[...arr].sort((a,b)=>a-b);
    return {
      mean:arr.reduce((a,b)=>a+b,0)/arr.length,
      p10:quantile(s,0.1),
      p90:quantile(s,0.9)
    };
  });

  // Empirical lag-1 deseasonalized anomaly autocorrelation phi
  const sorted=[...monthly].sort((a,b)=>(a.year-b.year)||(a.month-b.month));
  const anomalies=[];
  for(const row of sorted){
    const v=row[varKey],mu=monthStats[row.month-1]?.mean;
    if(Number.isFinite(v)&&Number.isFinite(mu))anomalies.push({ym:row.year*12+row.month,a:v-mu});
  }
  let sxy=0,sx2=0,sy2=0,pairs=0;
  for(let i=1;i<anomalies.length;i++){
    if(anomalies[i].ym!==anomalies[i-1].ym+1)continue;
    const x=anomalies[i-1].a,y=anomalies[i].a;
    sxy+=x*y;sx2+=x*x;sy2+=y*y;pairs++;
  }
  const rawPhi=(pairs>=24&&sx2>1e-9&&sy2>1e-9)?sxy/Math.sqrt(sx2*sy2):0.45;
  const phi=Math.max(0.15,Math.min(0.85,rawPhi));

  // Live anomaly A_0: prefer 7-day forecast mean (avoids diurnal bias) vs current month normal
  const curMonthIdx=nowDate.getMonth(); // 0..11
  const curNormal=monthStats[curMonthIdx]?.mean;
  let liveBaseline=null;
  const fcVals=(forecastDays||[]).map(d=>d[varKey]).filter(Number.isFinite);
  if(fcVals.length>=3){
    liveBaseline=fcVals.reduce((a,b)=>a+b,0)/fcVals.length;
  }else if(currentObs){
    const mapCur={T2M:'temperature',T2M_MAX:'temperature',T2M_MIN:'temperature',PRECTOTCORR:'precipitation',GWETTOP:'soilMoisture',RH2M:'humidity'};
    const cf=mapCur[varKey];
    if(cf&&Number.isFinite(currentObs[cf]))liveBaseline=currentObs[cf]*(varKey==='PRECTOTCORR'?24:1);
  }
  const liveAnomaly=(Number.isFinite(liveBaseline)&&Number.isFinite(curNormal))?liveBaseline-curNormal:0;
  const slope=Number.isFinite(annualSlope)?annualSlope:0;
  const labels=lang==='en'?MONTH_EN:MONTH_ES;

  const points=[];
  for(let h=1;h<=horizonMonths;h++){
    const d=new Date(nowDate.getFullYear(),nowDate.getMonth()+h,1);
    const mIdx=d.getMonth(),yr=d.getFullYear();
    const st=monthStats[mIdx];
    if(!Number.isFinite(st?.mean))continue;
    const rawPred=st.mean+Math.pow(phi,h)*liveAnomaly+slope*(h/12);
    points.push({
      h,
      month:mIdx+1,
      year:yr,
      label:`${labels[mIdx]} ${String(yr).slice(2)}`,
      shortLabel:labels[mIdx],
      normal:st.mean,
      predicted:clampPhysical(varKey,rawPred),
      p10:st.p10,
      p90:st.p90
    });
  }

  return {points,phi,liveAnomaly,currentMonthNormal:curNormal};
}

/**
 * Anchors Theil-Sen trend at its robust median intercept (not a single noisy endpoint year)
 * and computes historical interannual residual std dev (sigma) for realistic uncertainty bands.
 */
export function buildAnnualPrediction(pts,mk,targetYear){
  if(!pts||pts.length<3)return null;
  const slope=Number.isFinite(mk?.slope)?mk.slope:0;
  const loSlope=Number.isFinite(mk?.slopeCI?.lower)?mk.slopeCI.lower:slope;
  const hiSlope=Number.isFinite(mk?.slopeCI?.upper)?mk.slopeCI.upper:slope;
  const intercept=median(pts.map(p=>p.value-slope*p.year));
  const atYear=y=>intercept+slope*y;

  const residuals=pts.map(p=>p.value-atYear(p.year));
  const sigma=residuals.length>2?Math.sqrt(residuals.reduce((a,r)=>a+r*r,0)/(residuals.length-2)):0;

  const last=pts[pts.length-1];
  const anchorLast=atYear(last.year);
  const pred=atYear(targetYear);
  const loTrend=anchorLast+loSlope*(targetYear-last.year);
  const hiTrend=anchorLast+hiSlope*(targetYear-last.year);

  return {
    slope,
    intercept,
    sigma,
    lastYear:last.year,
    anchorLast,
    predicted:pred,
    trendBand:[Math.min(loTrend,hiTrend),Math.max(loTrend,hiTrend)],
    variabilityBand:[pred-sigma,pred+sigma],
    atYear
  };
}
