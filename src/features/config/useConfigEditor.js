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
  parametrosEspecie,
  setParametrosEspecie,
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
        method: 'PUT',
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

  const saveSpeciesParams = async ({ especie, values }) => {
    const payload = {
      especie_id: Number(especie.id),
      bins_por_hora: Number(values.bins_por_hora || 18),
      horas_por_dia: Number(values.horas_por_dia || 16),
      kg_por_bin: Number(values.kg_por_bin || 460),
    };

    const previous = [...parametrosEspecie];
    setSaving(true);
    setError(null);
    setSuccess(null);

    const nextRow = {
      especie_id: payload.especie_id,
      bins_por_hora: payload.bins_por_hora,
      horas_por_dia: payload.horas_por_dia,
      kg_por_bin: payload.kg_por_bin,
      especie_nombre: especie.nombre,
    };

    setParametrosEspecie((current) => {
      const withoutDefaults = current.filter((item) => item.especie_id != null);
      const exists = withoutDefaults.some(
        (item) => Number(item.especie_id) === Number(payload.especie_id),
      );

      if (exists) {
        return current.map((item) =>
          Number(item.especie_id) === Number(payload.especie_id)
            ? { ...item, ...nextRow }
            : item,
        );
      }

      return [...current, nextRow];
    });

    try {
      await requestJson('/parametros-especie', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(`Parámetros guardados para ${especie.nombre}.`);
    } catch (saveError) {
      setParametrosEspecie(previous);
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
    saveSpeciesParams,
  };
};
