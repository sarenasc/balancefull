import { appConfig } from '../app/config';
import { createApiClient } from './api';
import { mockSnapshot } from './mockData';
import {
  hydrateRows,
  normalizeDefaultParameters,
  normalizeEntities,
  normalizeFamilies,
  normalizeSpecies,
} from './normalizers';

const api = createApiClient(appConfig.apiBaseUrl);

export const buildMockSnapshot = (dates) => {
  const families = normalizeFamilies(mockSnapshot.familias);
  const species = normalizeSpecies(mockSnapshot.especies);
  const entities = normalizeEntities({
    exportadoras: mockSnapshot.exportadoras,
    especies: species,
  });

  return {
    source: 'mock',
    entities,
    familias: families,
    especies: species,
    parametrosEspecie: mockSnapshot.parametrosEspecie,
    holidays: mockSnapshot.holidays,
    data: hydrateRows({
      entities,
      rowsByType: {
        cosechas: [],
        curado: [],
        procesos: [],
      },
      dates,
    }),
  };
};

export const fetchPlannerSnapshot = async (dates) => {
  const [
    exportadoras,
    familias,
    especies,
    parametrosEspecie,
    configuracion,
    feriados,
    datos,
  ] = await Promise.all([
    api.get('/exportadoras'),
    api.get('/familias'),
    api.get('/especies'),
    api.get('/parametros-especie'),
    api.get('/configuracion').catch(() => ({})),
    api.get('/feriados').catch(() => []),
    api.get('/datos'),
  ]);

  const normalizedFamilies = normalizeFamilies(familias);
  const normalizedSpecies = normalizeSpecies(especies);
  const entities = normalizeEntities({
    exportadoras,
    especies: normalizedSpecies,
  });

  return {
    source: 'api',
    entities,
    familias: normalizedFamilies,
    especies: normalizedSpecies,
    parametrosEspecie: [
      normalizeDefaultParameters(configuracion),
      ...parametrosEspecie,
    ],
    holidays: feriados,
    data: hydrateRows({
      entities,
      rowsByType: {
        cosechas: datos.cosechas || [],
        curado: datos.curado || [],
        procesos: datos.procesos || [],
      },
      dates,
    }),
  };
};
