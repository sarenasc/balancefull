export const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const hoursToWholeDays = (hours) => {
  const safe = Number(hours);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  return Math.ceil(safe / 24);
};

export const getCuradoReleaseDate = (dateString, hours) =>
  addDays(dateString, hoursToWholeDays(hours));

export const buildDateRange = (start, totalDays) =>
  Array.from({ length: totalDays }, (_, index) => addDays(start, index));

export const formatDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
  });

export const formatWeekday = (value) =>
  ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(`${value}T12:00:00`).getDay()];

export const isSunday = (value) => new Date(`${value}T12:00:00`).getDay() === 0;
