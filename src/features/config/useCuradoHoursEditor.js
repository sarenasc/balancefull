import { useState } from 'react';
import { appConfig } from '../../app/config';
import { createApiClient } from '../../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

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
      await api.put(`/curado-horas-config/${exportadoraId}`, {
        horas_curado: value,
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
