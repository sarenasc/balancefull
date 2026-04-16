const DEFAULT_START = '2026-03-12';
const DEFAULT_DAYS = 100;
const runtimeConfig = window.__APP_CONFIG__ || {};

export const appConfig = {
  apiBaseUrl:
    runtimeConfig.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://172.20.20.5:4001/api',
  planningStart:
    runtimeConfig.planningStart || import.meta.env.VITE_PLANNING_START || DEFAULT_START,
  planningDays: Number(
    runtimeConfig.planningDays || import.meta.env.VITE_PLANNING_DAYS || DEFAULT_DAYS,
  ),
};
