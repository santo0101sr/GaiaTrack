export const VARIABLES = ['T2M', 'T2M_MIN', 'T2M_MAX', 'ALLSKY_SFC_SW_DWN', 'PRECTOTCORR', 'GWETTOP', 'RH2M'];
export const VIEWS = ['trends', 'explorer', 'forecast', 'current', 'method', '3d'];

// Only these declarative actions may cross the model/application boundary.
export function validateGaiaAction(input, sites, start = 2001, end = 2025) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Acción inválida.');
  const allowed = ['site', 'compareSite', 'variable', 'start', 'end', 'year', 'view', 'anomaly'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw Error('Acción no permitida.');
  const action = {};
  for (const key of ['site', 'compareSite']) {
    if (input[key] !== undefined) {
      if (input[key] !== null && !sites.some(site => site.id === input[key])) throw Error('Territorio inválido.');
      action[key] = input[key];
    }
  }
  if (input.variable !== undefined) {
    if (!VARIABLES.includes(input.variable)) throw Error('Variable inválida.');
    action.variable = input.variable;
  }
  for (const key of ['start', 'end', 'year']) {
    if (input[key] !== undefined) {
      if (!Number.isInteger(input[key]) || input[key] < start || input[key] > end) throw Error('Año fuera del histórico disponible.');
      action[key] = input[key];
    }
  }
  if (action.start !== undefined && action.end !== undefined && action.start > action.end) throw Error('Período inválido.');
  if (input.view !== undefined) {
    if (!VIEWS.includes(input.view)) throw Error('Vista inválida.');
    action.view = input.view;
  }
  if (input.anomaly !== undefined) {
    if (typeof input.anomaly !== 'boolean') throw Error('Vista de anomalías inválida.');
    action.anomaly = input.anomaly;
  }
  return action;
}
