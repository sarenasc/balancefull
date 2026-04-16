import React, { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../app/config';
import { createApiClient, readList } from '../../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

const inputStyle = {
  width: '100%',
  marginTop: '0.4rem',
  padding: '0.6rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
};

const buttonPrimaryStyle = {
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: 'none',
  background: '#0f62fe',
  color: '#fff',
  cursor: 'pointer',
};

const buttonSecondaryStyle = {
  padding: '0.55rem 0.8rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
};

const normalizeDate = (value) => (value ? String(value).slice(0, 10) : '');

export default function ParametrosDiaEditor({ entities = [], onSaved = () => {} }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    exportadora_id: '',
    especie_id: '',
    variedad: '',
    fecha: '',
    bins_por_hora: '',
  });

  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [Number(entity.id), entity])),
    [entities],
  );

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const json = await readList(api, '/parametros-dia');
      setRows(json);
    } catch (loadError) {
      setError(loadError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const handleEntityChange = (value) => {
    const entity = entityMap.get(Number(value));
    setForm((current) => ({
      ...current,
      exportadora_id: value,
      especie_id: entity?.especieId ? String(entity.especieId) : '',
      variedad: entity?.variedad || '',
    }));
  };

  const resetForm = () => {
    setForm({
      exportadora_id: '',
      especie_id: '',
      variedad: '',
      fecha: '',
      bins_por_hora: '',
    });
  };

  const saveRow = async () => {
    if (!form.exportadora_id || !form.fecha || !form.bins_por_hora) {
      setError('Debes indicar exportadora, fecha y bins por hora.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api.post('/parametros-dia', {
        exportadora_id: Number(form.exportadora_id),
        especie_id: form.especie_id ? Number(form.especie_id) : null,
        variedad: form.variedad || '',
        fecha: form.fecha,
        bins_por_hora: Number(form.bins_por_hora),
      });

      setMessage('Parametro del dia guardado correctamente.');
      resetForm();
      await loadRows();
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editRow = (row) => {
    setForm({
      exportadora_id: String(row.exportadora_id ?? ''),
      especie_id: String(row.especie_id ?? ''),
      variedad: row.variedad || '',
      fecha: normalizeDate(row.fecha),
      bins_por_hora: String(row.bins_por_hora ?? ''),
    });
    setMessage('');
    setError('');
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Eliminar este parametro diario?')) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api.delete(`/parametros-dia/${id}`);
      setMessage('Parametro del dia eliminado.');
      await loadRows();
      onSaved();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Parametros dia</p>
          <h2>Override diario de bins por hora</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {message ? <div className="status-banner status-banner--ok">{message}</div> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr auto',
          gap: '0.75rem',
          alignItems: 'end',
          marginBottom: '1rem',
        }}
      >
        <label>
          <div className="stat-label">Exportadora</div>
          <select
            value={form.exportadora_id}
            onChange={(event) => handleEntityChange(event.target.value)}
            style={inputStyle}
          >
            <option value="">Selecciona exportadora</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.exportadora} · {entity.especie} {entity.variedad ? `· ${entity.variedad}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="stat-label">Fecha</div>
          <input
            type="date"
            value={form.fecha}
            onChange={(event) =>
              setForm((current) => ({ ...current, fecha: event.target.value }))
            }
            style={inputStyle}
          />
        </label>

        <label>
          <div className="stat-label">Bins por hora</div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.bins_por_hora}
            onChange={(event) =>
              setForm((current) => ({ ...current, bins_por_hora: event.target.value }))
            }
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={saveRow} disabled={saving} style={buttonPrimaryStyle}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          color: '#334155',
        }}
      >
        Si existe un registro para una exportadora en una fecha, ese <strong>bins por hora</strong>
        {' '}se usa solo ese dia para calcular las horas de proceso.
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Exportadora</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th>Fecha</th>
              <th>Bins/hora</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const entity = entityMap.get(Number(row.exportadora_id));
              return (
                <tr key={row.id}>
                  <td>{entity?.exportadora || row.exportadora_id}</td>
                  <td>{entity?.especie || row.especie_id || '-'}</td>
                  <td>{row.variedad || entity?.variedad || '-'}</td>
                  <td>{normalizeDate(row.fecha)}</td>
                  <td>{row.bins_por_hora}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => editRow(row)} style={buttonSecondaryStyle}>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        style={buttonSecondaryStyle}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>
                  No hay parametros diarios registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
