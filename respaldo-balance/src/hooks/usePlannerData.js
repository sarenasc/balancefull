import { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../app/config';
import { createApiClient } from '../services/api';
import { mockSnapshot } from '../services/mockData';
import { buildDateRange } from '../utils/date';

const api = createApiClient(appConfig.apiBaseUrl);

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const createEmptyRows = (entityIds, dates) =>
  Object.fromEntries(
    entityIds.map((entityId) => [
      entityId,
      Object.fromEntries(dates.map((date) => [date, { cosecha: 0, curado: 0, proceso: 0 }])),
    ]),
  );

const hydrateSnapshot = (snapshot, dates) => {
  const speciesByName = new Map(snapshot.especies.map((species) => [normalizeText(species.nombre), species]));
  const entities = snapshot.exportadoras.map((item) => ({
    id: Number(item.id),
    dbId: Number(item.id),
    exportadora: item.nombre,
    especie: item.especie,
    variedad: item.variedad || '',
    colorIdx: Number(item.color_idx || 0),
    especieId: item.especie_id ? Number(item.especie_id) : Number(speciesByName.get(normalizeText(item.especie))?.id || 0),
    visibleLinea: Number(item.visible_linea ?? 1),
    label: [item.nombre, item.variedad].filter(Boolean).join(' '),
  }));

  const rows = createEmptyRows(
    entities.map((entity) => entity.id),
    dates,
  );

  Object.entries(snapshot.rows || {}).forEach(([entityId, byDate]) => {
    Object.entries(byDate).forEach(([date, values]) => {
      if (rows[entityId]?.[date]) {
        rows[entityId][date] = {
          cosecha: Number(values.cosecha || 0),
          curado: Number(values.curado || 0),
          proceso: Number(values.proceso || 0),
        };
      }
    });
  });

  return {
    entities,
    familias: snapshot.familias,
    especies: snapshot.especies,
    parametrosEspecie: snapshot.parametrosEspecie,
    holidays: snapshot.holidays,
    data: rows,
    temporadaId: 1,
    source: 'mock',
  };
};

const fetchSnapshot = async (dates) => {
  const [
    exportadoras,
    familias,
    especies,
    parametrosEspecie,
    configuracion,
    feriados,
    datos,
    temporada,
  ] = await Promise.all([
    api.get('/exportadoras'),
    api.get('/familias'),
    api.get('/especies'),
    api.get('/parametros-especie'),
    api.get('/configuracion').catch(() => ({ bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460 })),
    api.get('/feriados').catch(() => []),
    api.get('/datos'),
    api.get('/temporada').catch(() => ({ id: 1 })),
  ]);

  const snapshot = hydrateSnapshot(
    {
      exportadoras,
      familias,
      especies,
      parametrosEspecie: [
        {
          especie_id: null,
          bins_por_hora: Number(configuracion.bph ?? configuracion.bins_por_hora ?? 18),
          horas_por_dia: Number(configuracion.hpd ?? configuracion.horas_por_dia ?? 16),
          kg_por_bin: Number(configuracion.kpb ?? configuracion.kg_por_bin ?? 460),
        },
        ...parametrosEspecie,
      ],
      holidays: feriados,
      rows: {},
    },
    dates,
  );

  datos.cosechas.forEach((row) => {
    if (snapshot.data[row.exportadora_id]?.[row.fecha]) {
      snapshot.data[row.exportadora_id][row.fecha].cosecha = Number(row.bins || 0);
    }
  });
  datos.curado.forEach((row) => {
    if (snapshot.data[row.exportadora_id]?.[row.fecha]) {
      snapshot.data[row.exportadora_id][row.fecha].curado = Number(row.bins || 0);
    }
  });
  datos.procesos.forEach((row) => {
    if (snapshot.data[row.exportadora_id]?.[row.fecha]) {
      snapshot.data[row.exportadora_id][row.fecha].proceso = Number(row.bins || 0);
    }
  });

  return {
    ...snapshot,
    temporadaId: Number(temporada?.id || datos?.temporada_id || 1),
    source: 'api',
  };
};

export const usePlannerData = () => {
  const dates = useMemo(
    () => buildDateRange(appConfig.planningStart, appConfig.planningDays),
    [],
  );

  const [state, setState] = useState({
    status: 'loading',
    source: 'loading',
    entities: [],
    familias: [],
    especies: [],
    parametrosEspecie: [],
    holidays: [],
    data: {},
    temporadaId: 1,
    error: null,
  });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const snapshot = await fetchSnapshot(dates);
        if (alive) {
          setState({ status: 'ready', error: null, ...snapshot });
        }
      } catch (error) {
        if (alive) {
          const fallback = hydrateSnapshot(mockSnapshot, dates);
          setState({
            status: 'ready',
            error: error instanceof Error ? error.message : 'No fue posible cargar la API.',
            ...fallback,
          });
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [dates]);

  return {
    ...state,
    dates,
  };
};
