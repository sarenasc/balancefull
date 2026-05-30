import { describe, expect, it } from 'vitest';
import { createProjectionMetrics } from './projectionModel';

describe('createProjectionMetrics', () => {
  it('accumulates balances using curado when the family requires it', () => {
    const metrics = createProjectionMetrics({
      dates: ['2026-03-12', '2026-03-13'],
      entities: [{ id: 1, especieId: 10, label: 'Export A' }],
      data: {
        1: {
          '2026-03-12': { cosecha: 10, curado: 6, proceso: 2 },
          '2026-03-13': { cosecha: 5, curado: 4, proceso: 3 },
        },
      },
      familyBySpeciesId: new Map([[10, { usa_curado: true }]]),
      parametersBySpeciesId: new Map([[10, { bins_por_hora: 2, kg_por_bin: 100 }]]),
      parametrosDia: [],
    });

    expect(metrics.rows[0]).toMatchObject({
      fecha: '2026-03-12',
      balance: 4,
      horas: 1,
      kgProcesados: 200,
    });

    expect(metrics.rows[0]['Export A']).toBe(4);
    expect(metrics.rows[1]['Export A']).toBe(5);
    expect(metrics.rows[1].balance).toBe(5);
  });

  it('uses daily bins override for process hours', () => {
    const metrics = createProjectionMetrics({
      dates: ['2026-03-12'],
      entities: [{ id: 1, especieId: 10, label: 'Export A' }],
      data: {
        1: {
          '2026-03-12': { cosecha: 10, curado: 0, proceso: 9 },
        },
      },
      familyBySpeciesId: new Map([[10, { usa_curado: false }]]),
      parametersBySpeciesId: new Map([[10, { bins_por_hora: 3, kg_por_bin: 100 }]]),
      parametrosDia: [{ exportadora_id: 1, fecha: '2026-03-12', bins_por_hora: 9 }],
    });

    expect(metrics.rows[0].horas).toBe(1);
    expect(metrics.rows[0].balance).toBe(1);
  });
});
