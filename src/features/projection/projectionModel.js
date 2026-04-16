import { formatDate, isSunday } from '../../utils/date';

const normalizeDate = (value) => (value ? String(value).slice(0, 10) : '');

const buildDailyBinsMap = (parametrosDia = []) =>
  new Map(
    parametrosDia.map((item) => [
      `${Number(item.exportadora_id)}|${normalizeDate(item.fecha)}`,
      Number(item.bins_por_hora || 0),
    ]),
  );

export const createProjectionMetrics = ({
  dates,
  entities,
  data,
  familyBySpeciesId,
  parametersBySpeciesId,
  parametrosDia = [],
}) => {
  const dailyBinsMap = buildDailyBinsMap(parametrosDia);

  const rows = dates.map((date) => ({
    fecha: date,
    label: formatDate(date),
    curado: 0,
    cosecha: 0,
    proceso: 0,
    balance: 0,
    horas: 0,
    kgProcesados: 0,
  }));

  const rowMap = new Map(rows.map((row) => [row.fecha, row]));

  entities.forEach((entity) => {
    const family = familyBySpeciesId.get(entity.especieId);
    const usesCurado = Boolean(family?.usa_curado);

    const params =
      parametersBySpeciesId.get(entity.especieId) ||
      parametersBySpeciesId.get(null) ||
      {};

    let running = 0;

    dates.forEach((date) => {
      const day = data[entity.id]?.[date] || {};
      const cosecha = Number(day.cosecha || 0);
      const curado = Number(day.curado || 0);
      const proceso = Number(day.proceso || 0);

      const binsPorHoraDia =
        dailyBinsMap.get(`${Number(entity.id)}|${date}`) ||
        Number(params.bins_por_hora || 18);

      running += usesCurado ? curado - proceso : cosecha - proceso;

      const row = rowMap.get(date);
      row.cosecha += cosecha;
      row.curado += curado;
      row.proceso += proceso;
      row.balance += running;
      row.horas += binsPorHoraDia > 0 ? proceso / binsPorHoraDia : 0;
      row.kgProcesados += proceso * Number(params.kg_por_bin || 0);
      row[entity.label] = running;
    });
  });

  const averageBinsPerHour = entities.length
    ? entities.reduce((total, entity) => {
        const params = parametersBySpeciesId.get(entity.especieId) || parametersBySpeciesId.get(null);
        return total + Number(params?.bins_por_hora || 18);
      }, 0) / entities.length
    : 18;

  const sundayCards = rows
    .filter((row) => row.fecha >= new Date().toISOString().slice(0, 10))
    .filter((row) => isSunday(row.fecha))
    .slice(0, 5)
    .map((row) => ({
      fecha: row.fecha,
      balance: row.balance,
      horasRestantes: averageBinsPerHour ? row.balance / averageBinsPerHour : 0,
      turnosRestantes: averageBinsPerHour ? row.balance / averageBinsPerHour / 9 : 0,
    }));

  return {
    rows,
    sundayCards,
  };
};
