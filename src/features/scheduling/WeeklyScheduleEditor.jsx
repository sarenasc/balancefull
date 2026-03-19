import { useCallback, useEffect, useMemo, useState } from 'react';
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

const toMinutes = (value) => {
  const hora = normalizeHora(value);
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const toHora = (minutes) => {
  const safe = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

const cardStyle = {
  border: '1px solid #dbe4f0',
  borderRadius: '12px',
  background: '#fff',
};

const compactPanelStyle = {
  ...cardStyle,
  padding: '1rem',
  marginBottom: '1rem',
};

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.28rem 0.55rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const dragCardStyle = {
  padding: '0.65rem 0.8rem',
  borderRadius: '12px',
  cursor: 'grab',
  border: '1px solid #cbd5e1',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  userSelect: 'none',
};

const eraseCardStyle = {
  ...dragCardStyle,
  cursor: 'pointer',
  borderStyle: 'dashed',
};

const getEntityLabel = (entity) =>
  entity?.label || entity?.exportadora || entity?.nombre || `Exportadora ${entity?.id}`;

const getToolLabel = (tool) => {
  if (!tool) return 'Ninguno';
  if (tool.type === 'entity') return `Exportadora · ${getEntityLabel(tool.entity)}`;
  if (tool.type === 'restriction') return `Restricción · ${tool.restriction.nombre}`;
  if (tool.type === 'erase-entity') return 'Borrar exportadoras';
  if (tool.type === 'erase-restriction') return 'Borrar restricciones';
  return 'Ninguno';
};

export const WeeklyScheduleEditor = ({
  turnosDefinicion,
  entities,
  tiposRestriccion,
}) => {
  const now = new Date();
  const [semana, setSemana] = useState(getWeekNumber(now));
  const [anio, setAnio] = useState(now.getFullYear());
  const [rowsFromDb, setRowsFromDb] = useState([]);
  const [restrictionRowsFromDb, setRestrictionRowsFromDb] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [restricciones, setRestricciones] = useState({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [paintTool, setPaintTool] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const dates = useMemo(() => getDatesForWeek(semana, anio), [semana, anio]);

  const visibleEntities = useMemo(
    () => entities.filter((entity) => Number(entity.visibleLinea ?? 1) === 1),
    [entities],
  );

  const entityMap = useMemo(
    () => new Map(visibleEntities.map((entity) => [String(entity.id), entity])),
    [visibleEntities],
  );

  const orderedTurnos = useMemo(
    () =>
      [...turnosDefinicion].sort(
        (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
      ),
    [turnosDefinicion],
  );

  const timeSlots = useMemo(() => {
    if (orderedTurnos.length === 0) return [];

    let minStart = null;
    let maxEnd = null;

    orderedTurnos.forEach((turno) => {
      const start = toMinutes(turno.hora_inicio);
      let end = toMinutes(turno.hora_fin);

      if (start == null || end == null) return;
      if (end <= start) end += 1440;

      if (minStart == null || start < minStart) minStart = start;
      if (maxEnd == null || end > maxEnd) maxEnd = end;
    });

    if (minStart == null || maxEnd == null) return [];

    const slots = [];
    for (let current = minStart; current < maxEnd; current += 30) {
      slots.push(toHora(current));
    }

    return slots;
  }, [orderedTurnos]);

  const groupedSlots = useMemo(() => {
    return orderedTurnos
      .map((turno) => {
        const start = toMinutes(turno.hora_inicio);
        let end = toMinutes(turno.hora_fin);

        if (start == null || end == null) {
          return { ...turno, slots: [] };
        }

        if (end <= start) end += 1440;

        const slots = timeSlots.filter((slot) => {
          let value = toMinutes(slot);
          if (value == null) return false;
          if (value < start) value += 1440;
          return value >= start && value < end;
        });

        return { ...turno, slots };
      })
      .filter((turno) => turno.slots.length > 0);
  }, [orderedTurnos, timeSlots]);

  const hydrateWeek = useCallback((rows, restrictionRows) => {
    setRowsFromDb(rows);
    setRestrictionRowsFromDb(restrictionRows);

    const nextAssignments = {};
    rows.forEach((row) => {
      const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
      nextAssignments[key] = String(row.exportadora_id);
    });
    setAssignments(nextAssignments);

    const nextRestrictions = {};
    restrictionRows.forEach((row) => {
      const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
      nextRestrictions[key] = {
        id: row.tipo_restriccion_id,
        nombre: row.nombre,
        color: row.color,
        dbId: row.id,
      };
    });
    setRestricciones(nextRestrictions);
    setDirty(false);
    setLastSyncAt(new Date());
  }, []);

  const loadWeek = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (silent) {
      setRefreshing(true);
    }

    try {
      const [rows, restrictionRows] = await Promise.all([
        requestJson(`/turnos?semana=${semana}&anio=${anio}`),
        requestJson(`/turnos-restricciones?semana=${semana}&anio=${anio}`),
      ]);

      hydrateWeek(rows, restrictionRows);
    } finally {
      if (silent) {
        setRefreshing(false);
      }
    }
  }, [semana, anio, hydrateWeek]);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setSuccess(null);
        await loadWeek();
      } catch (loadError) {
        setRowsFromDb([]);
        setRestrictionRowsFromDb([]);
        setAssignments({});
        setRestricciones({});
        setError(loadError.message);
      }
    };

    run();
  }, [loadWeek]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isPainting) {
        setIsPainting(false);
        setPaintTool(null);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isPainting]);

  useEffect(() => {
    if (dirty || saving || isPainting) return;

    const timer = window.setInterval(() => {
      loadWeek({ silent: true }).catch(() => {});
    }, 15000);

    return () => window.clearInterval(timer);
  }, [dirty, saving, isPainting, loadWeek]);

  useEffect(() => {
    const handleFocus = () => {
      if (dirty || saving || isPainting) return;
      loadWeek({ silent: true }).catch(() => {});
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [dirty, saving, isPainting, loadWeek]);

  const markDirty = () => {
    setDirty(true);
    setSuccess(null);
  };

  const applyToolToCell = (tool, fecha, hora) => {
    if (!tool) return;

    const key = `${fecha}_${hora}`;

    if (tool.type === 'entity') {
      setAssignments((current) => ({
        ...current,
        [key]: String(tool.entity.id),
      }));
      markDirty();
    }

    if (tool.type === 'restriction') {
      setRestricciones((current) => ({
        ...current,
        [key]: {
          id: tool.restriction.id,
          nombre: tool.restriction.nombre,
          color: tool.restriction.color,
        },
      }));
      markDirty();
    }

    if (tool.type === 'erase-entity') {
      setAssignments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      markDirty();
    }

    if (tool.type === 'erase-restriction') {
      setRestricciones((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      markDirty();
    }
  };

  const saveCalendar = useCallback(async (options = {}) => {
    const { silent = false } = options;

    try {
      setSaving(true);
      setError(null);
      if (!silent) setSuccess(null);

      const dbMap = {};
      rowsFromDb.forEach((row) => {
        const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
        dbMap[key] = row;
      });

      const dbRestrictionMap = {};
      restrictionRowsFromDb.forEach((row) => {
        const key = `${row.fecha}_${normalizeHora(row.hora_inicio)}`;
        dbRestrictionMap[key] = row;
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

      const dbRestrictionKeys = new Set(Object.keys(dbRestrictionMap));
      for (const key of dbRestrictionKeys) {
        const restriction = restricciones[key];
        if (!restriction) {
          await requestJson(`/turnos-restricciones/${dbRestrictionMap[key].id}`, {
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

      for (const [key, restriction] of Object.entries(restricciones)) {
        if (!restriction?.id) continue;

        const [fecha, hora_inicio] = key.split('_');
        const existing = dbRestrictionMap[key];

        if (!existing || String(existing.tipo_restriccion_id) !== String(restriction.id)) {
          await requestJson('/turnos-restricciones', {
            method: 'POST',
            body: JSON.stringify({
              fecha,
              hora_inicio,
              tipo_restriccion_id: Number(restriction.id),
              semana,
              anio,
            }),
          });
        }
      }

      await loadWeek({ silent: true });
      if (silent) {
        setSuccess('Cambios guardados automáticamente.');
      } else {
        setSuccess('Calendario semanal y restricciones guardados correctamente.');
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }, [rowsFromDb, restrictionRowsFromDb, assignments, restricciones, semana, anio, loadWeek]);

  useEffect(() => {
    if (!dirty || saving) return;

    const timer = window.setTimeout(() => {
      saveCalendar({ silent: true });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [dirty, saving, assignments, restricciones, saveCalendar]);

  const handleDragStart = (payload) => {
    setDragItem(payload);
  };

  const handleDrop = (fecha, hora) => {
    if (!dragItem) return;
    applyToolToCell(dragItem, fecha, hora);
    setDragItem(null);
  };

  const beginPaint = (tool) => {
    setPaintTool(tool);
    setIsPainting(false);
  };

  const startPaintingCell = (fecha, hora) => {
    if (!paintTool) return;
    setIsPainting(true);
    applyToolToCell(paintTool, fecha, hora);
  };

  const continuePaintingCell = (fecha, hora) => {
    if (!paintTool || !isPainting) return;
    applyToolToCell(paintTool, fecha, hora);
  };

  const removeAssignment = (fecha, hora) => {
    applyToolToCell({ type: 'erase-entity' }, fecha, hora);
  };

  const removeRestriction = (fecha, hora) => {
    applyToolToCell({ type: 'erase-restriction' }, fecha, hora);
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

      for (const row of restrictionRowsFromDb) {
        await requestJson(`/turnos-restricciones/${row.id}`, {
          method: 'DELETE',
        });
      }

      setRowsFromDb([]);
      setRestrictionRowsFromDb([]);
      setAssignments({});
      setRestricciones({});
      setDirty(false);
      setLastSyncAt(new Date());
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
        style={{
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: '180px 180px auto auto',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <label>
          <div className="stat-label">Semana</div>
          <input
            type="number"
            min="1"
            max="53"
            value={semana}
            onChange={(event) => setSemana(Number(event.target.value || 1))}
            style={{
              width: '100%',
              marginTop: '0.4rem',
              padding: '0.6rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        <label>
          <div className="stat-label">Año</div>
          <input
            type="number"
            value={anio}
            onChange={(event) => setAnio(Number(event.target.value || new Date().getFullYear()))}
            style={{
              width: '100%',
              marginTop: '0.4rem',
              padding: '0.6rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        <button
          disabled={saving}
          onClick={() => saveCalendar({ silent: false })}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: '#2563eb',
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

      <div style={{ ...compactPanelStyle, display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Sincronización</div>
          <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '0.2rem' }}>
            Se refresca sola cada 15 segundos y también al volver a la pestaña.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {refreshing ? 'Sincronizando…' : lastSyncAt ? `Última sync: ${lastSyncAt.toLocaleTimeString('es-CL')}` : 'Sin sincronización aún'}
          </div>
        </div>
      </div>

      <div style={{ ...compactPanelStyle, display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Modo pintar</div>
          <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '0.2rem' }}>
            Haz clic en una tarjeta y pinta varios bloques. Al soltar el mouse, la herramienta se desmarca sola.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {paintTool ? (
            <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700 }}>
              Activo: {getToolLabel(paintTool)}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Sin herramienta activa</div>
          )}

          <button
            type="button"
            onClick={() => {
              setPaintTool(null);
              setIsPainting(false);
            }}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Limpiar herramienta
          </button>
        </div>
      </div>

      <div style={{ ...compactPanelStyle }}>
        <div className="stat-label" style={{ marginBottom: '0.75rem' }}>
          Exportadoras
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          {visibleEntities.map((entity) => {
            const selected =
              paintTool?.type === 'entity' &&
              String(paintTool?.entity?.id) === String(entity.id);

            return (
              <div
                key={entity.id}
                draggable
                onDragStart={() => handleDragStart({ type: 'entity', entity })}
                onDragEnd={() => setDragItem(null)}
                onClick={() => beginPaint({ type: 'entity', entity })}
                style={{
                  ...dragCardStyle,
                  borderColor: selected ? '#2563eb' : '#cbd5e1',
                  boxShadow: selected ? '0 0 0 2px rgba(37,99,235,0.18)' : dragCardStyle.boxShadow,
                  background: selected ? '#eff6ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {getEntityLabel(entity)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  ID {entity.id}
                </div>
              </div>
            );
          })}

          <div
            onClick={() => beginPaint({ type: 'erase-entity' })}
            style={{
              ...eraseCardStyle,
              borderColor: paintTool?.type === 'erase-entity' ? '#dc2626' : '#fca5a5',
              background: paintTool?.type === 'erase-entity' ? '#fef2f2' : '#fff',
              color: '#dc2626',
            }}
          >
            <div style={{ fontWeight: 800 }}>Borrar exportadoras</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Pinta para limpiar asignaciones
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...compactPanelStyle }}>
        <div className="stat-label" style={{ marginBottom: '0.75rem' }}>
          Restricciones
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          {tiposRestriccion.map((tipo) => {
            const selected =
              paintTool?.type === 'restriction' &&
              String(paintTool?.restriction?.id) === String(tipo.id);

            return (
              <div
                key={tipo.id}
                draggable
                onDragStart={() => handleDragStart({ type: 'restriction', restriction: tipo })}
                onDragEnd={() => setDragItem(null)}
                onClick={() => beginPaint({ type: 'restriction', restriction: tipo })}
                style={{
                  ...dragCardStyle,
                  borderColor: tipo.color,
                  color: tipo.color,
                  background: selected ? `${tipo.color}26` : `${tipo.color}14`,
                  boxShadow: selected ? `0 0 0 2px ${tipo.color}33` : dragCardStyle.boxShadow,
                }}
              >
                <div style={{ fontWeight: 800 }}>{tipo.nombre}</div>
              </div>
            );
          })}

          <div
            onClick={() => beginPaint({ type: 'erase-restriction' })}
            style={{
              ...eraseCardStyle,
              borderColor: paintTool?.type === 'erase-restriction' ? '#dc2626' : '#fca5a5',
              background: paintTool?.type === 'erase-restriction' ? '#fef2f2' : '#fff',
              color: '#dc2626',
            }}
          >
            <div style={{ fontWeight: 800 }}>Borrar restricciones</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Pinta para limpiar restricciones
            </div>
          </div>
        </div>
      </div>

      {groupedSlots.length === 0 ? (
        <div style={compactPanelStyle}>
          No hay turnos definidos todavía. Crea al menos un turno antes de armar el calendario semanal.
        </div>
      ) : (
        groupedSlots.map((turno) => (
          <div
            key={turno.id}
            style={{ ...compactPanelStyle, overflowX: 'auto' }}
          >
            <div style={{ marginBottom: '0.75rem' }}>
              <div className="stat-label">{turno.nombre}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {normalizeHora(turno.hora_inicio)} - {normalizeHora(turno.hora_fin)}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1250px' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      border: '1px solid #dbe4f0',
                      background: '#f8fafc',
                      padding: '0.6rem',
                      textAlign: 'left',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                    }}
                  >
                    Hora
                  </th>
                  {dates.map((date) => (
                    <th
                      key={date}
                      style={{
                        border: '1px solid #dbe4f0',
                        background: '#f8fafc',
                        padding: '0.6rem',
                        minWidth: '165px',
                      }}
                    >
                      <div style={{ textTransform: 'capitalize' }}>{formatDateLabel(date)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {date}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {turno.slots.map((hora) => (
                  <tr key={`${turno.id}_${hora}`}>
                    <td
                      style={{
                        border: '1px solid #dbe4f0',
                        background: '#f8fafc',
                        padding: '0.6rem',
                        fontWeight: 700,
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                      }}
                    >
                      {hora}
                    </td>

                    {dates.map((date) => {
                      const key = `${date}_${hora}`;
                      const assignedId = assignments[key];
                      const assignedEntity = assignedId ? entityMap.get(String(assignedId)) : null;
                      const selectedRestriction = restricciones[key] || null;

                      return (
                        <td
                          key={key}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop(date, hora)}
                          onMouseDown={() => startPaintingCell(date, hora)}
                          onMouseEnter={() => continuePaintingCell(date, hora)}
                          style={{
                            border: '1px solid #dbe4f0',
                            padding: '0.5rem',
                            verticalAlign: 'top',
                            background: selectedRestriction?.color
                              ? `${selectedRestriction.color}16`
                              : isPainting
                                ? '#f8fafc'
                                : '#fff',
                            minHeight: '86px',
                            cursor: paintTool ? 'crosshair' : 'default',
                          }}
                        >
                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            {assignedEntity ? (
                              <div
                                style={{
                                  ...chipStyle,
                                  background: '#dbeafe',
                                  color: '#1d4ed8',
                                  border: '1px solid #93c5fd',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getEntityLabel(assignedEntity)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAssignment(date, hora)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#1d4ed8',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {paintTool?.type === 'entity'
                                  ? 'Mantén apretado y pinta bloques'
                                  : paintTool?.type === 'erase-entity'
                                    ? 'Pinta para borrar exportadoras'
                                    : 'Suelta o pinta una exportadora'}
                              </div>
                            )}

                            {selectedRestriction ? (
                              <div
                                style={{
                                  ...chipStyle,
                                  background: `${selectedRestriction.color}22`,
                                  color: selectedRestriction.color,
                                  border: `1px solid ${selectedRestriction.color}55`,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>{selectedRestriction.nombre}</span>
                                <button
                                  type="button"
                                  onClick={() => removeRestriction(date, hora)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: selectedRestriction.color,
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {paintTool?.type === 'restriction'
                                  ? 'Mantén apretado y pinta bloques'
                                  : paintTool?.type === 'erase-restriction'
                                    ? 'Pinta para borrar restricciones'
                                    : 'Suelta o pinta una restricción'}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
};
