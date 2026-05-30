import { describe, expect, it } from 'vitest';
import {
  createEmptyRows,
  hydrateRows,
  normalizeDefaultParameters,
  normalizeEntities,
  normalizeFamilies,
  normalizeSpecies,
} from './normalizers';

describe('normalizers', () => {
  it('creates empty rows for every entity and date', () => {
    expect(createEmptyRows([1], ['2026-03-12'])).toEqual({
      1: {
        '2026-03-12': { cosecha: 0, curado: 0, proceso: 0 },
      },
    });
  });

  it('normalizes families and species numeric fields', () => {
    expect(normalizeFamilies([{ id: '2', orden: '3', usa_curado: 1, activa: 0 }])[0]).toEqual({
      id: 2,
      orden: 3,
      usa_curado: true,
      activa: 0,
    });

    expect(normalizeSpecies([{ id: '5', familia_id: '9', nombre: 'Kiwi' }])[0]).toEqual({
      id: 5,
      familia_id: 9,
      nombre: 'Kiwi',
    });
  });

  it('normalizes entities and resolves species ids by normalized species name', () => {
    const entities = normalizeEntities({
      exportadoras: [
        {
          id: '7',
          nombre: 'Export A',
          especie: 'Manzana',
          variedad: 'Royal',
          color_idx: '2',
          especie_id: null,
          visible_linea: '1',
        },
      ],
      especies: [{ id: 4, nombre: 'manzána' }],
    });

    expect(entities[0]).toMatchObject({
      id: 7,
      dbId: 7,
      especieId: 4,
      colorIdx: 2,
      visibleLinea: 1,
      label: 'Export A Royal',
    });
  });

  it('hydrates rows by type over the empty matrix', () => {
    const rows = hydrateRows({
      entities: [{ id: 1 }],
      dates: ['2026-03-12'],
      rowsByType: {
        cosechas: [{ exportadora_id: 1, fecha: '2026-03-12', bins: 10 }],
        curado: [{ exportadora_id: 1, fecha: '2026-03-12', bins: 8 }],
        procesos: [{ exportadora_id: 1, fecha: '2026-03-12', bins: 6 }],
      },
    });

    expect(rows[1]['2026-03-12']).toEqual({
      cosecha: 10,
      curado: 8,
      proceso: 6,
    });
  });

  it('normalizes default parameters from multiple key styles', () => {
    expect(normalizeDefaultParameters({ bph: '20', hpd: '12', kpb: '300' })).toEqual({
      especie_id: null,
      bins_por_hora: 20,
      horas_por_dia: 12,
      kg_por_bin: 300,
    });
  });
});
