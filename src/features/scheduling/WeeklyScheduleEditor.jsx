import { useCallback, useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../app/config';
import { TurnoDeliverable } from './TurnoDeliverable';

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

const actionButtonStyle = {
  padding: '0.65rem 0.95rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const selectStyle = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
};

const ENTITY_PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#9333ea', '#65a30d',
  '#ea580c', '#0d9488', '#db2777', '#6366f1',
];

const getEntityColor = (entity) => {
  const idx = Number(entity?.colorIdx ?? entity?.color_idx ?? 0);
  return ENTITY_PALETTE[((idx % ENTITY_PALETTE.length) + ENTITY_PALETTE.length) % ENTITY_PALETTE.length];
};

const getEntityLabel = (entity) =>
  entity?.label || entity?.exportadora || entity?.nombre || `Exportadora ${entity?.id}`;

// Builds hourly display groups from a turno, respecting colacion as a natural break.
// Underlying 30-min slots are still used for DB storage; groups bundle them for display.
// Extra-hour groups (type:'extra') are prepended/appended when the turno has
// horas_extra_inicio / horas_extra configured.
const buildDisplayGroups = (turno, availableSlots) => {
  const start = toMinutes(turno.hora_inicio);
  let end = toMinutes(turno.hora_fin);
  if (end !== null && start !== null && end <= start) end += 1440;

  if (start === null || end === null) return [];

  let colStart = turno.colacion_inicio ? toMinutes(turno.colacion_inicio) : null;
  let colEnd = turno.colacion_fin ? toMinutes(turno.colacion_fin) : null;

  // Apply the same midnight-crossing adjustment as hora_fin.
  // Without this, a night turno (e.g. 20:00-04:00) with colación after midnight
  // (e.g. 01:00 → 60 min) would never match the cursor running from 1200 upward.
  if (colStart !== null && colStart < start) colStart += 1440;
  if (colEnd !== null && colStart !== null && colEnd <= colStart) colEnd += 1440;
  // Discard colación if it falls entirely outside the turno window
  if (colStart !== null && colStart >= end) { colStart = null; colEnd = null; }

  const extraInicioMin = Math.round(Number(turno.horas_extra_inicio || 0) * 60);
  const extraFinMin    = Math.round(Number(turno.horas_extra        || 0) * 60);

  const groups = [];
  const GROUP_MIN = 60;

  // ── PRE-WORK extra groups (before hora_inicio) ──
  if (extraInicioMin > 0) {
    let cur = start - extraInicioMin;
    while (cur < start) {
      const groupEnd = Math.min(cur + GROUP_MIN, start);
      const groupSlots = availableSlots.filter((slot) => {
        const m = toMinutes(slot);
        if (m === null) return false;
        let adj = m;
        if (adj < (start - extraInicioMin)) adj += 1440;
        return adj >= cur && adj < groupEnd;
      });
      groups.push({
        label: `${toHora(cur)}–${toHora(groupEnd)}`,
        startHora: toHora(cur),
        endHora: toHora(groupEnd),
        type: 'extra',
        slots: groupSlots,
      });
      cur = groupEnd;
    }
  }

  // ── Regular work groups ──
  let cursor = start;
  while (cursor < end) {
    let groupEnd;
    let type = 'work';

    if (colStart !== null && cursor === colStart) {
      groupEnd = colEnd ?? cursor + 45;
      type = 'colacion';
    } else if (colStart !== null && cursor < colStart && cursor + GROUP_MIN > colStart) {
      groupEnd = colStart;
    } else {
      groupEnd = Math.min(cursor + GROUP_MIN, end);
    }

    // Always cap at turno end so cursor never skips past the last work block
    if (groupEnd > end) groupEnd = end;

    const groupSlots = availableSlots.filter((slot) => {
      const m = toMinutes(slot);
      if (m === null) return false;
      let adj = m;
      if (adj < start) adj += 1440;
      return adj >= cursor && adj < groupEnd;
    });

    groups.push({
      label: `${toHora(cursor)}–${toHora(groupEnd)}`,
      startHora: toHora(cursor),
      endHora: toHora(groupEnd),
      type,
      slots: groupSlots,
    });

    cursor = groupEnd;
  }

  // ── POST-WORK extra groups (after hora_fin) ──
  if (extraFinMin > 0) {
    let cur = end;
    while (cur < end + extraFinMin) {
      const groupEnd = Math.min(cur + GROUP_MIN, end + extraFinMin);
      const groupSlots = availableSlots.filter((slot) => {
        const m = toMinutes(slot);
        if (m === null) return false;
        let adj = m;
        if (adj < start) adj += 1440;
        return adj >= cur && adj < groupEnd;
      });
      groups.push({
        label: `${toHora(cur)}–${toHora(groupEnd)}`,
        startHora: toHora(cur),
        endHora: toHora(groupEnd),
        type: 'extra',
        slots: groupSlots,
      });
      cur = groupEnd;
    }
  }

  return groups;
};

const getToolLabel = (tool) => {
  if (!tool) return 'Ninguno';
  if (tool.type === 'entity') return `Exportadora · ${getEntityLabel(tool.entity)}`;
  if (tool.type === 'restriction') return `Restricción · ${tool.restriction.nombre}`;
  if (tool.type === 'erase-entity') return 'Borrar exportadoras';
  if (tool.type === 'erase-restriction') return 'Borrar restricciones';
  return 'Ninguno';
};

const loadHtml2Canvas = () =>
  new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });

export const WeeklyScheduleEditor = ({
  turnosDefinicion,
  entities,
  tiposRestriccion,
  holidays = [],
  onAutoSaved,
}) => {
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = now.getFullYear();

  const [semana, setSemana] = useState(currentWeek);
  const [anio, setAnio] = useState(currentYear);
  const [rowsFromDb, setRowsFromDb] = useState([]);
  const [restrictionRowsFromDb, setRestrictionRowsFromDb] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [restricciones, setRestricciones] = useState({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [viewTurno, setViewTurno] = useState('all');
  const [copyMode, setCopyMode] = useState('day');
  const [copySourceDate, setCopySourceDate] = useState('');
  const [copyTargetDate, setCopyTargetDate] = useState('');
  const [copyTurnoId, setCopyTurnoId] = useState('');
  const [copyWeekSource, setCopyWeekSource] = useState(currentWeek > 1 ? currentWeek - 1 : currentWeek);
  const [copyWeekYear, setCopyWeekYear] = useState(currentYear);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [printExportadora, setPrintExportadora] = useState('all');
  const [dragItem, setDragItem] = useState(null);
  const [paintTool, setPaintTool] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDeliverable, setShowDeliverable] = useState(false);

  const dates = useMemo(() => getDatesForWeek(semana, anio), [semana, anio]);

  useEffect(() => {
    if (!dates.length) return;
    setCopySourceDate((current) => (current && dates.includes(current) ? current : dates[0]));
    setCopyTargetDate((current) => {
      if (current && dates.includes(current)) return current;
      return dates[1] || dates[0];
    });
  }, [dates]);

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

  useEffect(() => {
    if (!orderedTurnos.length) return;
    setCopyTurnoId((current) => current || String(orderedTurnos[0].id));
  }, [orderedTurnos]);

  const timeSlots = useMemo(() => {
    if (orderedTurnos.length === 0) return [];

    let minStart = null;
    let maxEnd = null;

    orderedTurnos.forEach((turno) => {
      const start = toMinutes(turno.hora_inicio);
      let end = toMinutes(turno.hora_fin);

      if (start == null || end == null) return;
      if (end <= start) end += 1440;

      const extraInicioMin = Math.round(Number(turno.horas_extra_inicio || 0) * 60);
      const extraFinMin    = Math.round(Number(turno.horas_extra        || 0) * 60);
      const effectiveStart = start - extraInicioMin;
      const effectiveEnd   = end   + extraFinMin;

      if (minStart == null || effectiveStart < minStart) minStart = effectiveStart;
      if (maxEnd == null   || effectiveEnd   > maxEnd  ) maxEnd   = effectiveEnd;
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

        const extraInicioMin = Math.round(Number(turno.horas_extra_inicio || 0) * 60);
        const extraFinMin    = Math.round(Number(turno.horas_extra        || 0) * 60);
        const effectiveStart = start - extraInicioMin;
        const effectiveEnd   = end   + extraFinMin;

        const slots = timeSlots.filter((slot) => {
          let value = toMinutes(slot);
          if (value == null) return false;
          if (value < effectiveStart) value += 1440;
          return value >= effectiveStart && value < effectiveEnd;
        });

        return { ...turno, slots };
      })
      .filter((turno) => turno.slots.length > 0);
  }, [orderedTurnos, timeSlots]);

  const visibleTurnoGroups = useMemo(() => {
    if (viewTurno === 'all') return groupedSlots;
    return groupedSlots.filter((turno) => String(turno.id) === String(viewTurno));
  }, [groupedSlots, viewTurno]);

  // Set of hora strings that belong to extra-hour groups (used to flag es_hora_extra on save)
  const extraSlotHoras = useMemo(() => {
    const set = new Set();
    groupedSlots.forEach((turno) => {
      buildDisplayGroups(turno, turno.slots).forEach((group) => {
        if (group.type === 'extra') {
          group.slots.forEach((h) => set.add(h));
        }
      });
    });
    return set;
  }, [groupedSlots]);

  const holidaySet = useMemo(() => {
    const normalize = (h) => {
      if (!h) return null;
      if (typeof h === 'string') return h.substring(0, 10);
      if (h?.fecha) return String(h.fecha).substring(0, 10);
      return null;
    };
    return new Set(holidays.map(normalize).filter(Boolean));
  }, [holidays]);

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

    if (silent) setRefreshing(true);

    try {
      const [rows, restrictionRows] = await Promise.all([
        requestJson(`/turnos?semana=${semana}&anio=${anio}`),
        requestJson(`/turnos-restricciones?semana=${semana}&anio=${anio}`),
      ]);

      hydrateWeek(rows, restrictionRows);
    } finally {
      if (silent) setRefreshing(false);
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
    const hasAssignment = Boolean(assignments[key]);
    const hasRestriction = Boolean(restricciones[key]);

    if (tool.type === 'entity' && hasRestriction) {
      setError('No se puede asignar una exportadora en una celda restringida. Borra primero la restricción.');
      return;
    }

    if (tool.type === 'restriction' && hasAssignment) {
      setError('No se puede aplicar una restricción sobre una celda con exportadora. Borra primero la exportadora.');
      return;
    }

    if (tool.type === 'entity') {
      setError(null);
      setAssignments((current) => ({ ...current, [key]: String(tool.entity.id) }));
      markDirty();
    }

    if (tool.type === 'restriction') {
      setError(null);
      setRestricciones((current) => ({
        ...current,
        [key]: { id: tool.restriction.id, nombre: tool.restriction.nombre, color: tool.restriction.color },
      }));
      markDirty();
    }

    if (tool.type === 'erase-entity') {
      setError(null);
      setAssignments((current) => { const next = { ...current }; delete next[key]; return next; });
      markDirty();
    }

    if (tool.type === 'erase-restriction') {
      setError(null);
      setRestricciones((current) => { const next = { ...current }; delete next[key]; return next; });
      markDirty();
    }
  };

  // Applies tool to all slots within a display group at once (no conflict check — overwrites).
  const applyToolToGroup = (tool, fecha, slots) => {
    if (!tool || !slots.length) return;
    setError(null);

    if (tool.type === 'entity') {
      setAssignments((current) => {
        const next = { ...current };
        slots.forEach((hora) => { next[`${fecha}_${hora}`] = String(tool.entity.id); });
        return next;
      });
      setRestricciones((current) => {
        const next = { ...current };
        slots.forEach((hora) => { delete next[`${fecha}_${hora}`]; });
        return next;
      });
      markDirty();
    }

    if (tool.type === 'restriction') {
      setRestricciones((current) => {
        const next = { ...current };
        slots.forEach((hora) => {
          next[`${fecha}_${hora}`] = { id: tool.restriction.id, nombre: tool.restriction.nombre, color: tool.restriction.color };
        });
        return next;
      });
      setAssignments((current) => {
        const next = { ...current };
        slots.forEach((hora) => { delete next[`${fecha}_${hora}`]; });
        return next;
      });
      markDirty();
    }

    if (tool.type === 'erase-entity') {
      setAssignments((current) => {
        const next = { ...current };
        slots.forEach((hora) => { delete next[`${fecha}_${hora}`]; });
        return next;
      });
      markDirty();
    }

    if (tool.type === 'erase-restriction') {
      setRestricciones((current) => {
        const next = { ...current };
        slots.forEach((hora) => { delete next[`${fecha}_${hora}`]; });
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
              es_hora_extra: extraSlotHoras.has(hora_inicio),
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
        onAutoSaved?.();
      } else {
        setSuccess('Calendario semanal y restricciones guardados correctamente.');
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }, [rowsFromDb, restrictionRowsFromDb, assignments, restricciones, semana, anio, loadWeek, extraSlotHoras]);

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

  const handleCopyPaste = () => {
    if (!copySourceDate || !copyTargetDate) {
      setError('Selecciona día origen y día destino.');
      return;
    }

    if (copySourceDate === copyTargetDate) {
      setError('El día origen y el día destino no pueden ser iguales.');
      return;
    }

    const slotsToCopy =
      copyMode === 'day'
        ? groupedSlots.flatMap((turno) => turno.slots)
        : groupedSlots.find((turno) => String(turno.id) === String(copyTurnoId))?.slots || [];

    if (!slotsToCopy.length) {
      setError('No se encontraron bloques para copiar con la selección actual.');
      return;
    }

    const nextAssignments = { ...assignments };
    const nextRestrictions = { ...restricciones };

    slotsToCopy.forEach((hora) => {
      const sourceKey = `${copySourceDate}_${hora}`;
      const targetKey = `${copyTargetDate}_${hora}`;

      const sourceAssignment = assignments[sourceKey];
      const sourceRestriction = restricciones[sourceKey];

      if (sourceAssignment) {
        nextAssignments[targetKey] = sourceAssignment;
      } else {
        delete nextAssignments[targetKey];
      }

      if (sourceRestriction) {
        nextRestrictions[targetKey] = sourceRestriction;
      } else {
        delete nextRestrictions[targetKey];
      }
    });

    setAssignments(nextAssignments);
    setRestricciones(nextRestrictions);
    setError(null);
    setSuccess(
      copyMode === 'day'
        ? 'Planificación del día copiada correctamente.'
        : 'Planificación del turno copiada correctamente.',
    );
    setDirty(true);
  };

  const handleCopyFullWeek = async () => {
    try {
      if (Number(copyWeekSource) === Number(semana) && Number(copyWeekYear) === Number(anio)) {
        setError('La semana origen no puede ser la misma semana destino.');
        return;
      }

      if (!window.confirm(`¿Copiar semana ${copyWeekSource}/${copyWeekYear} sobre la semana ${semana}/${anio}?`)) {
        return;
      }

      setError(null);
      setSuccess(null);
      setRefreshing(true);

      const [sourceRows, sourceRestrictions] = await Promise.all([
        requestJson(`/turnos?semana=${copyWeekSource}&anio=${copyWeekYear}`),
        requestJson(`/turnos-restricciones?semana=${copyWeekSource}&anio=${copyWeekYear}`),
      ]);

      const sourceDates = getDatesForWeek(Number(copyWeekSource), Number(copyWeekYear));
      const targetDates = getDatesForWeek(Number(semana), Number(anio));

      const nextAssignments = { ...assignments };
      const nextRestrictions = { ...restricciones };

      targetDates.forEach((targetDate) => {
        timeSlots.forEach((hora) => {
          delete nextAssignments[`${targetDate}_${hora}`];
          delete nextRestrictions[`${targetDate}_${hora}`];
        });
      });

      sourceRows.forEach((row) => {
        const sourceIndex = sourceDates.indexOf(row.fecha);
        if (sourceIndex < 0 || !targetDates[sourceIndex]) return;
        const targetDate = targetDates[sourceIndex];
        const hora = normalizeHora(row.hora_inicio);
        nextAssignments[`${targetDate}_${hora}`] = String(row.exportadora_id);
      });

      sourceRestrictions.forEach((row) => {
        const sourceIndex = sourceDates.indexOf(row.fecha);
        if (sourceIndex < 0 || !targetDates[sourceIndex]) return;
        const targetDate = targetDates[sourceIndex];
        const hora = normalizeHora(row.hora_inicio);
        nextRestrictions[`${targetDate}_${hora}`] = {
          id: row.tipo_restriccion_id,
          nombre: row.nombre,
          color: row.color,
        };
      });

      setAssignments(nextAssignments);
      setRestricciones(nextRestrictions);
      setDirty(true);
      setSuccess(`Semana ${copyWeekSource}/${copyWeekYear} copiada correctamente sobre la semana actual.`);
    } catch (copyError) {
      setError(copyError.message);
    } finally {
      setRefreshing(false);
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportImage = async () => {
    try {
      setExporting(true);
      setError(null);

      const html2canvas = await loadHtml2Canvas();
      const target = document.getElementById('weekly-schedule-print-area');
      if (!target) throw new Error('No se encontró el calendario para exportar.');

      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `calendario-semana-${semana}-${anio}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (exportError) {
      setError(exportError.message || 'No fue posible exportar la imagen.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="panel">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #weekly-schedule-print-area,
          #weekly-schedule-print-area * {
            visibility: visible !important;
          }

          #weekly-schedule-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 16px !important;
          }

          [data-no-print="true"] {
            display: none !important;
          }
        }
      `}</style>

      {/* ── BARRA PRINCIPAL ── */}
      <div
        data-no-print="true"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '0.75rem',
          padding: '0.6rem 0.75rem',
          border: '1px solid #dbe4f0',
          borderRadius: '12px',
          background: '#fff',
        }}
      >
        {/* Semana / Año */}
        <input
          type="number"
          min="1"
          max="53"
          value={semana}
          onChange={(event) => setSemana(Number(event.target.value || 1))}
          title="Semana"
          style={{ ...selectStyle, width: '80px' }}
        />
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>/</span>
        <input
          type="number"
          value={anio}
          onChange={(event) => setAnio(Number(event.target.value || new Date().getFullYear()))}
          title="Año"
          style={{ ...selectStyle, width: '90px' }}
        />

        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 0.25rem' }} />

        {/* Guardar / Limpiar */}
        <button
          disabled={saving}
          onClick={() => saveCalendar({ silent: false })}
          style={{ ...actionButtonStyle, background: '#2563eb', color: '#fff', border: 'none' }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button disabled={saving} onClick={clearWeek} style={{ ...actionButtonStyle, color: '#dc2626', borderColor: '#fca5a5' }}>
          Limpiar semana
        </button>

        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 0.25rem' }} />

        {/* Vista / Turnos */}
        <button
          type="button"
          onClick={() => setViewTurno('all')}
          style={{
            ...actionButtonStyle,
            borderColor: !showDeliverable && viewTurno === 'all' ? '#2563eb' : '#cbd5e1',
            background: !showDeliverable && viewTurno === 'all' ? '#eff6ff' : '#fff',
            color: !showDeliverable && viewTurno === 'all' ? '#2563eb' : '#0f172a',
          }}
        >
          Todos
        </button>
        {groupedSlots.map((turno) => (
          <button
            key={`view_${turno.id}`}
            type="button"
            onClick={() => { setShowDeliverable(false); setViewTurno(String(turno.id)); }}
            style={{
              ...actionButtonStyle,
              borderColor: !showDeliverable && String(viewTurno) === String(turno.id) ? '#2563eb' : '#cbd5e1',
              background: !showDeliverable && String(viewTurno) === String(turno.id) ? '#eff6ff' : '#fff',
              color: !showDeliverable && String(viewTurno) === String(turno.id) ? '#2563eb' : '#0f172a',
            }}
          >
            {turno.nombre}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowDeliverable((v) => !v)}
          style={{
            ...actionButtonStyle,
            background: showDeliverable ? '#1e293b' : '#fff',
            color: showDeliverable ? '#f8fafc' : '#0f172a',
            borderColor: showDeliverable ? '#1e293b' : '#cbd5e1',
          }}
        >
          {showDeliverable ? '← Editor' : 'Entregable'}
        </button>

        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 0.25rem' }} />

        {/* Filtro exportadora para imprimir */}
        <select
          data-no-print="true"
          value={printExportadora}
          onChange={(e) => setPrintExportadora(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid #dbe4f0', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}
        >
          <option value="all">Todas las exportadoras</option>
          {visibleEntities.map((entity) => (
            <option key={entity.id} value={String(entity.id)}>{getEntityLabel(entity)}</option>
          ))}
        </select>

        {/* Exportar */}
        <button type="button" onClick={handlePrint} style={actionButtonStyle}>Imprimir</button>
        <button type="button" onClick={handleExportImage} style={actionButtonStyle} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar PNG'}
        </button>

        {/* Sync indicator (inline) */}
        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: refreshing ? '#2563eb' : '#94a3b8', whiteSpace: 'nowrap' }}>
          {refreshing ? '↻ sync…' : lastSyncAt ? `sync ${lastSyncAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn" data-no-print="true">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok" data-no-print="true">{success}</div> : null}

      {/* ── PALETA + COPIAR (colapsable) ── */}
      <div
        data-no-print="true"
        style={{
          marginBottom: '0.75rem',
          border: '1px solid #dbe4f0',
          borderRadius: '12px',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Paleta de herramientas */}
        <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '0.25rem' }}>
            Pintar
          </span>

          {/* Chips exportadoras */}
          {visibleEntities.map((entity) => {
            const selected = paintTool?.type === 'entity' && String(paintTool?.entity?.id) === String(entity.id);
            const color = getEntityColor(entity);
            return (
              <div
                key={entity.id}
                draggable
                onDragStart={() => handleDragStart({ type: 'entity', entity })}
                onDragEnd={() => setDragItem(null)}
                onClick={() => beginPaint({ type: 'entity', entity })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '8px',
                  border: selected ? `2px solid ${color}` : `1px solid ${color}55`,
                  background: selected ? `${color}22` : '#f8fafc',
                  color: selected ? color : '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'grab',
                  userSelect: 'none',
                  gap: '0.3rem',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                {getEntityLabel(entity)}
              </div>
            );
          })}

          <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

          {/* Chips restricciones */}
          {tiposRestriccion.map((tipo) => {
            const selected = paintTool?.type === 'restriction' && String(paintTool?.restriction?.id) === String(tipo.id);
            return (
              <div
                key={tipo.id}
                draggable
                onDragStart={() => handleDragStart({ type: 'restriction', restriction: tipo })}
                onDragEnd={() => setDragItem(null)}
                onClick={() => beginPaint({ type: 'restriction', restriction: tipo })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '8px',
                  border: selected ? `2px solid ${tipo.color}` : `1px solid ${tipo.color}66`,
                  background: selected ? `${tipo.color}22` : `${tipo.color}0d`,
                  color: tipo.color,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tipo.color, flexShrink: 0 }} />
                {tipo.nombre}
              </div>
            );
          })}

          <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

          {/* Borrar */}
          <div
            onClick={() => beginPaint({ type: 'erase-entity' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.65rem', borderRadius: '8px',
              border: paintTool?.type === 'erase-entity' ? '2px solid #dc2626' : '1px dashed #fca5a5',
              background: paintTool?.type === 'erase-entity' ? '#fef2f2' : '#fff',
              color: '#dc2626', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none',
            }}
          >
            ✕ exp.
          </div>
          <div
            onClick={() => beginPaint({ type: 'erase-restriction' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.65rem', borderRadius: '8px',
              border: paintTool?.type === 'erase-restriction' ? '2px solid #dc2626' : '1px dashed #fca5a5',
              background: paintTool?.type === 'erase-restriction' ? '#fef2f2' : '#fff',
              color: '#dc2626', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none',
            }}
          >
            ✕ rest.
          </div>

          {paintTool ? (
            <>
              <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />
              <div style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 700 }}>
                ● {getToolLabel(paintTool)}
              </div>
              <button
                type="button"
                onClick={() => { setPaintTool(null); setIsPainting(false); }}
                style={{ ...actionButtonStyle, padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
              >
                Soltar
              </button>
            </>
          ) : null}
        </div>

        {/* Copiar: semana + día en una fila compacta */}
        <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '0.25rem' }}>
            Copiar
          </span>

          {/* Copiar semana */}
          <span style={{ fontSize: '0.78rem', color: '#475569' }}>Sem.</span>
          <input
            type="number" min="1" max="53"
            value={copyWeekSource}
            onChange={(event) => setCopyWeekSource(Number(event.target.value || 1))}
            title="Semana origen"
            style={{ ...selectStyle, width: '70px' }}
          />
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>/</span>
          <input
            type="number"
            value={copyWeekYear}
            onChange={(event) => setCopyWeekYear(Number(event.target.value || new Date().getFullYear()))}
            title="Año origen"
            style={{ ...selectStyle, width: '80px' }}
          />
          <button type="button" onClick={handleCopyFullWeek} style={actionButtonStyle}>
            Copiar semana
          </button>

          <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 0.1rem' }} />

          {/* Copiar día */}
          <select value={copyMode} onChange={(event) => setCopyMode(event.target.value)} style={{ ...selectStyle, width: 'auto' }}>
            <option value="day">Día completo</option>
            <option value="turno">Un turno</option>
          </select>
          {copyMode === 'turno' ? (
            <select value={copyTurnoId} onChange={(event) => setCopyTurnoId(event.target.value)} style={{ ...selectStyle, width: 'auto' }}>
              {groupedSlots.map((turno) => (
                <option key={`copy_turno_${turno.id}`} value={turno.id}>
                  {turno.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <select value={copySourceDate} onChange={(event) => setCopySourceDate(event.target.value)} style={{ ...selectStyle, width: 'auto' }}>
            {dates.map((date) => (
              <option key={`src_${date}`} value={date}>{formatDateLabel(date)}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>→</span>
          <select value={copyTargetDate} onChange={(event) => setCopyTargetDate(event.target.value)} style={{ ...selectStyle, width: 'auto' }}>
            {dates.map((date) => (
              <option key={`dst_${date}`} value={date}>{formatDateLabel(date)}</option>
            ))}
          </select>
          <button type="button" onClick={handleCopyPaste} style={actionButtonStyle}>
            Pegar
          </button>
        </div>
      </div>

      <div id="weekly-schedule-print-area">
        <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid #dbe4f0', borderRadius: '10px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase' }}>Programa semanal · </span>
            <strong style={{ color: '#0f172a' }}>Sem {semana} / {anio}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {showDeliverable ? 'Vista entregable' : viewTurno === 'all' ? 'Todos los turnos' : groupedSlots.find((t) => String(t.id) === String(viewTurno))?.nombre || 'Turno'}
          </div>
        </div>

        {showDeliverable ? (
          <TurnoDeliverable
            turnosDefinicion={turnosDefinicion}
            entities={visibleEntities}
            tiposRestriccion={tiposRestriccion}
            assignments={assignments}
            restricciones={restricciones}
            dates={dates}
            semana={semana}
            anio={anio}
            holidays={holidays}
          />
        ) : visibleTurnoGroups.length === 0 ? (
          <div style={compactPanelStyle}>
            No hay turnos definidos todavía. Crea al menos un turno antes de armar el calendario semanal.
          </div>
        ) : (
          visibleTurnoGroups.map((turno) => (
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

              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th style={{
                      border: '1px solid #dbe4f0', background: '#f1f5f9',
                      padding: '0.5rem 0.75rem', textAlign: 'left',
                      position: 'sticky', left: 0, zIndex: 2, width: '110px', minWidth: '110px',
                    }}>
                      Horario
                    </th>
                    {dates.map((date) => {
                      const d = new Date(`${date}T12:00:00`);
                      const isSun = d.getDay() === 0;
                      const isSat = d.getDay() === 6;
                      const isHoliday = holidaySet.has(date);
                      return (
                        <th key={date} style={{
                          border: `1px solid ${isHoliday ? '#efb0b0' : '#dbe4f0'}`,
                          background: isHoliday ? '#fef2f2' : isSun ? '#fef2f2' : isSat ? '#fff7ed' : '#f8fafc',
                          padding: '0.5rem 0.6rem', minWidth: '140px', textAlign: 'center',
                          color: isHoliday ? '#991b1b' : isSun ? '#991b1b' : isSat ? '#9a3412' : '#334155',
                        }}>
                          <div style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.82rem' }}>{formatDateLabel(date)}</div>
                          {isHoliday && <div style={{ fontSize: '0.65rem', color: '#991b1b', marginTop: '0.1rem' }}>Feriado</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {buildDisplayGroups(turno, turno.slots).map((group) => {
                    const isColacion = group.type === 'colacion';
                    const isExtra    = group.type === 'extra';
                    return (
                      <tr key={`${turno.id}_${group.startHora}`}>
                        {/* Time range label */}
                        <td style={{
                          border: isExtra ? '1px dashed #94a3b8' : '1px solid #dbe4f0',
                          background: isColacion ? '#fef9c3' : isExtra ? '#f8fafc' : '#f8fafc',
                          padding: '0.4rem 0.6rem',
                          position: 'sticky', left: 0, zIndex: 1,
                          verticalAlign: 'middle',
                        }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isColacion ? '#92400e' : isExtra ? '#94a3b8' : '#334155', lineHeight: 1.3 }}>
                            {group.startHora}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: isColacion ? '#b45309' : '#94a3b8' }}>
                            {group.endHora}
                          </div>
                          {isColacion && (
                            <div style={{ fontSize: '0.65rem', color: '#b45309', marginTop: '0.1rem' }}>☕ Colación</div>
                          )}
                          {isExtra && (
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>★ Extra</div>
                          )}
                        </td>

                        {dates.map((date) => {
                          // Collect unique entities and restrictions across all 30-min slots in this group
                          const entityIds = [...new Set(
                            group.slots.map((h) => assignments[`${date}_${h}`]).filter(Boolean)
                          )].filter((id) => printExportadora === 'all' || String(id) === printExportadora);
                          const restrictionsByKey = new Map();
                          group.slots.forEach((h) => {
                            const r = restricciones[`${date}_${h}`];
                            if (r) restrictionsByKey.set(r.id, r);
                          });
                          const uniqueRestrictions = [...restrictionsByKey.values()];

                          const hasEntity = entityIds.length > 0;
                          const hasRestriction = uniqueRestrictions.length > 0;
                          const firstEntityColor = hasEntity ? getEntityColor(entityMap.get(String(entityIds[0]))) : null;
                          const firstRestrColor = hasRestriction ? uniqueRestrictions[0].color : null;

                          const cellBg = isColacion
                            ? '#fffbeb'
                            : isExtra
                              ? hasRestriction
                                ? `${firstRestrColor}14`
                                : hasEntity
                                  ? `${firstEntityColor}0d`
                                  : '#f8fafc'
                              : hasRestriction
                                ? `${firstRestrColor}14`
                                : hasEntity
                                  ? `${firstEntityColor}0d`
                                  : '#fff';

                          return (
                            <td
                              key={`${date}_${group.startHora}`}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => { if (dragItem) { applyToolToGroup(dragItem, date, group.slots); setDragItem(null); } }}
                              onMouseDown={() => { if (paintTool) { setIsPainting(true); applyToolToGroup(paintTool, date, group.slots); } }}
                              onMouseEnter={() => { if (paintTool && isPainting) applyToolToGroup(paintTool, date, group.slots); }}
                              style={{
                                border: isExtra ? '1px dashed #94a3b8' : '1px solid #dbe4f0',
                                padding: '0.35rem 0.45rem',
                                verticalAlign: 'top',
                                background: cellBg,
                                cursor: paintTool ? 'crosshair' : 'default',
                                minHeight: isColacion ? '36px' : isExtra ? '40px' : '54px',
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {entityIds.map((id) => {
                                  const entity = entityMap.get(String(id));
                                  const color = getEntityColor(entity);
                                  return entity ? (
                                    <div key={id} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                      padding: '0.2rem 0.45rem', borderRadius: '6px',
                                      background: `${color}22`, color,
                                      border: `1px solid ${color}55`,
                                      fontSize: '0.74rem', fontWeight: 700,
                                    }}>
                                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                      {getEntityLabel(entity)}
                                      <button type="button" data-no-print="true"
                                        onClick={() => group.slots.forEach((h) => removeAssignment(date, h))}
                                        style={{ border: 'none', background: 'transparent', color, cursor: 'pointer', fontWeight: 800, padding: 0, lineHeight: 1 }}
                                      >×</button>
                                    </div>
                                  ) : null;
                                })}

                                {uniqueRestrictions.map((r) => (
                                  <div key={r.id} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    padding: '0.2rem 0.45rem', borderRadius: '6px',
                                    background: `${r.color}22`, color: r.color,
                                    border: `1px solid ${r.color}66`,
                                    fontSize: '0.74rem', fontWeight: 700,
                                  }}>
                                    ⚠ {r.nombre}
                                    <button type="button" data-no-print="true"
                                      onClick={() => group.slots.forEach((h) => removeRestriction(date, h))}
                                      style={{ border: 'none', background: 'transparent', color: r.color, cursor: 'pointer', fontWeight: 800, padding: 0, lineHeight: 1 }}
                                    >×</button>
                                  </div>
                                ))}

                                {!hasEntity && !hasRestriction && !isColacion && paintTool && (
                                  <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>+</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
