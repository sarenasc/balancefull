/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const mockConfig = {
  apiBaseUrl: 'http://172.20.20.5:4001/api',
  planningStart: '2026-03-12',
  planningDays: 3,
};

const loadHook = async ({ getImpl }) => {
  const apiClient = {
    get: vi.fn(getImpl),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  vi.doMock('../app/config', () => ({
    appConfig: mockConfig,
  }));

  vi.doMock('../services/api', async () => {
    const actual = await vi.importActual('../services/api');
    return {
      ...actual,
      createApiClient: () => apiClient,
    };
  });

  const module = await import('./usePlannerData');
  return { usePlannerData: module.usePlannerData, apiClient };
};

describe('usePlannerData', () => {
  it('loads snapshot data from the API', async () => {
    const apiResponses = {
      '/exportadoras': [
        {
          id: 7,
          nombre: 'Export A',
          especie: 'Manzana',
          variedad: 'Royal',
          color_idx: 2,
          especie_id: null,
          visible_linea: 1,
        },
      ],
      '/familias': [{ id: 1, nombre: 'Pomaceas', usa_curado: false, orden: 1 }],
      '/especies': [{ id: 4, nombre: 'Manzana', familia_id: 1 }],
      '/parametros-especie': [{ especie_id: 4, bins_por_hora: 22, horas_por_dia: 12, kg_por_bin: 350 }],
      '/configuracion': { bph: 18, hpd: 16, kpb: 460 },
      '/feriados': ['2026-03-15'],
      '/datos': {
        cosechas: [{ exportadora_id: 7, fecha: '2026-03-12', bins: 10 }],
        curado: [{ exportadora_id: 7, fecha: '2026-03-13', bins: 3 }],
        procesos: [{ exportadora_id: 7, fecha: '2026-03-12', bins: 6 }],
      },
      '/temporada': { id: 5 },
    };

    const { usePlannerData, apiClient } = await loadHook({
      getImpl: async (path) => {
        if (!(path in apiResponses)) {
          throw new Error(`Unexpected path: ${path}`);
        }
        return apiResponses[path];
      },
    });

    const { result } = renderHook(() => usePlannerData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.source).toBe('api');
    expect(result.current.error).toBeNull();
    expect(result.current.temporadaId).toBe(5);
    expect(result.current.dates).toEqual(['2026-03-12', '2026-03-13', '2026-03-14']);
    expect(result.current.entities[0]).toMatchObject({
      id: 7,
      especieId: 4,
      colorIdx: 2,
      visibleLinea: 1,
      label: 'Export A Royal',
    });
    expect(result.current.data[7]['2026-03-12']).toEqual({
      cosecha: 10,
      curado: 0,
      proceso: 6,
    });
    expect(result.current.data[7]['2026-03-13']).toEqual({
      cosecha: 0,
      curado: 3,
      proceso: 0,
    });
    expect(apiClient.get).toHaveBeenCalledTimes(8);
  });

  it('falls back to mock data when the API fails', async () => {
    const { usePlannerData } = await loadHook({
      getImpl: async () => {
        throw new Error('API down');
      },
    });

    const { result } = renderHook(() => usePlannerData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.source).toBe('mock');
    expect(result.current.error).toBe('API down');
    expect(result.current.entities.length).toBeGreaterThan(0);
  });
});
