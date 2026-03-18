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
    throw new Error(message || 'No fue posible guardar configuración.');
  }

  return response.json().catch(() => ({}));
};

export const useConfigEditor = ({
  entities,
  setEntities,
  defaultParameters,
  setDefaultParameters,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const toggleVisibility = async (entity) => {
    const nextValue = Number(entity.visibleLinea ?? 1) === 1 ? 0 : 1;

    const previous = [...entities];
    setError(null);
    setSuccess(null);
    setSaving(true);

    setEntities((current) =>
      current.map((item) =>
        item.id === entity.id ? { ...item, visibleLinea: nextValue } : item,
      ),
    );

    try {
      await requestJson(`/exportadoras/${entity.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: entity.exportadora,
          especie: entity.especie,
          especie_id: entity.especieId,
          variedad: entity.variedad,
          color_idx: entity.colorIdx,
          visible_linea: nextValue,
          activa: 1,
        }),
      });
      setSuccess(`Visibilidad actualizada para ${entity.label}.`);
    } catch (saveError) {
      setEntities(previous);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultConfig = async (formValues) => {
    const payload = {
      bph: Number(formValues.bins_por_hora || 18),
      hpd: Number(formValues.horas_por_dia || 16),
      kpb: Number(formValues.kg_por_bin || 460),
    };

    const previous = { ...defaultParameters };

    setSaving(true);
    setError(null);
    setSuccess(null);

    setDefaultParameters({
      especie_id: null,
      bins_por_hora: payload.bph,
      horas_por_dia: payload.hpd,
      kg_por_bin: payload.kpb,
    });

    try {
      await requestJson('/configuracion', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Parámetros estándar guardados correctamente.');
    } catch (saveError) {
      setDefaultParameters(previous);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    error,
    success,
    toggleVisibility,
    saveDefaultConfig,
  };
};
