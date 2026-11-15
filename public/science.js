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
function logGamma(z){
  const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,1.208650973866179e-3,-5.395239384953e-6];
  let y=z,tmp=z+5.5;tmp-=(z+.5)*Math.log(tmp);let ser=1.000000000190015;
  for(let j=0;j<6;j++){y+=1;ser+=c[j]/y;}
  return -tmp+Math.log(2.5066282746310005*ser/z);
}
function betaCF(a,b,x){
  const qab=a+b,qap=a+1,qam=a-1;
  let c=1,d=1-qab*x/qap;
  if(Math.abs(d)<1e-30)d=1e-30;
  d=1/d;let h=d;
  for(let m=1;m<=200;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;
    const del=d*c;h*=del;
    if(Math.abs(del-1)<3e-10)break;
  }
  return h;
}
function regIncompleteBeta(a,b,x){
  if(x<=0)return 0;if(x>=1)return 1;
  const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return x<(a+1)/(a+b+2)?bt*betaCF(a,b,x)/a:1-bt*betaCF(b,a,1-x)/b;
}
export function tPValue(tStat,df){
  if(!Number.isFinite(tStat)||!Number.isFinite(df)||df<=0)return null;
  if(tStat===0)return 1;
  const x=df/(df+tStat*tStat);
  return Math.min(1,Math.max(0,regIncompleteBeta(df/2,.5,x)));
}
export function tCritical(df,alpha=.05){
  if(!Number.isFinite(df)||df<=0||!(alpha>0&&alpha<1))return null;
  let lo=0,hi=100;
  for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(tPValue(mid,df)>alpha)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export function sampleStd(xs){
  const valid=xs.filter(Number.isFinite);
  if(valid.length<2)return null;
  const m=mean(valid);
  return Math.sqrt(valid.reduce((acc,v)=>acc+(v-m)**2,0)/(valid.length-1));
}
export function confidenceInterval(xs,alpha=.05){
  const valid=xs.filter(Number.isFinite),n=valid.length;
  if(n<2)return {n,mean:mean(valid),std:null,se:null,margin:null,lower:null,upper:null,alpha};
  const m=mean(valid),std=sampleStd(valid),se=std/Math.sqrt(n),tCrit=tCritical(n-1,alpha),margin=tCrit*se;
  return {n,mean:m,std,se,margin,lower:m-margin,upper:m+margin,alpha};
}
export function tTest(sampleA,sampleB=0,alpha=.05){
  const a=(sampleA||[]).filter(Number.isFinite);
  if(a.length<2)return {type:typeof sampleB==='number'?'one-sample':'two-sample',nA:a.length,nB:Array.isArray(sampleB)?sampleB.length:null,t:null,df:null,p:null,meanDiff:null,ciLower:null,ciUpper:null,significant:false,alpha};
  const mA=mean(a),sA=sampleStd(a),vA=(sA*sA)/a.length;
  if(typeof sampleB==='number'){
    const se=Math.sqrt(vA),diff=mA-sampleB;
    if(se===0)return {type:'one-sample',nA:a.length,nB:null,t:diff===0?0:null,df:a.length-1,p:diff===0?1:null,meanDiff:diff,ciLower:mA,ciUpper:mA,significant:false,alpha};
    const t=diff/se,df=a.length-1,p=tPValue(t,df),tCrit=tCritical(df,alpha),margin=tCrit*se;
    return {type:'one-sample',nA:a.length,nB:null,t,df,p,meanDiff:diff,ciLower:diff-margin,ciUpper:diff+margin,significant:p!==null&&p<alpha,alpha};
  }
  const b=(sampleB||[]).filter(Number.isFinite);
  if(b.length<2)return {type:'two-sample',nA:a.length,nB:b.length,t:null,df:null,p:null,meanDiff:null,ciLower:null,ciUpper:null,significant:false,alpha};
  const mB=mean(b),sB=sampleStd(b),vB=(sB*sB)/b.length,se=Math.sqrt(vA+vB),diff=mA-mB;
  if(se===0)return {type:'two-sample',nA:a.length,nB:b.length,t:diff===0?0:null,df:a.length+b.length-2,p:diff===0?1:null,meanDiff:diff,ciLower:diff,ciUpper:diff,significant:false,alpha};
  const t=diff/se,df=(vA+vB)**2/((vA*vA)/(a.length-1)+(vB*vB)/(b.length-1));
  const p=tPValue(t,df),tCrit=tCritical(df,alpha),margin=tCrit*se;
  return {type:'two-sample',nA:a.length,nB:b.length,t,df,p,meanDiff:diff,ciLower:diff-margin,ciUpper:diff+margin,significant:p!==null&&p<alpha,alpha};
}
export function pearson(a,b){const am=mean(a),bm=mean(b);let num=0,aa=0,bb=0;for(let i=0;i<a.length;i++){const x=a[i]-am,y=b[i]-bm;num+=x*y;aa+=x*x;bb+=y*y;}return aa&&bb?num/Math.sqrt(aa*bb):0;}
export function trend(series,alpha=.05){const data=series.filter(d=>Number.isFinite(d.value));const n=data.length;if(n<2)return {n,slope:null,intercept:null,p:null,autocorrelated:false,slopeCI:null};let s=0;const slopes=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const diff=data[j].value-data[i].value;s+=Math.sign(diff);slopes.push(diff/(data[j].year-data[i].year));}const sortedSlopes=[...slopes].sort((a,b)=>a-b);const slope=median(sortedSlopes),intercept=median(data.map(d=>d.value-slope*d.year));const ties=new Map();data.forEach(d=>ties.set(d.value,(ties.get(d.value)||0)+1));const correction=[...ties.values()].reduce((acc,t)=>acc+t*(t-1)*(2*t+5),0);const variance=(n*(n-1)*(2*n+5)-correction)/18;const z=variance>0?(s>0?s-1:s<0?s+1:0)/Math.sqrt(variance):0;const p=n>=10?Math.min(1,Math.max(0,1-erf(Math.abs(z)/Math.sqrt(2)))):null;
const zCrit=1.95996398454;const cAlpha=variance>0?zCrit*Math.sqrt(variance):0;const mSlopes=sortedSlopes.length;const loIdx=Math.max(0,Math.floor((mSlopes-cAlpha)/2)-1);const hiIdx=Math.min(mSlopes-1,Math.ceil((mSlopes+cAlpha)/2)-1);const slopeCI=n>=4&&mSlopes?{lower:sortedSlopes[loIdx],upper:sortedSlopes[hiIdx],alpha}:null;
// Check lag 1 after detrending; do not report a definitive significance when dependence is detected.
const residuals=data.map(d=>d.value-(intercept+slope*d.year));const left=[],right=[];for(let i=1;i<n;i++)if(data[i].year===data[i-1].year+1){left.push(residuals[i-1]);right.push(residuals[i]);}const r1=pearson(left,right);const autocorrelated=left.length>=8&&Math.abs(r1)>1.96/Math.sqrt(left.length);
return {n,slope,intercept,p,s,z,r1,autocorrelated,slopeCI};}
export function baseline(series,start=2001,end=2010){return mean(series.filter(d=>d.year>=start&&d.year<=end&&Number.isFinite(d.value)).map(d=>d.value));}

// Keep the same robust linear estimator used by the trend panel.
export function detrendedResiduals(series){
  const data=[...new Map(series.filter(d=>Number.isFinite(d.year)&&Number.isFinite(d.value)).map(d=>[d.year,d])).values()].sort((a,b)=>a.year-b.year);
  const fit=trend(data);
  return {trend:fit,residuals:Number.isFinite(fit.slope)?data.map(d=>({year:d.year,value:d.value-fit.intercept-fit.slope*d.year})):[]};
}

export function detrendedCorrelation(a,b){
  const right=new Map(b.filter(d=>Number.isFinite(d.year)&&Number.isFinite(d.value)).map(d=>[d.year,d]));
  const left=[...new Map(a.filter(d=>Number.isFinite(d.year)&&Number.isFinite(d.value)&&right.has(d.year)).map(d=>[d.year,d])).values()].sort((x,y)=>x.year-y.year);
  const aligned=left.map(d=>right.get(d.year)),n=left.length;
  const correlate=(x,y)=>{
    if(x.length<3||y.length!==x.length)return null;
    const scale=Math.max(1,...x.map(Math.abs),...y.map(Math.abs));
    if(Math.max(...x)-Math.min(...x)<=Number.EPSILON*scale*64||Math.max(...y)-Math.min(...y)<=Number.EPSILON*scale*64)return null;
    return Math.max(-1,Math.min(1,pearson(x,y)));
  };
  const rawR=correlate(left.map(d=>d.value),aligned.map(d=>d.value));
  const r=correlate(detrendedResiduals(left).residuals.map(d=>d.value),detrendedResiduals(aligned).residuals.map(d=>d.value));
  // Descriptive screening flag, not an additional significance test.
  return {n,rawR,r,spuriousWarning:Number.isFinite(rawR)&&Number.isFinite(r)&&Math.abs(rawR)>=.7&&Math.abs(rawR)-Math.abs(r)>=.3};
}

export function benjaminiHochberg(items,alpha=.05){
  const ranked=items.map((item,index)=>({item,index})).filter(({item})=>Number.isFinite(item.p)&&item.p>=0&&item.p<=1).sort((a,b)=>a.item.p-b.item.p);
  const m=ranked.length,adjusted=new Map();let minimum=1;
  for(let i=m-1;i>=0;i--){minimum=Math.min(minimum,ranked[i].item.p*m/(i+1));adjusted.set(ranked[i].index,minimum);}
  return items.map((item,index)=>{const q=adjusted.get(index)??null;return {...item,q,m,fdrSignificant:q!==null&&q<=alpha&&!item.autocorrelated};});
}

// Approximate MERRA-2 reference-grid grouping. Returned provider cell coordinates are preferable
// when available; this grouping does not imply independent observations or a finer resolution.
export function collapseToUniqueCells(sites,latitudeResolution=.5,longitudeResolution=.625){
  if(!(latitudeResolution>0&&longitudeResolution>0))throw Error('Grid resolution must be positive.');
  const cells=new Map();
  for(const site of sites){
    if(!Number.isFinite(site.latitude)||!Number.isFinite(site.longitude))continue;
    const latitude=+(Math.round(site.latitude/latitudeResolution)*latitudeResolution).toFixed(6),longitude=+(Math.round(site.longitude/longitudeResolution)*longitudeResolution).toFixed(6);
    const cellKey=`${latitude},${longitude}`;
    if(!cells.has(cellKey))cells.set(cellKey,{cellKey,latitude,longitude,representativeSite:site,memberSites:[],approximate:true});
    cells.get(cellKey).memberSites.push(site);
  }
  return [...cells.values()];
}
