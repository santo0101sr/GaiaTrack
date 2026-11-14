export const parameters=['T2M','T2M_MIN','T2M_MAX','ALLSKY_SFC_SW_DWN','PRECTOTCORR','GWETTOP','RH2M'];

// Build the calendar independently of the response: absent dates count as missing.
export function aggregateHistory(raw,start=2001,end=2025){
  if(!raw.properties?.parameter)throw Error('Respuesta NASA POWER incompleta.');
  const source=raw.properties.parameter,monthly=[];
  for(let year=start;year<=end;year++)for(let month=1;month<=12;month++){
    const days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const row={year,month,days};
    for(const parameter of parameters){
      const values=[];
      for(let day=1;day<=days;day++){
        const date=`${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`;
        const value=source[parameter]?.[date];
        if(Number.isFinite(value)&&value!==(raw.header?.fill_value??-999))values.push(value);
      }
      row[parameter]=values.length>=Math.ceil(days*.9)?values.reduce((a,b)=>a+b,0)/values.length:null;
      row[parameter+'_n']=values.length;
    }
    monthly.push(row);
  }
  return monthly;
}
