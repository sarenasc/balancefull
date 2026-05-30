import { useState } from 'react';
import { appConfig } from '../../app/config';
import { createApiClient, readList } from '../../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

const toEntityShape = (row, especies = []) => {
  const especie = especies.find((item) => Number(item.id) === Number(row.especie_id));
  return {
    id: Number(row.id),
    dbId: Number(row.id),
    exportadora: row.nombre,
    especie: row.especie || especie?.nombre || '',
    variedad: row.variedad || '',
    colorIdx: Number(row.color_idx || 0),
    especieId: row.especie_id == null ? null : Number(row.especie_id),
    visibleLinea: Number(row.visible_linea ?? row.visibleLinea ?? 1),
    label: [row.nombre, row.variedad].filter(Boolean).join(' '),
  };
};

export const useAdvancedConfigEditor = ({
  especies,
  entities,
  setEntities,
  familias,
}) => {
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(null);

  const [temporadasFamilia, setTemporadasFamilia] = useState([]);

  const clearStatus = () => {
    setAdminError(null);
    setAdminSuccess(null);
  };

  const loadTemporadas = async () => {
    try {
      const rows = await readList(api, '/temporadas-familia');
      setTemporadasFamilia(rows);
    } catch (_error) {
      setTemporadasFamilia([]);
    }
  };

  const saveTemporada = async (payload) => {
    setAdminSaving(true);
    clearStatus();

    try {
      const saved = await api.post('/temporadas-familia', {
        familia_id: Number(payload.familia_id),
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        activa: payload.activa === undefined ? 1 : (payload.activa ? 1 : 0),
      });

      const family = familias.find((item) => Number(item.id) === Number(payload.familia_id));
      const nextRow = {
        ...saved,
        familia_id: Number(payload.familia_id),
        familia_nombre: family?.nombre || saved?.familia_nombre || '—',
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        activa: 1,
      };

      setTemporadasFamilia((current) => {
        const exists = current.some((item) => Number(item.familia_id) === Number(payload.familia_id));
        if (exists) {
          return current.map((item) =>
            Number(item.familia_id) === Number(payload.familia_id)
              ? { ...item, ...nextRow }
              : item,
          );
        }
        return [...current, nextRow];
      });

      setAdminSuccess(`Temporada guardada para ${family?.nombre || 'la familia'}.`);
      return true;
    } catch (error) {
      setAdminError(error.message);
      return false;
    } finally {
      setAdminSaving(false);
    }
  };

  const createExportadora = async (payload) => {
    setAdminSaving(true);
    clearStatus();

    try {
      const saved = await api.post('/exportadoras', {
        nombre: payload.nombre,
        especie_id: payload.especie_id ? Number(payload.especie_id) : null,
        variedad: payload.variedad,
        color_idx: Number(payload.color_idx || 0),
        visible_linea: payload.visible_linea === undefined ? 1 : (payload.visible_linea ? 1 : 0),
      });

      const nextEntity = toEntityShape(saved, especies);
      setEntities((current) => [...current, nextEntity].sort((a, b) => a.exportadora.localeCompare(b.exportadora)));
      setAdminSuccess(`Exportadora ${nextEntity.exportadora} creada correctamente.`);
      return true;
    } catch (error) {
      setAdminError(error.message);
      return false;
    } finally {
      setAdminSaving(false);
    }
  };

  const updateExportadora = async (payload) => {
    setAdminSaving(true);
    clearStatus();

    const previous = [...entities];

    setEntities((current) =>
      current.map((item) =>
        Number(item.id) === Number(payload.id)
          ? {
              ...item,
              exportadora: payload.nombre,
              especieId: payload.especie_id ? Number(payload.especie_id) : null,
              especie: especies.find((species) => Number(species.id) === Number(payload.especie_id))?.nombre || '',
              variedad: payload.variedad || '',
              colorIdx: Number(payload.color_idx || 0),
              visibleLinea: payload.visible_linea ? 1 : 0,
              label: [payload.nombre, payload.variedad].filter(Boolean).join(' '),
            }
          : item,
      ),
    );

    try {
      await api.put(`/exportadoras/${payload.id}`, {
        nombre: payload.nombre,
        especie_id: payload.especie_id ? Number(payload.especie_id) : null,
        variedad: payload.variedad,
        color_idx: Number(payload.color_idx || 0),
        visible_linea: payload.visible_linea ? 1 : 0,
        activa: 1,
      });

      setAdminSuccess(`Exportadora ${payload.nombre} actualizada.`);
      return true;
    } catch (error) {
      setEntities(previous);
      setAdminError(error.message);
      return false;
    } finally {
      setAdminSaving(false);
    }
  };

  return {
    adminSaving,
    adminError,
    adminSuccess,
    temporadasFamilia,
    loadTemporadas,
    saveTemporada,
    createExportadora,
    updateExportadora,
    setAdminError,
    setAdminSuccess,
  };
};
