// TurnoDeliverable.jsx
// Vista entregable al cliente: programa semanal por exportadora con excepciones

const normalizeHora = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) return raw.split('T')[1].substring(0, 5);
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

const groupConsecutive = (slots) => {
  if (!slots.length) return [];
  const sorted = [...slots].sort();
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const prevMin = toMinutes(prev);
    const currMin = toMinutes(sorted[i]);
    const diff = prevMin !== null && currMin !== null ? currMin - prevMin : 9999;
    if (diff === 30) {
      prev = sorted[i];
    } else {
      const endMin = toMinutes(prev);
      groups.push({ start, end: endMin !== null ? toHora(endMin + 30) : prev });
      start = sorted[i];
      prev = sorted[i];
    }
  }
  const endMin = toMinutes(prev);
  groups.push({ start, end: endMin !== null ? toHora(endMin + 30) : prev });
  return groups;
};

const isColacionSlot = (hora, turno) => {
  if (!turno.colacion_inicio || !turno.colacion_fin) return false;
  const m = toMinutes(hora);
  const cs = toMinutes(normalizeHora(turno.colacion_inicio));
  const ce = toMinutes(normalizeHora(turno.colacion_fin));
  if (m == null || cs == null || ce == null) return false;
  return m >= cs && m < ce;
};

const formatDateHeader = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });

const getEntityLabel = (entity) =>
  entity?.label || entity?.exportadora || entity?.nombre || `Exportadora ${entity?.id}`;

// Calcula el programa de una exportadora para un día dado
const computeDayInfo = ({ entityId, date, groupedSlots, assignments, restricciones }) => {
  const blocks = [];

  groupedSlots.forEach((turno) => {
    // Slots del turno asignados a esta exportadora
    const mySlots = turno.slots.filter(
      (hora) => String(assignments[`${date}_${hora}`]) === String(entityId),
    );

    if (!mySlots.length) return;

    // Slots de colación dentro de los que tiene asignados
    const colacionSlots = mySlots.filter((hora) => isColacionSlot(hora, turno));

    // Restricciones que caen en slots del turno (NO asignados a esta exportadora, son del bloque)
    const restrictionInfo = turno.slots
      .filter((hora) => restricciones[`${date}_${hora}`])
      .map((hora) => ({ hora, restriction: restricciones[`${date}_${hora}`] }));

    const productiveMinutes = (mySlots.length - colacionSlots.length) * 30;

    blocks.push({
      turno,
      mySlots,
      colacionSlots,
      restrictionInfo,
      productiveMinutes,
      assignedRanges: groupConsecutive(mySlots),
      colacionRanges: groupConsecutive(colacionSlots),
    });
  });

  return blocks;
};

// Barra de timeline: todos los slots del turno coloreados
const TimelineBar = ({ turno, mySlots, colacionSlots, restrictionInfo, allTurnoSlots }) => {
  const restrictionMap = new Map(restrictionInfo.map((r) => [r.hora, r.restriction]));
  const mySet = new Set(mySlots);
  const colSet = new Set(colacionSlots);

  return (
    <div
      style={{
        display: 'flex',
        gap: '1px',
        borderRadius: '4px',
        overflow: 'hidden',
        height: '10px',
        marginTop: '0.3rem',
      }}
    >
      {allTurnoSlots.map((hora) => {
        const isRestriction = restrictionMap.has(hora);
        const isColacion = mySet.has(hora) && colSet.has(hora);
        const isMine = mySet.has(hora);
        const restriction = restrictionMap.get(hora);

        let bg = '#e2e8f0'; // gray: no asignado
        if (isRestriction) bg = restriction?.color || '#f97316';
        else if (isColacion) bg = '#fbbf24'; // amber: colación
        else if (isMine) bg = '#3b82f6'; // blue: productivo

        return (
          <div
            key={hora}
            title={
              isRestriction
                ? `${hora} · ${restriction?.nombre}`
                : isColacion
                  ? `${hora} · Colación`
                  : isMine
                    ? `${hora} · Producción`
                    : `${hora} · Sin asignar`
            }
            style={{
              flex: 1,
              background: bg,
              minWidth: '2px',
            }}
          />
        );
      })}
    </div>
  );
};

// Celda de un día para una exportadora
const DayCell = ({ blocks, isEmpty }) => {
  if (isEmpty || !blocks.length) {
    return (
      <td
        style={{
          border: '1px solid #e2e8f0',
          padding: '0.5rem',
          verticalAlign: 'top',
          background: '#f8fafc',
          minWidth: '110px',
          textAlign: 'center',
          color: '#cbd5e1',
          fontSize: '0.78rem',
        }}
      >
        —
      </td>
    );
  }

  return (
    <td
      style={{
        border: '1px solid #e2e8f0',
        padding: '0.5rem',
        verticalAlign: 'top',
        background: '#fff',
        minWidth: '110px',
      }}
    >
      {blocks.map((block, idx) => (
        <div key={idx} style={{ marginBottom: idx < blocks.length - 1 ? '0.5rem' : 0 }}>
          {/* Nombre del turno */}
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.15rem',
            }}
          >
            {block.turno.nombre}
          </div>

          {/* Rango asignado */}
          {block.assignedRanges.map((range, ri) => (
            <div
              key={ri}
              style={{
                display: 'inline-block',
                background: '#dbeafe',
                color: '#1d4ed8',
                borderRadius: '5px',
                padding: '0.15rem 0.4rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                marginBottom: '0.2rem',
              }}
            >
              {range.start} – {range.end}
            </div>
          ))}

          {/* Barra visual */}
          <TimelineBar
            turno={block.turno}
            mySlots={block.mySlots}
            colacionSlots={block.colacionSlots}
            restrictionInfo={block.restrictionInfo}
            allTurnoSlots={block.turno.slots}
          />

          {/* Colación configurada del turno */}
          {block.turno.colacion_inicio && block.turno.colacion_fin && (
            <div
              style={{
                marginTop: '0.3rem',
                background: '#fef9c3',
                border: '1px solid #fde68a',
                borderRadius: '5px',
                padding: '0.15rem 0.4rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#92400e',
              }}
            >
              ☕ {normalizeHora(block.turno.colacion_inicio)}–{normalizeHora(block.turno.colacion_fin)}
            </div>
          )}

          {/* Restricciones */}
          {block.restrictionInfo.length > 0 && (
            <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
              {block.restrictionInfo.map((r, ri) => (
                <div
                  key={ri}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: `${r.restriction.color}22`,
                    color: r.restriction.color,
                    border: `1px solid ${r.restriction.color}55`,
                    borderRadius: '4px',
                    padding: '0.1rem 0.3rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  ⚠ {r.hora} {r.restriction.nombre}
                </div>
              ))}
            </div>
          )}

          {/* Horas productivas */}
          <div
            style={{
              marginTop: '0.3rem',
              fontSize: '0.72rem',
              color: '#475569',
            }}
          >
            Prod:{' '}
            <strong style={{ color: '#0f172a' }}>
              {(block.productiveMinutes / 60).toFixed(1)} h
            </strong>
          </div>
        </div>
      ))}
    </td>
  );
};

export const TurnoDeliverable = ({
  turnosDefinicion,
  entities,
  tiposRestriccion,
  assignments,
  restricciones,
  dates,
  semana,
  anio,
  holidays = [],
}) => {
  const orderedTurnos = [...turnosDefinicion].sort(
    (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
  );

  // Construir timeSlots y groupedSlots igual que WeeklyScheduleEditor
  const timeSlots = (() => {
    if (!orderedTurnos.length) return [];
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
    for (let cur = minStart; cur < maxEnd; cur += 30) slots.push(toHora(cur));
    return slots;
  })();

  const groupedSlots = orderedTurnos
    .map((turno) => {
      const start = toMinutes(turno.hora_inicio);
      let end = toMinutes(turno.hora_fin);
      if (start == null || end == null) return { ...turno, slots: [] };
      if (end <= start) end += 1440;
      const slots = timeSlots.filter((slot) => {
        let v = toMinutes(slot);
        if (v == null) return false;
        if (v < start) v += 1440;
        return v >= start && v < end;
      });
      return { ...turno, slots };
    })
    .filter((t) => t.slots.length > 0);

  const holidaySet = (() => {
    const normalize = (h) => {
      if (!h) return null;
      if (typeof h === 'string') return h.substring(0, 10);
      if (h?.fecha) return String(h.fecha).substring(0, 10);
      return null;
    };
    return new Set((holidays || []).map(normalize).filter(Boolean));
  })();

  // Filtrar exportadoras con al menos una asignación en la semana
  const activeEntityIds = new Set(Object.values(assignments).map(String));
  const activeEntities = entities.filter(
    (e) => Number(e.visibleLinea ?? 1) === 1 && activeEntityIds.has(String(e.id)),
  );

  if (!activeEntities.length) {
    return (
      <div
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.9rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#f8fafc',
        }}
      >
        No hay exportadoras asignadas esta semana.
      </div>
    );
  }

  // Calcular totales semanales: horas productivas por exportadora
  const weeklyTotals = activeEntities.map((entity) => {
    let total = 0;
    dates.forEach((date) => {
      const blocks = computeDayInfo({
        entityId: entity.id,
        date,
        groupedSlots,
        assignments,
        restricciones,
      });
      blocks.forEach((b) => { total += b.productiveMinutes; });
    });
    return { entity, totalHours: total / 60 };
  });

  // Leyenda de restricciones presentes en la semana
  const activeRestrictionIds = new Set(
    Object.values(restricciones)
      .filter(Boolean)
      .map((r) => String(r.id)),
  );
  const activeRestrictions = tiposRestriccion.filter((t) =>
    activeRestrictionIds.has(String(t.id)),
  );

  const dateRange = dates.length
    ? `${new Date(`${dates[0]}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} – ${new Date(`${dates[dates.length - 1]}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : '';

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#fff',
        color: '#0f172a',
      }}
    >
      {/* Encabezado del documento */}
      <div
        style={{
          borderBottom: '2px solid #0f172a',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#64748b',
              marginBottom: '0.25rem',
            }}
          >
            Programa de producción
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
            Semana {semana} · {anio}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
            {dateRange}
          </div>
        </div>

        {/* Resumen semanal de horas */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {weeklyTotals.map(({ entity, totalHours }) => (
            <div
              key={entity.id}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {getEntityLabel(entity)}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.1rem' }}>
                {totalHours.toFixed(1)} h
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Turnos de la semana: horarios y colación */}
      {orderedTurnos.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          {orderedTurnos.map((turno) => {
            const inicio = normalizeHora(turno.hora_inicio);
            const fin = normalizeHora(turno.hora_fin);
            const colInicio = turno.colacion_inicio ? normalizeHora(turno.colacion_inicio) : null;
            const colFin = turno.colacion_fin ? normalizeHora(turno.colacion_fin) : null;
            return (
              <div
                key={turno.id}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.15rem' }}>
                  {turno.nombre}
                </div>
                <div style={{ color: '#475569' }}>
                  🕐 {inicio} – {fin}
                </div>
                {colInicio && colFin && (
                  <div style={{ color: '#92400e', marginTop: '0.1rem' }}>
                    ☕ Colación: {colInicio} – {colFin}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla por exportadora */}
      {activeEntities.map((entity) => {
        const dayBlocks = dates.map((date) =>
          computeDayInfo({
            entityId: entity.id,
            date,
            groupedSlots,
            assignments,
            restricciones,
          }),
        );

        const entityTotalHours = dayBlocks.reduce(
          (sum, blocks) => sum + blocks.reduce((s, b) => s + b.productiveMinutes, 0),
          0,
        ) / 60;

        return (
          <div
            key={entity.id}
            style={{
              marginBottom: '1.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header de la exportadora */}
            <div
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                padding: '0.65rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {getEntityLabel(entity)}
                </div>
                {entity.especie || entity.especie_nombre ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {entity.especie_nombre || entity.especie}
                    {entity.variedad ? ` · ${entity.variedad}` : ''}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  background: '#3b82f6',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.25rem 0.65rem',
                  fontWeight: 700,
                }}
              >
                {entityTotalHours.toFixed(1)} h totales
              </div>
            </div>

            {/* Tabla de días */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr>
                    {dates.map((date) => {
                      const d = new Date(`${date}T12:00:00`);
                      const isSun = d.getDay() === 0;
                      const isSat = d.getDay() === 6;
                      const isHoliday = holidaySet.has(date);
                      return (
                        <th
                          key={date}
                          style={{
                            border: `1px solid ${isHoliday ? '#efb0b0' : '#e2e8f0'}`,
                            padding: '0.5rem 0.6rem',
                            background: isHoliday ? '#fef2f2' : isSun ? '#fef2f2' : isSat ? '#fff7ed' : '#f8fafc',
                            textAlign: 'center',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: isHoliday ? '#991b1b' : isSun ? '#991b1b' : isSat ? '#9a3412' : '#334155',
                          }}
                        >
                          {formatDateHeader(date)}
                          {isHoliday && <div style={{ fontSize: '0.65rem', color: '#991b1b', marginTop: '0.1rem' }}>Feriado</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {dayBlocks.map((blocks, di) => (
                      <DayCell key={dates[di]} blocks={blocks} isEmpty={!blocks.length} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Tabla resumen: exportadoras × días (horas productivas) */}
      <div
        style={{
          marginTop: '1.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f1f5f9',
            padding: '0.65rem 1rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#334155',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          Resumen semanal · Horas productivas por exportadora
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr>
                <th
                  style={{
                    border: '1px solid #e2e8f0',
                    padding: '0.5rem 0.75rem',
                    background: '#f8fafc',
                    textAlign: 'left',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#475569',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Exportadora
                </th>
                {dates.map((date) => {
                  const d = new Date(`${date}T12:00:00`);
                  const isSun = d.getDay() === 0;
                  return (
                    <th
                      key={date}
                      style={{
                        border: '1px solid #e2e8f0',
                        padding: '0.5rem',
                        background: isSun ? '#fef2f2' : '#f8fafc',
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isSun ? '#991b1b' : '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDateHeader(date)}
                    </th>
                  );
                })}
                <th
                  style={{
                    border: '1px solid #e2e8f0',
                    padding: '0.5rem',
                    background: '#eff6ff',
                    textAlign: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#1d4ed8',
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {activeEntities.map((entity) => {
                let entityTotal = 0;
                return (
                  <tr key={entity.id}>
                    <td
                      style={{
                        border: '1px solid #e2e8f0',
                        padding: '0.5rem 0.75rem',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        whiteSpace: 'nowrap',
                        background: '#fff',
                      }}
                    >
                      {getEntityLabel(entity)}
                      {entity.variedad ? (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>
                          {entity.variedad}
                        </div>
                      ) : null}
                    </td>
                    {dates.map((date) => {
                      const blocks = computeDayInfo({
                        entityId: entity.id,
                        date,
                        groupedSlots,
                        assignments,
                        restricciones,
                      });
                      const dayMins = blocks.reduce((s, b) => s + b.productiveMinutes, 0);
                      entityTotal += dayMins;
                      const dayHours = dayMins / 60;
                      return (
                        <td
                          key={date}
                          style={{
                            border: '1px solid #e2e8f0',
                            padding: '0.5rem',
                            textAlign: 'center',
                            fontSize: '0.82rem',
                            color: dayHours > 0 ? '#1d4ed8' : '#cbd5e1',
                            fontWeight: dayHours > 0 ? 700 : 400,
                            background: '#fff',
                          }}
                        >
                          {dayHours > 0 ? `${dayHours.toFixed(1)} h` : '—'}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        border: '1px solid #e2e8f0',
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: '#1d4ed8',
                        background: '#eff6ff',
                      }}
                    >
                      {(entityTotal / 60).toFixed(1)} h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.75rem 1rem',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          background: '#f8fafc',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: '0.5rem' }}>
          Referencias
        </div>
        <LegendItem color="#3b82f6" label="Producción asignada" />
        <LegendItem color="#fbbf24" label="☕ Colación" />
        {activeRestrictions.map((r) => (
          <LegendItem key={r.id} color={r.color} label={`⚠ ${r.nombre}`} />
        ))}
        <LegendItem color="#e2e8f0" label="Sin asignar" textColor="#94a3b8" />
      </div>
    </div>
  );
};

const LegendItem = ({ color, label, textColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
    <div
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '3px',
        background: color,
        flexShrink: 0,
      }}
    />
    <span style={{ color: textColor || '#475569' }}>{label}</span>
  </div>
);
