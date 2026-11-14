export const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function median(xs){if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;}
export function annualSeries(monthly,parameter){const groups=new Map();for(const row of monthly){if(!groups.has(row.year))groups.set(row.year,[]);groups.get(row.year).push(row);}return [...groups].sort((a,b)=>a[0]-b[0]).map(([year,rows])=>{const valid=rows.filter(r=>Number.isFinite(r[parameter])&&r.month>=1&&r.month<=12&&r.days===new Date(Date.UTC(year,r.month,0)).getUTCDate());if(rows.length!==12||valid.length!==12||new Set(valid.map(r=>r.month)).size!==12)return {year,value:null};const days=valid.reduce((a,r)=>a+r.days,0);const weighted=valid.reduce((a,r)=>a+r[parameter]*r.days,0);return {year,value:parameter==='PRECTOTCORR'?weighted:weighted/days};});}
export function historyCoverage(monthly,parameter,year){
const rows=monthly.filter(r=>r.year===year),expectedDays=new Date(Date.UTC(year+1,0,1))-new Date(Date.UTC(year,0,1));
const days=expectedDays/86400000;
const validDays=rows.reduce((sum,r)=>sum+(Number.isInteger(r[parameter+'_n'])?r[parameter+'_n']:0),0);
return {validDays,expectedDays:days,percent:100*validDays/days,validMonths:rows.filter(r=>Number.isFinite(r[parameter])).length,estimated:parameter==='PRECTOTCORR'&&validDays<days};
}
function erf(x){if(x===0)return 0;const sign=x<0?-1:1;x=Math.abs(x);const t=1/(1+.3275911*x);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));}
export function pearson(a,b){const am=mean(a),bm=mean(b);let num=0,aa=0,bb=0;for(let i=0;i<a.length;i++){const x=a[i]-am,y=b[i]-bm;num+=x*y;aa+=x*x;bb+=y*y;}return aa&&bb?num/Math.sqrt(aa*bb):0;}
export function trend(series){const data=series.filter(d=>Number.isFinite(d.value));const n=data.length;if(n<2)return {n,slope:null,intercept:null,p:null,autocorrelated:false};let s=0;const slopes=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const diff=data[j].value-data[i].value;s+=Math.sign(diff);slopes.push(diff/(data[j].year-data[i].year));}const slope=median(slopes),intercept=median(data.map(d=>d.value-slope*d.year));const ties=new Map();data.forEach(d=>ties.set(d.value,(ties.get(d.value)||0)+1));const correction=[...ties.values()].reduce((acc,t)=>acc+t*(t-1)*(2*t+5),0);const variance=(n*(n-1)*(2*n+5)-correction)/18;const z=variance>0?(s>0?s-1:s<0?s+1:0)/Math.sqrt(variance):0;const p=n>=10?Math.min(1,Math.max(0,1-erf(Math.abs(z)/Math.sqrt(2)))):null;
// Check lag 1 after detrending; do not report a definitive significance when dependence is detected.
const residuals=data.map(d=>d.value-(intercept+slope*d.year));const left=[],right=[];for(let i=1;i<n;i++)if(data[i].year===data[i-1].year+1){left.push(residuals[i-1]);right.push(residuals[i]);}const r1=pearson(left,right);const autocorrelated=left.length>=8&&Math.abs(r1)>1.96/Math.sqrt(left.length);
return {n,slope,intercept,p,s,z,r1,autocorrelated};}
export function baseline(series,start=2001,end=2010){return mean(series.filter(d=>d.year>=start&&d.year<=end&&Number.isFinite(d.value)).map(d=>d.value));}

export function detrendedResiduals(series) {
  const data = series.filter(d => Number.isFinite(d.value));
  const t = trend(data);
  if (t.slope === null || t.intercept === null) {
    return { trend: t, residuals: [] };
  }
  return {
    trend: t,
    residuals: data.map(d => ({
      year: d.year,
      value: d.value - (t.intercept + t.slope * d.year),
      raw: d.value
    }))
  };
}

export function detrendedCorrelation(seriesA, seriesB) {
  const detA = detrendedResiduals(seriesA);
  const detB = detrendedResiduals(seriesB);
  const mapB = new Map(detB.residuals.map(d => [d.year, d]));
  const shared = detA.residuals.filter(d => mapB.has(d.year));
  const n = shared.length;
  if (n < 2) {
    return { n, r: null, rawR: null, spuriousWarning: false, trendA: detA.trend, trendB: detB.trend };
  }
  const rawXs = shared.map(d => d.raw);
  const rawYs = shared.map(d => mapB.get(d.year).raw);
  const resXs = shared.map(d => d.value);
  const resYs = shared.map(d => mapB.get(d.year).value);
  const rawR = pearson(rawXs, rawYs);
  const r = pearson(resXs, resYs);
  const spuriousWarning = n >= 10 && Math.abs(rawR) >= 0.45 && (Math.abs(rawR) - Math.abs(r) >= 0.25 || Math.abs(r) < 0.25);
  return { n, r, rawR, spuriousWarning, trendA: detA.trend, trendB: detB.trend };
}

export function benjaminiHochberg(items, alpha = 0.05) {
  const validIndices = items
    .map((item, index) => ({ index, p: item.p }))
    .filter(entry => Number.isFinite(entry.p))
    .sort((a, b) => a.p - b.p);
  const m = validIndices.length;
  const qByIndex = new Array(items.length).fill(null);
  if (m > 0) {
    const rawQ = validIndices.map((entry, rankIdx) => (entry.p * m) / (rankIdx + 1));
    const adjusted = new Array(m);
    for (let i = m - 1; i >= 0; i--) {
      adjusted[i] = Math.min(1, i === m - 1 ? rawQ[i] : Math.min(rawQ[i], adjusted[i + 1]));
      qByIndex[validIndices[i].index] = adjusted[i];
    }
  }
  return items.map((item, index) => {
    const q = qByIndex[index];
    return {
      ...item,
      m,
      q,
      fdrSignificant: q !== null && q <= alpha && !item.autocorrelated
    };
  });
}

export function collapseToUniqueCells(sites, resolution = 0.5) {
  const groups = new Map();
  for (const site of sites) {
    if (!Number.isFinite(site?.latitude) || !Number.isFinite(site?.longitude)) continue;
    const latBin = Math.floor(site.latitude / resolution);
    const lonBin = Math.floor(site.longitude / resolution);
    const cellKey = `${latBin},${lonBin}`;
    if (!groups.has(cellKey)) groups.set(cellKey, []);
    groups.get(cellKey).push(site);
  }
  return [...groups.entries()].map(([cellKey, memberSites]) => ({
    cellKey,
    latitude: memberSites[0].latitude,
    longitude: memberSites[0].longitude,
    representativeSite: memberSites[0],
    memberSites
  }));
}
