/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const mockConfig = {
  apiBaseUrl: 'http://172.20.20.5:4001/api',
};

const loadComponent = async ({
  postImpl = vi.fn(),
  deleteImpl = vi.fn(),
  rows = [],
} = {}) => {
  const apiClient = {
    get: vi.fn(),
    post: postImpl,
    put: vi.fn(),
    delete: deleteImpl,
  };
  const readList = vi.fn().mockResolvedValue(rows);

  vi.doMock('../../app/config', () => ({
    appConfig: mockConfig,
  }));

  vi.doMock('../../services/api', async () => {
    const actual = await vi.importActual('../../services/api');
    return {
      ...actual,
      createApiClient: () => apiClient,
      readList,
    };
  });

  const module = await import('./ParametrosDiaEditor');
  return { ParametrosDiaEditor: module.default, apiClient, readList };
};

describe('ParametrosDiaEditor', () => {
  it('loads rows and saves a new daily override', async () => {
    const { ParametrosDiaEditor, apiClient, readList } = await loadComponent({
      postImpl: vi.fn().mockResolvedValue({ ok: true }),
      rows: [
        {
          id: 1,
          exportadora_id: 7,
          especie_id: 4,
          variedad: 'Royal',
          fecha: '2026-03-12',
          bins_por_hora: 18,
        },
      ],
    });

    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <ParametrosDiaEditor
        entities={[
          {
            id: 7,
            exportadora: 'Export A',
            especie: 'Manzana',
            especieId: 4,
            variedad: 'Royal',
          },
        ]}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => {
      expect(readList).toHaveBeenCalledWith(expect.any(Object), '/parametros-dia');
    });

    expect(screen.getByText('2026-03-12')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Exportadora'), '7');
    await user.type(screen.getByLabelText('Fecha'), '2026-03-15');
    await user.type(screen.getByLabelText('Bins por hora'), '24');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/parametros-dia', {
        exportadora_id: 7,
        especie_id: 4,
        variedad: 'Royal',
        fecha: '2026-03-15',
        bins_por_hora: 24,
      });
    });

    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText('Parametro del dia guardado correctamente.')).toBeInTheDocument();
  });

  it('edits and deletes an existing row', async () => {
    const { ParametrosDiaEditor, apiClient } = await loadComponent({
      deleteImpl: vi.fn().mockResolvedValue({ ok: true }),
      rows: [
        {
          id: 1,
          exportadora_id: 7,
          especie_id: 4,
          variedad: 'Royal',
          fecha: '2026-03-12',
          bins_por_hora: 18,
        },
      ],
    });

    vi.stubGlobal('confirm', vi.fn(() => true));

    const user = userEvent.setup();
    render(
      <ParametrosDiaEditor
        entities={[
          {
            id: 7,
            exportadora: 'Export A',
            especie: 'Manzana',
            especieId: 4,
            variedad: 'Royal',
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('2026-03-12')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: 'Editar' });
    await user.click(editButtons[0]);

    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-03-12');
    expect(screen.getByLabelText('Bins por hora')).toHaveValue(18);

    const deleteButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/parametros-dia/1');
    });

    expect(screen.getByText('Parametro del dia eliminado.')).toBeInTheDocument();
  });
});
