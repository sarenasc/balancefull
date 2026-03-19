import { useMemo, useState } from 'react';
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
    throw new Error(message || 'Error en restricciones.');
  }

  return response.json().catch(() => ({}));
};

export const RestrictionTypeEditor = ({
  tiposRestriccion,
  setTiposRestriccion,
}) => {
  const [form, setForm] = useState({
    nombre: '',
    color: '#dc2626',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const orderedTypes = useMemo(
    () => [...tiposRestriccion].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
    [tiposRestriccion],
  );

  const saveTipo = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!form.nombre.trim()) {
        throw new Error('El nombre del tipo de restricción es obligatorio.');
      }

      const created = await requestJson('/tipos-restriccion', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          color: form.color || '#dc2626',
        }),
      });

      setTiposRestriccion((current) => {
        const exists = current.some((item) => Number(item.id) === Number(created.id));
        if (exists) {
          return current.map((item) =>
            Number(item.id) === Number(created.id) ? created : item,
          );
        }
        return [...current, created];
      });

      setSuccess(`Tipo de restricción ${form.nombre} guardado correctamente.`);
      setForm({
        nombre: '',
        color: '#dc2626',
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTipo = async (id) => {
    if (!window.confirm('¿Eliminar este tipo de restricción?')) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await requestJson(`/tipos-restriccion/${id}`, {
        method: 'DELETE',
      });

      setTiposRestriccion((current) =>
        current.filter((item) => Number(item.id) !== Number(id)),
      );

      setSuccess('Tipo de restricción eliminado correctamente.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Restricciones</p>
          <h2>Tipos de restricción</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}

      <div
        className="panel panel--compact"
        style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', alignItems: 'end' }}
      >
        <label>
          <div className="stat-label">Nombre</div>
          <input
            value={form.nombre}
            onChange={(event) =>
              setForm((current) => ({ ...current, nombre: event.target.value }))
            }
            style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label>
          <div className="stat-label">Color</div>
          <input
            type="color"
            value={form.color}
            onChange={(event) =>
              setForm((current) => ({ ...current, color: event.target.value }))
            }
            style={{ width: '100%', marginTop: '0.4rem', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}
          />
        </label>

        <button
          disabled={saving}
          onClick={saveTipo}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: '#0f62fe',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Guardar tipo
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Color</th>
              <th>Vista</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {orderedTypes.map((tipo) => (
              <tr key={tipo.id}>
                <td>{tipo.nombre}</td>
                <td>{tipo.color}</td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: `1px solid ${tipo.color}`,
                      color: tipo.color,
                      background: `${tipo.color}22`,
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    {tipo.nombre}
                  </span>
                </td>
                <td>
                  <button
                    disabled={saving}
                    onClick={() => deleteTipo(tipo.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
