import { useState } from 'react';
import { appConfig } from '../../app/config';
import { createApiClient } from '../../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

export const useHolidayEditor = ({
  holidays,
  setHolidays,
}) => {
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayError, setHolidayError] = useState(null);
  const [holidaySuccess, setHolidaySuccess] = useState(null);

  const getFecha = (item) => (typeof item === 'string' ? item : item?.fecha);

  const addHoliday = async ({ fecha, nombre = '' }) => {
    if (!fecha) {
      setHolidayError('Debes seleccionar una fecha.');
      return false;
    }

    const previous = [...holidays];
    setHolidaySaving(true);
    setHolidayError(null);
    setHolidaySuccess(null);

    setHolidays((current) => {
      const exists = current.some((item) => getFecha(item) === fecha);
      if (exists) return current;
      return [...current, { fecha, nombre }].sort((a, b) =>
        getFecha(a).localeCompare(getFecha(b)),
      );
    });

    try {
      await api.post('/feriados', { fecha, nombre });
      setHolidaySuccess(`Feriado ${fecha} guardado correctamente.`);
      return true;
    } catch (error) {
      setHolidays(previous);
      setHolidayError(error.message);
      return false;
    } finally {
      setHolidaySaving(false);
    }
  };

  const updateHoliday = async (fecha, nombre) => {
    const previous = [...holidays];
    setHolidaySaving(true);
    setHolidayError(null);
    setHolidaySuccess(null);

    setHolidays((current) =>
      current.map((item) =>
        getFecha(item) === fecha ? { fecha, nombre } : item,
      ),
    );

    try {
      await api.put(`/feriados/${fecha}`, { nombre });
      setHolidaySuccess(`Feriado ${fecha} actualizado correctamente.`);
      return true;
    } catch (error) {
      setHolidays(previous);
      setHolidayError(error.message);
      return false;
    } finally {
      setHolidaySaving(false);
    }
  };

  const deleteHoliday = async (fecha) => {
    const previous = [...holidays];
    setHolidaySaving(true);
    setHolidayError(null);
    setHolidaySuccess(null);

    setHolidays((current) => current.filter((item) => getFecha(item) !== fecha));

    try {
      await api.delete(`/feriados/${fecha}`);
      setHolidaySuccess(`Feriado ${fecha} eliminado correctamente.`);
      return true;
    } catch (error) {
      setHolidays(previous);
      setHolidayError(error.message);
      return false;
    } finally {
      setHolidaySaving(false);
    }
  };

  return {
    holidaySaving,
    holidayError,
    holidaySuccess,
    addHoliday,
    updateHoliday,
    deleteHoliday,
  };
};
