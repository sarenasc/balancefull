export const formatNumber = (value) => {
  if (value == null) return '—';
  return Number(value).toLocaleString('es-CL');
};

export const formatDecimal = (value) => Number(value || 0).toFixed(1);
