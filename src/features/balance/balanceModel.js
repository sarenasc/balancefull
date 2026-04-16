import { addDays, getCuradoReleaseDate } from '../../utils/date';

const normalizeDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getEntityLabel = (entity) =>
  entity?.label ||
  entity?.exportadora ||
  entity?.nombre ||
  `Exportadora ${entity?.id}`;

const buildSpeciesMap = (especies = []) =>
  new Map(especies.map((item) => [Number(item.id), item]));

const getEntitySpeciesId = (entity) =>
  Number(entity?.especieId ?? entity?.especie_id ?? 0);

const buildFamilyDateRange = (familia, fallbackDates = []) => {
  const start = normalizeDate(familia?.fecha_inicio) || fallbackDates[0] || null;
  const end =
    normalizeDate(familia?.fecha_fin) ||
    fallbackDates[fallbackDates.length - 1] ||
    start;

  if (!start || !end) return fallbackDates;

  const result = [];
  let cursor = start;
  let guard = 0;

  while (cursor <= end && guard < 1200) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  return result;
};

const buildEntityFamilyMap = ({ entities = [], especies = [] }) => {
  const speciesMap = buildSpeciesMap(especies);

  return new Map(
    entities.map((entity) => {
      const especie = speciesMap.get(getEntitySpeciesId(entity));
      return [Number(entity.id), Number(especie?.familia_id ?? entity?.familia_id ?? 0)];
    }),
  );
};

const buildCuradoAutoMap = ({
  familyEntities,
  family,
  familyDates,
  data,
  curadoHoursConfig,
}) => {
  const result = {};
  const familyDateSet = new Set(familyDates);

  familyEntities.forEach((entity) => {
    const entityId = Number(entity.id);
    result[entityId] = {};

    familyDates.forEach((date) => {
      result[entityId][date] = 0;
    });

    if (!family?.usa_curado) return;

    familyDates.forEach((date) => {
      const cosecha = safeNumber(data?.[entityId]?.[date]?.cosecha);
      if (!cosecha) return;

      const curadoHours = safeNumber(
        curadoHoursConfig?.[entityId] ?? entity?.horas_curado ?? 0,
      );

      const releaseDate = getCuradoReleaseDate(date, curadoHours);
      if (!familyDateSet.has(releaseDate)) return;

      result[entityId][releaseDate] += cosecha;
    });
  });

  return result;
};

const buildDailyBinsMap = (parametrosDia = []) =>
  new Map(
    parametrosDia.map((item) => [
      `${Number(item.exportadora_id)}|${normalizeDate(item.fecha)}`,
      safeNumber(item.bins_por_hora),
    ]),
  );

const buildDailyExtrasMap = (horasExtraDia = []) =>
  new Map(
    horasExtraDia.map((item) => [
      `${Number(item.exportadora_id)}|${normalizeDate(item.fecha)}`,
      safeNumber(item.horas_extra),
    ]),
  );

const buildFamilySections = ({
  family,
  familyDates,
  familyEntities,
  data,
  curadoHoursConfig,
  parametersBySpeciesId,
  parametrosDia,
  horasExtraDia,
}) => {
  const curadoAutoMap = buildCuradoAutoMap({
    familyEntities,
    family,
    familyDates,
    data,
    curadoHoursConfig,
  });
  const dailyBinsMap = buildDailyBinsMap(parametrosDia);
  const dailyExtrasMap = buildDailyExtrasMap(horasExtraDia);

  const sections = {
    cosecha: [],
    curado: [],
    proceso: [],
    balance: [],
  };

  const totals = {
    totalProceso: {},
    totalHorasProceso: {},
    totalBalance: {},
  };

  familyDates.forEach((date) => {
    totals.totalProceso[date] = 0;
    totals.totalHorasProceso[date] = 0;
    totals.totalBalance[date] = 0;
  });

  familyEntities.forEach((entity) => {
    const entityId = Number(entity.id);
    const especieId = getEntitySpeciesId(entity);
    const params =
      parametersBySpeciesId?.get?.(especieId) ||
      parametersBySpeciesId?.get?.(null) || {
        bins_por_hora: 18,
        horas_por_dia: 16,
        kg_por_bin: 460,
      };

    const cosechaValues = {};
    const curadoValues = {};
    const procesoValues = {};
    const balanceValues = {};
    const binsPerHourValues = {};
    const isOverrideValues = {};

    let runningBalance = 0;

    familyDates.forEach((date) => {
      const raw = data?.[entityId]?.[date] || {};

      const cosecha = safeNumber(raw.cosecha);
      const proceso = safeNumber(raw.proceso);
      const curadoManual = raw.curado;
      const curadoAuto = safeNumber(curadoAutoMap?.[entityId]?.[date]);

      const curado =
        curadoManual == null || curadoManual === ''
          ? curadoAuto
          : safeNumber(curadoManual);

      cosechaValues[date] = cosecha;
      curadoValues[date] = curado;
      procesoValues[date] = proceso;

      if (family?.usa_curado) {
        runningBalance += curado - proceso;
      } else {
        runningBalance += cosecha - proceso;
      }

      balanceValues[date] = runningBalance;

      const dayKey = `${entityId}|${date}`;
      const hasOverride = dailyBinsMap.has(dayKey);
      const binsPorHoraDia = hasOverride
        ? dailyBinsMap.get(dayKey)
        : Math.max(1, safeNumber(params.bins_por_hora || 18));

      const extraHoras = dailyExtrasMap.get(`${entityId}|${date}`) || 0;

      binsPerHourValues[date] = binsPorHoraDia;
      isOverrideValues[date] = hasOverride;

      totals.totalProceso[date] += proceso;
      totals.totalHorasProceso[date] += proceso / Math.max(1, binsPorHoraDia) + extraHoras;
      totals.totalBalance[date] += runningBalance;
    });

    const baseRow = {
      entityId,
      exportadora: getEntityLabel(entity),
      especie: entity?.especie_nombre || entity?.especie || '',
      variedad: entity?.variedad || '',
      planta: entity?.planta || 'ALMAHUE',
    };

    sections.cosecha.push({
      ...baseRow,
      field: 'cosecha',
      values: cosechaValues,
    });

    sections.curado.push({
      ...baseRow,
      field: 'curado',
      values: curadoValues,
      autoValues: curadoAutoMap?.[entityId] || {},
    });

    sections.proceso.push({
      ...baseRow,
      field: 'proceso',
      values: procesoValues,
      binsPerHourValues,
      isOverrideValues,
    });

    sections.balance.push({
      ...baseRow,
      field: 'balance',
      values: balanceValues,
    });
  });

  return { sections, totals };
};

export const buildBalanceModel = ({
  dates = [],
  familias = [],
  especies = [],
  entities = [],
  data = {},
  curadoHoursConfig = {},
  parametersBySpeciesId,
  parametrosDia = [],
  horasExtraDia = [],
}) => {
  const entityFamilyMap = buildEntityFamilyMap({ entities, especies });

  const families = familias
    .filter((familia) => Number(familia?.activa ?? 1) === 1)
    .map((familia) => {
      const familyId = Number(familia.id);
      const familyDates = buildFamilyDateRange(familia, dates);

      const familyEntities = entities.filter(
        (entity) =>
          Number(entityFamilyMap.get(Number(entity.id))) === familyId &&
          Number(entity?.visibleLinea ?? entity?.visible_linea ?? 1) === 1,
      );

      const { sections, totals } = buildFamilySections({
        family: familia,
        familyDates,
        familyEntities,
        data,
        curadoHoursConfig,
        parametersBySpeciesId,
        parametrosDia,
        horasExtraDia,
      });

      return {
        familyId,
        familyName: familia.nombre,
        usaCurado: Boolean(familia.usa_curado),
        seasonStart: normalizeDate(familia.fecha_inicio),
        seasonEnd: normalizeDate(familia.fecha_fin),
        dates: familyDates,
        entities: familyEntities,
        sections,
        totals,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    families,
  };
};
