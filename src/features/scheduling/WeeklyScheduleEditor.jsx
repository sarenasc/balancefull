import { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../app/config';

const apiUrl = appConfig.apiBaseUrl;

const formatDateLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const getWeekNumber = (date) => {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
};

const getDatesForWeek = (week, year) => {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date.toISOString().split('T')[0];
  });
};

const normalizeHora = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) {
    return raw.split('T')[1].substring(0, 5);
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
    throw new Error(message || 'Error de calendario.');
  }

  return response.json().catch(() => ({}));
};

export const WeeklyScheduleEditor = ({
  turnosDefinicion,
  entities,
}) => {
  const now = new Date();
  const [semana, setSemana] = useState(getWeekNumber(now));
  const [anio, setAnio] = useState(now.getFullYear());
  const [rowsFromDb, setRowsFromDb] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const dates = useMemo(() => getDatesForWeek(semana, anio), [semana, anio]);

  const visibleEntities = useMemo(
    () => entities.filter((entity) => Number(entity.visibleLinea ?? 1) === 1),
    [entities],
  );

  const orderedTurnos = useMemo(
    () =>
      [...turnosDefinicion].sort(
        (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
      ),
    [turnosDefinicion],
  );

  const loadWeek = async () => {
    const rows = await requestJson(`/turnos?semana=${semana}&anio=${anio}`);
    setRowsFromDb(rows);

    const nextAssignments = {};
    rows.forEach((row) => {
      const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
      nextAssignments[key] = String(row.exportadora_id);
    });
    setAssignments(nextAssignments);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadWeek();
      } catch (loadError) {
        setRowsFromDb([]);
        setAssignments({});
        setError(loadError.message);
      }
    };

    run();
  }, [semana, anio]);

  const handleChangeAssignment = (fecha, hora, exportadoraId) => {
    const key = `${fecha}_${hora}`;
    setAssignments((current) => ({
      ...current,
      [key]: exportadoraId,
    }));
  };

  const saveCalendar = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const dbMap = {};
      rowsFromDb.forEach((row) => {
        const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
        dbMap[key] = row;
      });

      const dbKeys = new Set(Object.keys(dbMap));

      for (const key of dbKeys) {
        const assigned = assignments[key];
        if (!assigned) {
          await requestJson(`/turnos/${dbMap[key].id}`, {
            method: 'DELETE',
          });
        }
      }

      for (const [key, exportadoraId] of Object.entries(assignments)) {
        if (!exportadoraId) continue;

        const [fecha, hora_inicio] = key.split('_');
        const existing = dbMap[key];

        if (!existing || String(existing.exportadora_id) !== String(exportadoraId)) {
          await requestJson('/turnos', {
            method: 'POST',
            body: JSON.stringify({
              fecha,
              hora_inicio,
              exportadora_id: Number(exportadoraId),
              semana,
              anio,
            }),
          });
        }
      }

      await loadWeek();
      setSuccess('Calendario semanal guardado correctamente.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const clearWeek = async () => {
    if (!window.confirm(`¿Limpiar completamente la semana ${semana} del año ${anio}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      for (const row of rowsFromDb) {
        await requestJson(`/turnos/${row.id}`, {
          method: 'DELETE',
        });
      }

      setRowsFromDb([]);
      setAssignments({});
      setSuccess(`Semana ${semana}/${anio} limpiada correctamente.`);
    } catch (clearError) {
      setError(clearError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Turnos</p>
          <h2>Calendario semanal</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}

      <div
        className="panel panel--compact"
        style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '180px 180px auto auto', gap: '1rem', alignItems: 'end' }}
      >
        <label>
          <div className="stat-label">Semana</div>
          <input
            type="number"
            min="1"
            max="53"
            value={semana}
            onChange={(event) => setSemana(Number(event.target.value || 1))}
            style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label>
          <div className="stat-label">Año</div>
          <input
            type="number"
            value={anio}
            onChange={(event) => setAnio(Number(event.target.value || new Date().getFullYear()))}
            style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <button
          disabled={saving}
          onClick={saveCalendar}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: '#0f62fe',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar calendario'}
        </button>

        <button
          disabled={saving}
          onClick={clearWeek}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid #dc2626',
            background: '#fff',
            color: '#dc2626',
            cursor: 'pointer',
          }}
        >
          Limpiar semana
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Turno</th>
              {dates.map((date) => (
                <th key={date}>{formatDateLabel(date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedTurnos.map((turno) => {
              const hora = normalizeHora(turno.hora_inicio);

              return (
                <tr key={turno.id}>
                  <td>
                    <strong>{turno.nombre}</strong>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem' }}>
                      {normalizeHora(turno.hora_inicio)} - {normalizeHora(turno.hora_fin)}
                    </div>
                  </td>

                  {dates.map((date) => {
                    const key = `${date}_${hora}`;
                    const selected = assignments[key] || '';

                    return (
                      <td key={key}>
                        <select
                          value={selected}
                          onChange={(event) =>
                            handleChangeAssignment(date, hora, event.target.value)
                          }
                          style={{
                            width: '100%',
                            minWidth: '160px',
                            padding: '0.6rem',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {visibleEntities.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {entity.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
