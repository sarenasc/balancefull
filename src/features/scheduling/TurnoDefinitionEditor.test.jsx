/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const mockConfig = {
  apiBaseUrl: 'http://172.20.20.5:4001/api',
};

const loadComponent = async ({ postImpl = vi.fn(), putImpl = vi.fn(), deleteImpl = vi.fn() } = {}) => {
  const apiClient = {
    get: vi.fn(),
    post: postImpl,
    put: putImpl,
    delete: deleteImpl,
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

  const module = await import('./TurnoDefinitionEditor');
  return { TurnoDefinitionEditor: module.TurnoDefinitionEditor, apiClient };
};

describe('TurnoDefinitionEditor', () => {
  it('creates a new shift and shows the success message', async () => {
    const created = {
      id: 2,
      nombre: 'Tarde',
      hora_inicio: '15:00:00',
      hora_fin: '23:00:00',
      colacion_inicio: null,
      colacion_fin: null,
      orden: 2,
      horas_extra: null,
      horas_extra_inicio: null,
    };
    const { TurnoDefinitionEditor, apiClient } = await loadComponent({
      postImpl: vi.fn().mockResolvedValue(created),
    });

    const Harness = () => {
      const [turnosDefinicion, setTurnosDefinicion] = useState([
        {
          id: 1,
          nombre: 'Manana',
          hora_inicio: '08:00:00',
          hora_fin: '16:00:00',
          orden: 1,
        },
      ]);
      return (
        <TurnoDefinitionEditor
          turnosDefinicion={turnosDefinicion}
          setTurnosDefinicion={setTurnosDefinicion}
        />
      );
    };

    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Nombre'), 'Tarde');
    await user.clear(screen.getByLabelText('Inicio'));
    await user.type(screen.getByLabelText('Inicio'), '15:00');
    await user.clear(screen.getByLabelText('Fin'));
    await user.type(screen.getByLabelText('Fin'), '23:00');
    await user.clear(screen.getByLabelText('Orden'));
    await user.type(screen.getByLabelText('Orden'), '2');
    await user.click(screen.getByRole('button', { name: 'Guardar turno' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/turnos-definicion', {
        nombre: 'Tarde',
        hora_inicio: '15:00:00',
        hora_fin: '23:00:00',
        colacion_inicio: null,
        colacion_fin: null,
        orden: 2,
        horas_extra: null,
        horas_extra_inicio: null,
      });
    });

    expect(screen.getByText('Turno Tarde guardado correctamente.')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
  });

  it('loads an existing shift into the form and updates it', async () => {
    const { TurnoDefinitionEditor, apiClient } = await loadComponent({
      putImpl: vi.fn().mockResolvedValue({ ok: true }),
    });

    const Harness = () => {
      const [turnosDefinicion, setTurnosDefinicion] = useState([
        {
          id: 1,
          nombre: 'Manana',
          hora_inicio: '08:00:00',
          hora_fin: '16:00:00',
          orden: 1,
        },
      ]);
      return (
        <TurnoDefinitionEditor
          turnosDefinicion={turnosDefinicion}
          setTurnosDefinicion={setTurnosDefinicion}
        />
      );
    };

    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const nameInput = screen.getByLabelText('Nombre');
    await user.clear(nameInput);
    await user.type(nameInput, 'Manana extendida');
    await user.click(screen.getByRole('button', { name: 'Actualizar turno' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/turnos-definicion/1', expect.objectContaining({
        nombre: 'Manana extendida',
      }));
    });

    expect(screen.getByText('Turno Manana extendida guardado correctamente.')).toBeInTheDocument();
    expect(screen.getByText('Manana extendida')).toBeInTheDocument();
  });
});
