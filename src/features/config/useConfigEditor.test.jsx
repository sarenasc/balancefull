/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.clearAllMocks();
});

const mockConfig = {
  apiBaseUrl: 'http://172.20.20.5:4001/api',
};

const buildStateSetter = (box) => (updater) => {
  box.current = typeof updater === 'function' ? updater(box.current) : updater;
};

const loadHook = async ({ putImpl = vi.fn(), postImpl = vi.fn() } = {}) => {
  const apiClient = {
    get: vi.fn(),
    post: postImpl,
    put: putImpl,
    delete: vi.fn(),
  };

  vi.doMock('../../app/config', () => ({
    appConfig: mockConfig,
  }));

  vi.doMock('../../services/api', async () => {
    const actual = await vi.importActual('../../services/api');
    return {
      ...actual,
      createApiClient: () => apiClient,
    };
  });

  const module = await import('./useConfigEditor');
  return { useConfigEditor: module.useConfigEditor, apiClient };
};

describe('useConfigEditor', () => {
  it('updates entity visibility optimistically and keeps the change on success', async () => {
    const entities = {
      current: [
        {
          id: 7,
          exportadora: 'Export A',
          especie: 'Manzana',
          especieId: 4,
          variedad: 'Royal',
          colorIdx: 2,
          visibleLinea: 1,
          label: 'Export A Royal',
        },
      ],
    };
    const defaultParameters = {
      current: { especie_id: null, bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460 },
    };
    const parametrosEspecie = { current: [] };
    const putImpl = vi.fn().mockResolvedValue({ ok: true });
    const { useConfigEditor, apiClient } = await loadHook({ putImpl });

    const { result } = renderHook(() =>
      useConfigEditor({
        entities: entities.current,
        setEntities: buildStateSetter(entities),
        defaultParameters: defaultParameters.current,
        setDefaultParameters: buildStateSetter(defaultParameters),
        parametrosEspecie: parametrosEspecie.current,
        setParametrosEspecie: buildStateSetter(parametrosEspecie),
      }),
    );

    await act(async () => {
      await result.current.toggleVisibility(entities.current[0]);
    });

    expect(apiClient.put).toHaveBeenCalledWith(
      '/exportadoras/7',
      expect.objectContaining({ visible_linea: 0 }),
    );
    expect(entities.current[0].visibleLinea).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.success).toContain('Visibilidad actualizada');
  });

  it('rolls back entity visibility when the API update fails', async () => {
    const entities = {
      current: [
        {
          id: 7,
          exportadora: 'Export A',
          especie: 'Manzana',
          especieId: 4,
          variedad: 'Royal',
          colorIdx: 2,
          visibleLinea: 1,
          label: 'Export A Royal',
        },
      ],
    };
    const defaultParameters = {
      current: { especie_id: null, bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460 },
    };
    const parametrosEspecie = { current: [] };
    const putImpl = vi.fn().mockRejectedValue(new Error('save failed'));
    const { useConfigEditor } = await loadHook({ putImpl });

    const { result } = renderHook(() =>
      useConfigEditor({
        entities: entities.current,
        setEntities: buildStateSetter(entities),
        defaultParameters: defaultParameters.current,
        setDefaultParameters: buildStateSetter(defaultParameters),
        parametrosEspecie: parametrosEspecie.current,
        setParametrosEspecie: buildStateSetter(parametrosEspecie),
      }),
    );

    await act(async () => {
      await result.current.toggleVisibility(entities.current[0]);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('save failed');
    });

    expect(entities.current[0].visibleLinea).toBe(1);
    expect(result.current.success).toBeNull();
  });

  it('saves default configuration and species parameters', async () => {
    const entities = { current: [] };
    const defaultParameters = {
      current: { especie_id: null, bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460 },
    };
    const parametrosEspecie = { current: [] };
    const putImpl = vi.fn().mockResolvedValue({ ok: true });
    const postImpl = vi.fn().mockResolvedValue({ ok: true });
    const { useConfigEditor, apiClient } = await loadHook({ putImpl, postImpl });

    const { result } = renderHook(() =>
      useConfigEditor({
        entities: entities.current,
        setEntities: buildStateSetter(entities),
        defaultParameters: defaultParameters.current,
        setDefaultParameters: buildStateSetter(defaultParameters),
        parametrosEspecie: parametrosEspecie.current,
        setParametrosEspecie: buildStateSetter(parametrosEspecie),
      }),
    );

    await act(async () => {
      await result.current.saveDefaultConfig({
        bins_por_hora: '21',
        horas_por_dia: '14',
        kg_por_bin: '380',
      });
    });

    await act(async () => {
      await result.current.saveSpeciesParams({
        especie: { id: 4, nombre: 'Manzana' },
        values: { bins_por_hora: '25', horas_por_dia: '15', kg_por_bin: '390' },
      });
    });

    expect(apiClient.put).toHaveBeenCalledWith('/configuracion', {
      bph: 21,
      hpd: 14,
      kpb: 380,
    });
    expect(apiClient.post).toHaveBeenCalledWith('/parametros-especie', {
      especie_id: 4,
      bins_por_hora: 25,
      horas_por_dia: 15,
      kg_por_bin: 390,
    });
    expect(defaultParameters.current).toEqual({
      especie_id: null,
      bins_por_hora: 21,
      horas_por_dia: 14,
      kg_por_bin: 380,
    });
    expect(parametrosEspecie.current[0]).toMatchObject({
      especie_id: 4,
      especie_nombre: 'Manzana',
      bins_por_hora: 25,
    });
  });
});
