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

const loadHook = async ({ postImpl = vi.fn() } = {}) => {
  const apiClient = {
    get: vi.fn(),
    post: postImpl,
    put: vi.fn(),
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

  const module = await import('./useOperationsEditor');
  return { useOperationsEditor: module.useOperationsEditor, apiClient };
};

describe('useOperationsEditor', () => {
  it('updates draft cells and exposes only visible entities', async () => {
    const data = {
      current: {
        1: { '2026-03-12': { cosecha: 1, curado: 0, proceso: 0 } },
      },
    };
    const { useOperationsEditor } = await loadHook();

    const { result } = renderHook(() =>
      useOperationsEditor({
        entities: [
          { id: 1, visibleLinea: 1, horas_curado: 48 },
          { id: 2, visibleLinea: 0, horas_curado: 48 },
        ],
        data: data.current,
        setData: buildStateSetter(data),
        temporadaId: 5,
        curadoHoursConfig: {},
      }),
    );

    expect(result.current.visibleEntities.map((item) => item.id)).toEqual([1]);

    act(() => {
      result.current.setDraftCell({
        entityId: 1,
        date: '2026-03-12',
        field: 'proceso',
        rawValue: '9',
      });
    });

    expect(data.current[1]['2026-03-12']).toEqual({
      cosecha: 1,
      curado: 0,
      proceso: 9,
    });
  });

  it('saves cosecha and mirrors curado when the family uses curado', async () => {
    const data = {
      current: {
        7: {
          '2026-03-12': { cosecha: 0, curado: 0, proceso: 0 },
          '2026-03-14': { cosecha: 0, curado: 0, proceso: 0 },
        },
      },
    };
    const postImpl = vi.fn().mockResolvedValue({ ok: true });
    const { useOperationsEditor, apiClient } = await loadHook({ postImpl });
    const entity = { id: 7, visibleLinea: 1, horas_curado: 48 };

    const { result } = renderHook(() =>
      useOperationsEditor({
        entities: [entity],
        data: data.current,
        setData: buildStateSetter(data),
        temporadaId: 5,
        curadoHoursConfig: { 7: 48 },
      }),
    );

    let saveOk;
    await act(async () => {
      saveOk = await result.current.updateCell({
        entity,
        date: '2026-03-12',
        field: 'cosecha',
        value: '12',
        useCurado: true,
      });
    });

    expect(saveOk).toBe(true);
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/datos/cosecha', {
      exportadora_id: 7,
      temporada_id: 5,
      fecha: '2026-03-12',
      bins: 12,
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/datos/curado', {
      exportadora_id: 7,
      temporada_id: 5,
      fecha: '2026-03-14',
      bins: 12,
    });
    expect(data.current[7]['2026-03-12'].cosecha).toBe(12);
    expect(data.current[7]['2026-03-14'].curado).toBe(12);
    expect(result.current.error).toBeNull();
  });

  it('rejects invalid values and rolls back on API failure', async () => {
    const data = {
      current: {
        7: {
          '2026-03-12': { cosecha: 3, curado: 0, proceso: 1 },
        },
      },
    };
    const postImpl = vi.fn().mockRejectedValue(new Error('save failed'));
    const { useOperationsEditor } = await loadHook({ postImpl });
    const entity = { id: 7, visibleLinea: 1, horas_curado: 48 };

    const { result } = renderHook(() =>
      useOperationsEditor({
        entities: [entity],
        data: data.current,
        setData: buildStateSetter(data),
        temporadaId: 5,
        curadoHoursConfig: {},
      }),
    );

    let invalid;
    await act(async () => {
      invalid = await result.current.updateCell({
        entity,
        date: '2026-03-12',
        field: 'proceso',
        value: '-1',
        useCurado: false,
      });
    });

    expect(invalid).toBe(false);
    expect(result.current.error).toContain('Solo se permiten numeros');

    let failed;
    await act(async () => {
      failed = await result.current.updateCell({
        entity,
        date: '2026-03-12',
        field: 'proceso',
        value: '4',
        useCurado: false,
      });
    });

    expect(failed).toBe(false);
    await waitFor(() => {
      expect(result.current.error).toBe('save failed');
    });
    expect(data.current[7]['2026-03-12']).toEqual({
      cosecha: 3,
      curado: 0,
      proceso: 1,
    });
  });
});
