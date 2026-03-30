import { useMemo, useState } from 'react';
import { appConfig } from '../../app/config';
import { getCuradoReleaseDate } from '../../utils/date';

const apiUrl = appConfig.apiBaseUrl;

const saveCellBySection = async ({ section, entityId, temporadaId, date, value }) => {
  const endpointMap = {
    cosecha: '/datos/cosecha',
    curado: '/datos/curado',
    proceso: '/datos/proceso',
  };

  const endpoint = endpointMap[section];
  if (!endpoint) {
    throw new Error(`Sección no soportada: ${section}`);
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      exportadora_id: entityId,
      temporada_id: temporadaId,
      fecha: date,
      bins: value,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'No fue posible guardar la celda.');
  }

  return response.json().catch(() => ({}));
};

export const useOperationsEditor = ({
  entities,
  data,
  setData,
  temporadaId,
  curadoHoursConfig,
}) => {
  const [savingCell, setSavingCell] = useState(null);
  const [error, setError] = useState(null);

  const visibleEntities = useMemo(
    () => entities.filter((entity) => Number(entity.visibleLinea ?? 1) === 1),
    [entities],
  );

  const getBalanceBeforeDate = ({ entityId, date, useCurado }) => {
    const entityRows = data[entityId] || {};
    const dates = Object.keys(entityRows).sort();
    let balance = 0;

    for (const currentDate of dates) {
      if (currentDate >= date) break;
      const row = entityRows[currentDate] || {};
      balance += useCurado
        ? Number(row.curado || 0) - Number(row.proceso || 0)
        : Number(row.cosecha || 0) - Number(row.proceso || 0);
    }

    return balance;
  };


  const setDraftCell = ({ entityId, date, field, rawValue }) => {
    setData((current) => ({
      ...current,
      [entityId]: {
        ...current[entityId],
        [date]: {
          ...(current[entityId]?.[date] || { cosecha: 0, curado: 0, proceso: 0 }),
          [field]: rawValue === '' ? 0 : Number(rawValue),
        },
      },
    }));
  };

  const updateCell = async ({ entity, date, field, value, useCurado }) => {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue) || numericValue < 0) {
      setError('Solo se permiten números mayores o iguales a 0.');
      return false;
    }

    const previousSnapshot = structuredClone(data);

    if (field === 'proceso') {
      const row = data[entity.id]?.[date] || {};
      const baseBalance =
        getBalanceBeforeDate({
          entityId: entity.id,
          date,
          useCurado,
        }) +
        (useCurado ? Number(row.curado || 0) : Number(row.cosecha || 0));

      const nextBalance = baseBalance - numericValue;

      /*if (nextBalance < 0) {
        const ok = window.confirm(
          `El balance quedará negativo (${nextBalance}). ¿Deseas guardar de todas formas?`,
        );
        if (!ok) return false;
      }*/
    }

    setError(null);
    setSavingCell(`${field}_${entity.id}_${date}`);

    setData((current) => ({
      ...current,
      [entity.id]: {
        ...current[entity.id],
        [date]: {
          ...(current[entity.id]?.[date] || { cosecha: 0, curado: 0, proceso: 0 }),
          [field]: numericValue,
        },
      },
    }));

    try {
      await saveCellBySection({
        section: field,
        entityId: entity.id,
        temporadaId,
        date,
        value: numericValue,
      });

      if (field === 'cosecha' && useCurado) {
        const horasCurado = Number(curadoHoursConfig?.[entity.id] ?? entity.horas_curado ?? 48);
        const curadoFecha = getCuradoReleaseDate(date, horasCurado);

        if (curadoFecha) {
          await saveCellBySection({
            section: 'curado',
            entityId: entity.id,
            temporadaId,
            date: curadoFecha,
            value: numericValue,
          });

          setData((current) => ({
            ...current,
            [entity.id]: {
              ...current[entity.id],
              [curadoFecha]: {
                ...(current[entity.id]?.[curadoFecha] || { cosecha: 0, curado: 0, proceso: 0 }),
                curado: numericValue,
              },
            },
          }));
        }
      }

      return true;
    } catch (saveError) {
      setData(previousSnapshot);
      setError(saveError.message || `No se pudo guardar ${field}.`);
      return false;
    } finally {
      setSavingCell(null);
    }
  };

  return {
    visibleEntities,
    savingCell,
    error,
    setDraftCell,
    updateCell,
  };
};
