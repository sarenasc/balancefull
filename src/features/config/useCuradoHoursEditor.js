import { useState } from 'react';
import { appConfig } from '../../app/config';

const apiUrl = appConfig.apiBaseUrl;

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Error guardando horas de curado.');
  }

  return response.json().catch(() => ({}));
};

export const useCuradoHoursEditor = ({
  curadoHoursConfig,
  setCuradoHoursConfig,
}) => {
  const [curadoSaving, setCuradoSaving] = useState(false);
  const [curadoError, setCuradoError] = useState(null);
  const [curadoSuccess, setCuradoSuccess] = useState(null);

  const saveCuradoHours = async ({ exportadoraId, horasCurado }) => {
    const value = Number(horasCurado || 48);
    const previous = { ...curadoHoursConfig };

    setCuradoSaving(true);
    setCuradoError(null);
    setCuradoSuccess(null);

    setCuradoHoursConfig((current) => ({
      ...current,
      [exportadoraId]: value,
    }));

    try {
      await requestJson(`/curado-horas-config/${exportadoraId}`, {
        method: 'PUT',
        body: JSON.stringify({
          horas_curado: value,
        }),
      });
      setCuradoSuccess(`Horas de curado guardadas para exportadora ${exportadoraId}.`);
      return true;
    } catch (error) {
      setCuradoHoursConfig(previous);
      setCuradoError(error.message);
      return false;
    } finally {
      setCuradoSaving(false);
    }
  };

  return {
    curadoSaving,
    curadoError,
    curadoSuccess,
    saveCuradoHours,
  };
};
