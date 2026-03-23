const DEFAULT_START = '2026-03-12';
const DEFAULT_DAYS = 100;

export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api',
  planningStart: import.meta.env.VITE_PLANNING_START || DEFAULT_START,
  planningDays: Number(import.meta.env.VITE_PLANNING_DAYS || DEFAULT_DAYS),
};
