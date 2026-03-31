import { useMemo, useState } from 'react';
import { appConfig } from '../../app/config';

const apiUrl = appConfig.apiBaseUrl;

const normalizeTime = (value) => {
  if (!value) return null;
  const clean = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(clean)) return `${clean}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean;
  return null;
};

const displayTime = (value) => {
  if (!value) return '—';

  const raw = String(value).trim();

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.substring(0, 5);

  if (raw.includes('T')) {
    const timePart = raw.split('T')[1] || '';
    return timePart.substring(0, 5);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && raw.includes(' ')) {
    const parts = raw.split(' ');
    if (parts[1]) return parts[1].substring(0, 5);
  }

  return raw.substring(0, 5);
};

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
    throw new Error(message || 'Error en turnos.');
  }

  return response.json().catch(() => ({}));
};

export const TurnoDefinitionEditor = ({
  turnosDefinicion,
  setTurnosDefinicion,
}) => {
  const [form, setForm] = useState({
    nombre: '',
    hora_inicio: '08:00',
    hora_fin: '17:00',
    colacion_inicio: '',
    colacion_fin: '',
    orden: 1,
    horas_extra: '',
    horas_extra_inicio: '',
  });

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const orderedTurnos = useMemo(
    () =>
      [...turnosDefinicion].sort(
        (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
      ),
    [turnosDefinicion],
  );

  const saveTurno = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        nombre: form.nombre,
        hora_inicio: normalizeTime(form.hora_inicio),
        hora_fin: normalizeTime(form.hora_fin),
        colacion_inicio: form.colacion_inicio ? normalizeTime(form.colacion_inicio) : null,
        colacion_fin: form.colacion_fin ? normalizeTime(form.colacion_fin) : null,
        orden: Number(form.orden || 0),
        horas_extra: form.horas_extra !== '' ? Number(form.horas_extra) : null,
        horas_extra_inicio: form.horas_extra_inicio !== '' ? Number(form.horas_extra_inicio) : null,
      };

      if (!payload.nombre.trim()) {
        throw new Error('El nombre del turno es obligatorio.');
      }

      if (!payload.hora_inicio || !payload.hora_fin) {
        throw new Error('hora_inicio y hora_fin son obligatorias.');
      }

      if (editingId) {
        await requestJson(`/turnos-definicion/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setTurnosDefinicion((current) =>
          current.map((item) =>
            Number(item.id) === Number(editingId) ? { ...item, ...payload } : item,
          ),
        );
        setEditingId(null);
      } else {
        const created = await requestJson('/turnos-definicion', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setTurnosDefinicion((current) => {
          const exists = current.some(
            (item) => String(item.nombre).trim().toUpperCase() === String(created.nombre).trim().toUpperCase(),
          );
          if (exists) {
            return current.map((item) =>
              String(item.nombre).trim().toUpperCase() === String(created.nombre).trim().toUpperCase()
                ? created
                : item,
            );
          }
          return [...current, created];
        });
      }

      setSuccess(`Turno ${payload.nombre} guardado correctamente.`);
      setForm({
        nombre: '',
        hora_inicio: '08:00',
        hora_fin: '17:00',
        colacion_inicio: '',
        colacion_fin: '',
        orden: (orderedTurnos.length || 0) + 1,
        horas_extra: '',
        horas_extra_inicio: '',
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTurno = async (id) => {
    if (!window.confirm('¿Eliminar este turno?')) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await requestJson(`/turnos-definicion/${id}`, {
        method: 'DELETE',
      });

      setTurnosDefinicion((current) =>
        current.filter((item) => Number(item.id) !== Number(id)),
      );

      setSuccess('Turno eliminado correctamente.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const editTurno = (turno) => {
    setEditingId(turno.id);
    setForm({
      nombre: turno.nombre || '',
      hora_inicio: displayTime(turno.hora_inicio),
      hora_fin: displayTime(turno.hora_fin),
      colacion_inicio: turno.colacion_inicio ? displayTime(turno.colacion_inicio) : '',
      colacion_fin: turno.colacion_fin ? displayTime(turno.colacion_fin) : '',
      orden: turno.orden ?? 0,
      horas_extra: turno.horas_extra != null ? String(turno.horas_extra) : '',
      horas_extra_inicio: turno.horas_extra_inicio != null ? String(turno.horas_extra_inicio) : '',
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      nombre: '',
      hora_inicio: '08:00',
      hora_fin: '17:00',
      colacion_inicio: '',
      colacion_fin: '',
      orden: (orderedTurnos.length || 0) + 1,
      horas_extra: '',
      horas_extra_inicio: '',
    });
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Turnos</p>
          <h2>Definición de turnos</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}

      <div
        className="panel panel--compact"
        style={{ marginBottom: '1rem', borderColor: editingId ? '#2563eb' : undefined }}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editingId ? 'Editar turno' : 'Nuevo turno'}</p>
            <h2>{editingId ? 'Modificar definición' : 'Crear definición'}</h2>
          </div>
          {editingId ? (
            <button onClick={cancelEdit} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
              Cancelar
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
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
            <div className="stat-label">Inicio</div>
            <input
              type="time"
              value={form.hora_inicio}
              onChange={(event) =>
                setForm((current) => ({ ...current, hora_inicio: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Fin</div>
            <input
              type="time"
              value={form.hora_fin}
              onChange={(event) =>
                setForm((current) => ({ ...current, hora_fin: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Colación inicio</div>
            <input
              type="time"
              value={form.colacion_inicio}
              onChange={(event) =>
                setForm((current) => ({ ...current, colacion_inicio: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Colación fin</div>
            <input
              type="time"
              value={form.colacion_fin}
              onChange={(event) =>
                setForm((current) => ({ ...current, colacion_fin: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Orden</div>
            <input
              type="number"
              min="0"
              value={form.orden}
              onChange={(event) =>
                setForm((current) => ({ ...current, orden: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Horas extra al final</div>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.horas_extra}
              onChange={(event) =>
                setForm((current) => ({ ...current, horas_extra: event.target.value }))
              }
              placeholder="ej. 2"
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Horas extra al inicio</div>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.horas_extra_inicio}
              onChange={(event) =>
                setForm((current) => ({ ...current, horas_extra_inicio: event.target.value }))
              }
              placeholder="ej. 2"
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <button
            disabled={saving}
            onClick={saveTurno}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: editingId ? '#2563eb' : '#0f62fe',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {editingId ? 'Actualizar turno' : 'Guardar turno'}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Colación</th>
              <th>H. extra inicio</th>
              <th>H. extra fin</th>
              <th>Orden</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {orderedTurnos.map((turno) => (
              <tr key={turno.id}>
                <td>{turno.nombre}</td>
                <td>{displayTime(turno.hora_inicio)}</td>
                <td>{displayTime(turno.hora_fin)}</td>
                <td>
                  {turno.colacion_inicio
                    ? `${displayTime(turno.colacion_inicio)} - ${displayTime(turno.colacion_fin)}`
                    : '—'}
                </td>
                <td>{turno.horas_extra_inicio != null ? `${turno.horas_extra_inicio}h` : '—'}</td>
                <td>{turno.horas_extra != null ? `${turno.horas_extra}h` : '—'}</td>
                <td>{turno.orden}</td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    disabled={saving}
                    onClick={() => editTurno(turno)}
                  >
                    Editar
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => deleteTurno(turno.id)}
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
