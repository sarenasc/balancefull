import { describe, expect, it } from 'vitest';
import { buildBalanceModel } from './balanceModel';

describe('buildBalanceModel', () => {
  it('builds family sections using curado auto-release and daily overrides', () => {
    const model = buildBalanceModel({
      dates: ['2026-03-12', '2026-03-13', '2026-03-14'],
      familias: [
        {
          id: 1,
          nombre: 'Carozo',
          activa: 1,
          usa_curado: true,
          fecha_inicio: '2026-03-12',
          fecha_fin: '2026-03-14',
        },
      ],
      especies: [{ id: 10, nombre: 'Cereza', familia_id: 1 }],
      entities: [
        {
          id: 7,
          especieId: 10,
          exportadora: 'Export A',
          variedad: 'Royal',
          visibleLinea: 1,
        },
      ],
      data: {
        7: {
          '2026-03-12': { cosecha: 12, proceso: 2 },
          '2026-03-13': { proceso: 3 },
        },
      },
      curadoHoursConfig: { 7: 48 },
      parametersBySpeciesId: new Map([[10, { bins_por_hora: 3, kg_por_bin: 100 }]]),
      parametrosDia: [{ exportadora_id: 7, fecha: '2026-03-13', bins_por_hora: 9 }],
      horasExtraDia: [{ exportadora_id: 7, fecha: '2026-03-13', horas_extra: 2 }],
    });

    const family = model.families[0];
    expect(family.familyName).toBe('Carozo');
    expect(family.sections.cosecha[0].values['2026-03-12']).toBe(12);
    expect(family.sections.curado[0].values['2026-03-14']).toBe(12);
    expect(family.sections.curado[0].autoValues['2026-03-14']).toBe(12);
    expect(family.sections.proceso[0].binsPerHourValues['2026-03-13']).toBe(9);
    expect(family.sections.proceso[0].isOverrideValues['2026-03-13']).toBe(true);
    expect(family.sections.balance[0].values['2026-03-12']).toBe(-2);
    expect(family.sections.balance[0].values['2026-03-13']).toBe(-5);
    expect(family.sections.balance[0].values['2026-03-14']).toBe(7);
    expect(family.totals.totalHorasProceso['2026-03-13']).toBeCloseTo(2 + (3 / 9), 5);
  });

  it('hides exportadoras with visibleLinea = 0 from balance families', () => {
    const model = buildBalanceModel({
      dates: ['2026-03-12'],
      familias: [{ id: 1, nombre: 'Pomaceas', activa: 1, usa_curado: false }],
      especies: [{ id: 20, nombre: 'Manzana', familia_id: 1 }],
      entities: [
        { id: 3, especieId: 20, label: 'Visible', visibleLinea: 1 },
        { id: 4, especieId: 20, label: 'Oculta', visibleLinea: 0 },
      ],
      data: {
        3: { '2026-03-12': { cosecha: 8, proceso: 2 } },
        4: { '2026-03-12': { cosecha: 10, proceso: 1 } },
      },
      parametersBySpeciesId: new Map([[20, { bins_por_hora: 4, kg_por_bin: 200 }]]),
    });

    expect(model.families).toHaveLength(1);
    expect(model.families[0].entities).toHaveLength(1);
    expect(model.families[0].entities[0].label).toBe('Visible');
    expect(model.families[0].sections.cosecha).toHaveLength(1);
    expect(model.families[0].sections.cosecha[0].exportadora).toBe('Visible');
  });

  it('uses cosecha instead of curado for non-curado families and skips inactive families', () => {
    const model = buildBalanceModel({
      dates: ['2026-03-12', '2026-03-13'],
      familias: [
        { id: 1, nombre: 'Berries', activa: 1, usa_curado: false },
        { id: 2, nombre: 'Oculta', activa: 0, usa_curado: true },
      ],
      especies: [{ id: 20, nombre: 'Arandano', familia_id: 1 }],
      entities: [{ id: 3, especieId: 20, label: 'Export B' }],
      data: {
        3: {
          '2026-03-12': { cosecha: 8, curado: 99, proceso: 2 },
          '2026-03-13': { cosecha: 4, proceso: 3 },
        },
      },
      parametersBySpeciesId: new Map([[20, { bins_por_hora: 4, kg_por_bin: 200 }]]),
    });

    expect(model.families).toHaveLength(1);
    const family = model.families[0];
    expect(family.familyName).toBe('Berries');
    expect(family.sections.curado[0].values['2026-03-12']).toBe(99);
    expect(family.sections.balance[0].values['2026-03-12']).toBe(6);
    expect(family.sections.balance[0].values['2026-03-13']).toBe(7);
    expect(family.totals.totalProceso['2026-03-12']).toBe(2);
    expect(family.totals.totalHorasProceso['2026-03-12']).toBe(0.5);
  });
});
