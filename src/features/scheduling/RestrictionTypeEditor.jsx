import { useMemo, useState } from 'react';
import { appConfig } from '../../app/config';
import { createApiClient } from '../../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

export const RestrictionTypeEditor = ({
  tiposRestriccion,
  setTiposRestriccion,
}) => {
  const [form, setForm] = useState({
    nombre: '',
    color: '#dc2626',
  });

  const [editingId, setEditingId] = useState(null);
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
        throw new Error('El nombre del tipo de restriccion es obligatorio.');
      }

      if (editingId) {
        await api.put(`/tipos-restriccion/${editingId}`, {
          nombre: form.nombre.trim(),
          color: form.color || '#dc2626',
        });
        setTiposRestriccion((current) =>
          current.map((item) =>
            Number(item.id) === Number(editingId)
              ? { ...item, nombre: form.nombre.trim(), color: form.color || '#dc2626' }
              : item,
          ),
        );
        setEditingId(null);
      } else {
        const created = await api.post('/tipos-restriccion', {
          nombre: form.nombre.trim(),
          color: form.color || '#dc2626',
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
      }

      setSuccess(`Tipo de restriccion ${form.nombre} guardado correctamente.`);
      setForm({ nombre: '', color: '#dc2626' });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editTipo = (tipo) => {
    setEditingId(tipo.id);
    setForm({ nombre: tipo.nombre, color: tipo.color || '#dc2626' });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ nombre: '', color: '#dc2626' });
  };

  const deleteTipo = async (id) => {
    if (!window.confirm('Eliminar este tipo de restriccion?')) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/tipos-restriccion/${id}`);

      setTiposRestriccion((current) =>
        current.filter((item) => Number(item.id) !== Number(id)),
      );

      setSuccess('Tipo de restriccion eliminado correctamente.');
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
          <h2>Tipos de restriccion</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}

      <div
        className="panel panel--compact"
        style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: '1rem', alignItems: 'end', borderColor: editingId ? '#2563eb' : undefined }}
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
            background: editingId ? '#2563eb' : '#0f62fe',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {editingId ? 'Actualizar' : 'Guardar tipo'}
        </button>

        {editingId ? (
          <button
            disabled={saving}
            onClick={cancelEdit}
            style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Cancelar
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Color</th>
              <th>Vista</th>
              <th>Accion</th>
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
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    disabled={saving}
                    onClick={() => editTipo(tipo)}
                  >
                    Editar
                  </button>
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
