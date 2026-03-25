import React, { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../app/config';

const apiUrl = appConfig.apiBaseUrl;

const inputStyle = {
  width: '100%',
  marginTop: '0.4rem',
  padding: '0.6rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
};

const buttonStyle = {
  padding: '0.55rem 0.8rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
};

export default function TemporadasEditor({ familias = [], setFamilias }) {
  const [forms, setForms] = useState({});
  const [savingById, setSavingById] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const initialMap = useMemo(
    () =>
      Object.fromEntries(
        familias.map((familia) => [
          Number(familia.id),
          {
            fecha_inicio: familia.fecha_inicio || '',
            fecha_fin: familia.fecha_fin || '',
          },
        ]),
      ),
    [familias],
  );

  useEffect(() => {
    setForms(initialMap);
  }, [initialMap]);

  const saveTemporada = async (familia) => {
    const values = forms[Number(familia.id)] || {};
    if (!values.fecha_inicio || !values.fecha_fin) {
      setError(`Debes ingresar inicio y fin para ${familia.nombre}.`);
      return;
    }

    setSavingById((current) => ({ ...current, [familia.id]: true }));
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/temporadas-familia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familia_id: Number(familia.id),
          fecha_inicio: values.fecha_inicio,
          fecha_fin: values.fecha_fin,
          activa: 1,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'No fue posible guardar la temporada.');
      }

      if (typeof setFamilias === 'function') {
        setFamilias((current) =>
          current.map((item) =>
            Number(item.id) === Number(familia.id)
              ? {
                  ...item,
                  fecha_inicio: values.fecha_inicio,
                  fecha_fin: values.fecha_fin,
                }
              : item,
          ),
        );
      }

      setMessage(`Temporada guardada para ${familia.nombre}.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingById((current) => ({ ...current, [familia.id]: false }));
    }
  };

  return (
    <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Temporadas</p>
          <h2>Ventana activa por familia</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {message ? <div className="status-banner status-banner--ok">{message}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Familia</th>
              <th>Usa curado</th>
              <th>Fecha inicio</th>
              <th>Fecha fin</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {familias.map((familia) => {
              const row = forms[Number(familia.id)] || { fecha_inicio: '', fecha_fin: '' };
              return (
                <tr key={familia.id}>
                  <td>{familia.nombre}</td>
                  <td>{familia.usa_curado ? 'Sí' : 'No'}</td>
                  <td>
                    <input
                      type="date"
                      value={row.fecha_inicio}
                      onChange={(event) =>
                        setForms((current) => ({
                          ...current,
                          [familia.id]: {
                            ...(current[familia.id] || {}),
                            fecha_inicio: event.target.value,
                          },
                        }))
                      }
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.fecha_fin}
                      onChange={(event) =>
                        setForms((current) => ({
                          ...current,
                          [familia.id]: {
                            ...(current[familia.id] || {}),
                            fecha_fin: event.target.value,
                          },
                        }))
                      }
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => saveTemporada(familia)}
                      disabled={Boolean(savingById[familia.id])}
                      style={buttonStyle}
                    >
                      {savingById[familia.id] ? 'Guardando...' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!familias.length ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                  No hay familias disponibles.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
