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
    throw new Error(message || 'Error de catálogo.');
  }

  return response.json().catch(() => ({}));
};

export const useCatalogEditor = ({
  familias,
  setFamilias,
  especies,
  setEspecies,
}) => {
  const [catalogError, setCatalogError] = useState(null);
  const [catalogSuccess, setCatalogSuccess] = useState(null);
  const [catalogSaving, setCatalogSaving] = useState(false);

  const createFamilia = async (payload) => {
    setCatalogSaving(true);
    setCatalogError(null);
    setCatalogSuccess(null);

    try {
      const created = await requestJson('/familias', {
        method: 'POST',
        body: JSON.stringify({
          nombre: payload.nombre,
          usa_curado: payload.usa_curado ? 1 : 0,
          orden: Number(payload.orden || 0),
        }),
      });

      setFamilias((current) =>
        [...current, { ...created, usa_curado: Boolean(created.usa_curado) }].sort(
          (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
        ),
      );

      setCatalogSuccess('Familia creada correctamente.');
      return true;
    } catch (error) {
      setCatalogError(error.message);
      return false;
    } finally {
      setCatalogSaving(false);
    }
  };

  const updateFamilia = async (familia) => {
    setCatalogSaving(true);
    setCatalogError(null);
    setCatalogSuccess(null);

    try {
      await requestJson(`/familias/${familia.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: familia.nombre,
          usa_curado: familia.usa_curado ? 1 : 0,
          orden: Number(familia.orden || 0),
        }),
      });

      setFamilias((current) =>
        current
          .map((item) =>
            Number(item.id) === Number(familia.id)
              ? { ...item, ...familia }
              : item,
          )
          .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0)),
      );

      setCatalogSuccess(`Familia ${familia.nombre} actualizada.`);
      return true;
    } catch (error) {
      setCatalogError(error.message);
      return false;
    } finally {
      setCatalogSaving(false);
    }
  };

  const createEspecie = async (payload) => {
    setCatalogSaving(true);
    setCatalogError(null);
    setCatalogSuccess(null);

    try {
      const created = await requestJson('/especies', {
        method: 'POST',
        body: JSON.stringify({
          nombre: payload.nombre,
          familia_id: Number(payload.familia_id),
        }),
      });

      setEspecies((current) => [...current, created]);
      setCatalogSuccess('Especie creada correctamente.');
      return true;
    } catch (error) {
      setCatalogError(error.message);
      return false;
    } finally {
      setCatalogSaving(false);
    }
  };

  const deleteEspecie = async (id) => {
    setCatalogSaving(true);
    setCatalogError(null);
    setCatalogSuccess(null);

    try {
      await requestJson(`/especies/${id}`, {
        method: 'DELETE',
      });

      setEspecies((current) => current.filter((item) => Number(item.id) !== Number(id)));
      setCatalogSuccess('Especie eliminada correctamente.');
      return true;
    } catch (error) {
      setCatalogError(error.message);
      return false;
    } finally {
      setCatalogSaving(false);
    }
  };

  return {
    catalogSaving,
    catalogError,
    catalogSuccess,
    createFamilia,
    updateFamilia,
    createEspecie,
    deleteEspecie,
  };
};
