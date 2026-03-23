const formatNumber = (value, digits = 0) => {
  const safe = Number(value || 0);
  return safe.toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatCellValue = (value, digits = 0) => {
  const safe = Number(value || 0);
  return safe === 0 ? '–' : formatNumber(safe, digits);
};

const formatDateLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const formatWeekLabel = (value) => {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `Sem ${week}`;
};

const normalizeHoliday = (holiday) => {
  if (!holiday) return null;
  if (typeof holiday === 'string') return holiday.slice(0, 10);
  if (typeof holiday === 'object') {
    return String(holiday.fecha || holiday.date || holiday.dia || '').slice(0, 10) || null;
  }
  return null;
};

const isSunday = (value) => new Date(`${value}T12:00:00`).getDay() === 0;
const isToday = (value) => value === new Date().toISOString().slice(0, 10);

const palette = {
  shell: '#0b1422',
  shellBorder: '#22324a',
  leftHeader: '#111c2b',
  leftCell: '#0f1825',
  leftCellAlt: '#132033',
  section: '#0a1320',
  total: '#101a29',
  totalStrong: '#07111e',
  totalHighlight: '#1b1329',
  dayCell: '#e9eef5',
  dayCellAlt: '#e3eaf4',
  dayBorder: '#c9d3e1',
  weekend: '#f7d8d8',
  today: '#c9ddfb',
  currentWeek: '#dae7fb',
  blocked: '#0d1524',
  negative: '#ffd3d3',
  positiveText: '#0f172a',
};

const leftCellBaseStyle = {
  border: `1px solid ${palette.shellBorder}`,
  padding: '0.5rem 0.65rem',
  background: palette.leftCell,
  color: '#f8fafc',
  whiteSpace: 'nowrap',
};

const stickyColumnStyle = (left, width, background = palette.leftCell) => ({
  position: 'sticky',
  left,
  zIndex: 4,
  width,
  minWidth: width,
  maxWidth: width,
  background,
  boxShadow: '1px 0 0 rgba(34,50,74,0.95)',
});

const getDateCellMeta = ({ date, holidaySet, currentWeekLabel }) => {
  const sunday = isSunday(date);
  const today = isToday(date);
  const holiday = holidaySet.has(date);
  const weekLabel = formatWeekLabel(date);
  const currentWeek = currentWeekLabel === weekLabel;

  let background = palette.dayCell;
  let color = '#1e293b';
  let borderColor = palette.dayBorder;

  if (currentWeek) {
    background = palette.currentWeek;
  }

  if (sunday || holiday) {
    background = palette.weekend;
    color = '#991b1b';
    borderColor = '#efb0b0';
  }

  if (today) {
    background = palette.today;
    color = '#1d4ed8';
    borderColor = '#8cb6f7';
  }

  return {
    sunday,
    today,
    holiday,
    currentWeek,
    weekLabel,
    background,
    color,
    borderColor,
  };
};

const getBodyCellStyle = (meta, { blocked = false, negative = false, total = false } = {}) => {
  let background = meta.background;
  let color = '#0f172a';

  if (total) {
    background = meta.currentWeek ? '#cfe0fa' : '#d7e4f7';
    color = '#0369a1';
  }

  if (blocked) {
    background = palette.blocked;
    color = '#93c5fd';
  }

  if (negative) {
    background = palette.negative;
    color = '#dc2626';
  }

  return {
    border: `1px solid ${meta.borderColor}`,
    padding: '0.48rem',
    textAlign: 'center',
    background,
    color,
    fontWeight: negative ? 800 : total ? 700 : 500,
    minWidth: '78px',
  };
};

const renderLeftInfoCells = (row, variant = 'normal') => {
  const alt = variant === 'alt';
  const background = alt ? palette.leftCellAlt : palette.leftCell;

  return (
    <>
      <td style={{ ...leftCellBaseStyle, ...stickyColumnStyle(0, 190, background), zIndex: 3 }}>
        {row.planta}
      </td>
      <td style={{ ...leftCellBaseStyle, ...stickyColumnStyle(190, 190, background), zIndex: 3 }}>
        {row.exportadora}
      </td>
      <td style={{ ...leftCellBaseStyle, ...stickyColumnStyle(380, 150, background), zIndex: 3 }}>
        {row.especie}
      </td>
    </>
  );
};

const renderRows = (rows, dates, holidaySet, currentWeekLabel, options = {}) => {
  const {
    showAutoHint = false,
    editable = false,
    family = null,
    entityMap = new Map(),
    setDraftCell,
    updateCell,
    savingCell,
    showHours = false,
  } = options;

  return rows.map((row, rowIndex) => (
    <tr key={`${row.field}_${row.entityId}`}>
      {renderLeftInfoCells(row, rowIndex % 2 === 0 ? 'normal' : 'alt')}

      {dates.map((date) => {
        const value = Number(row.values?.[date] || 0);
        const autoValue = Number(row.autoValues?.[date] || 0);
        const meta = getDateCellMeta({ date, holidaySet, currentWeekLabel });
        const key = `${row.field}_${row.entityId}_${date}`;
        const entity = entityMap.get(Number(row.entityId));

        return (
          <td key={key} style={getBodyCellStyle(meta)}>
            {editable && entity ? (
              <>
                <input
                  className="balance-input"
                  type="number"
                  min="0"
                  value={value}
                  onChange={(event) =>
                    setDraftCell?.({
                      entityId: row.entityId,
                      date,
                      field: row.field,
                      rawValue: event.target.value,
                    })
                  }
                  onBlur={(event) =>
                    updateCell?.({
                      entity,
                      date,
                      field: row.field,
                      value: event.target.value,
                      useCurado: Boolean(family?.usaCurado),
                    })
                  }
                  style={{
                    width: '100%',
                    minWidth: '64px',
                    padding: '0.35rem 0.2rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: savingCell === key ? 'rgba(59,130,246,0.14)' : 'transparent',
                    textAlign: 'center',
                    color: palette.positiveText,
                    fontWeight: 700,
                  }}
                />
                {showAutoHint && autoValue > 0 ? (
                  <div style={{ fontSize: '0.68rem', color: '#7c3aed', marginTop: '0.15rem' }}>
                    auto {formatNumber(autoValue)}
                  </div>
                ) : null}
                {showHours && value > 0 ? (
                  <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '0.15rem' }}>
                    editable
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div>{formatCellValue(value)}</div>
                {showAutoHint && autoValue > 0 ? (
                  <div style={{ fontSize: '0.68rem', color: '#7c3aed', marginTop: '0.15rem' }}>
                    auto {formatNumber(autoValue)}
                  </div>
                ) : null}
              </>
            )}
          </td>
        );
      })}
    </tr>
  ));
};

const renderTotalRow = ({
  label,
  dates,
  values,
  holidaySet,
  currentWeekLabel,
  digits = 0,
  leftLabelColor = '#38bdf8',
  valueColor = '#38bdf8',
  showZerosAsDash = true,
}) => (
  <tr>
    <td
      colSpan={3}
      style={{
        ...leftCellBaseStyle,
        ...stickyColumnStyle(0, 530, palette.totalStrong),
        zIndex: 2,
        fontWeight: 800,
        color: leftLabelColor,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </td>
    {dates.map((date) => {
      const meta = getDateCellMeta({ date, holidaySet, currentWeekLabel });
      const value = Number(values?.[date] || 0);
      return (
        <td
          key={`${label}_${date}`}
          style={{
            ...getBodyCellStyle(meta, { total: true }),
            color: valueColor,
            fontWeight: 800,
          }}
        >
          {showZerosAsDash ? formatCellValue(value, digits) : formatNumber(value, digits)}
        </td>
      );
    })}
  </tr>
);

const renderSectionRow = (label, dates) => (
  <tr>
    <td
      colSpan={3}
      style={{
        ...leftCellBaseStyle,
        ...stickyColumnStyle(0, 530, palette.section),
        zIndex: 2,
        color: '#f8fafc',
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </td>
    {dates.map((date) => (
      <td
        key={`section_${label}_${date}`}
        style={{
          border: `1px solid ${palette.shellBorder}`,
          background: palette.section,
          height: '28px',
        }}
      />
    ))}
  </tr>
);

export const BalanceFamilyTable = ({
  family,
  holidays = [],
  entityMap = new Map(),
  setDraftCell,
  updateCell,
  savingCell,
}) => {
  if (!family) return null;

  const { familyName, usaCurado, seasonStart, seasonEnd, dates, sections, totals } = family;
  const holidaySet = new Set(holidays.map(normalizeHoliday).filter(Boolean));
  const currentWeekLabel = formatWeekLabel(new Date().toISOString().slice(0, 10));

  return (
    <section
      className="panel"
      style={{
        padding: '1rem',
        borderRadius: '18px',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          marginBottom: '0.85rem',
          padding: '0.8rem 1rem',
          borderRadius: '14px',
          border: '1px solid #d6deeb',
          background: '#fdfefe',
        }}
      >
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.18em', color: '#2563eb', textTransform: 'uppercase' }}>
          Carga rápida en línea
        </div>
        <div style={{ marginTop: '0.5rem', color: '#475569', fontSize: '0.92rem' }}>
          Ventana visible de la familia activa: <strong>{seasonStart || '—'}</strong> a{' '}
          <strong>{seasonEnd || '—'}</strong>
        </div>
      </div>

      <div
        className="table-wrap balance-grid-shell"
        style={{
          overflowX: 'auto',
          borderRadius: '16px',
          border: `1px solid ${palette.shellBorder}`,
          background: palette.shell,
        }}
      >
        <table
          style={{
            minWidth: `${530 + dates.length * 78}px`,
            borderCollapse: 'separate',
            borderSpacing: 0,
            width: '100%',
            fontSize: '0.9rem',
          }}
        >
          <thead>
            <tr>
              <th
                colSpan={3}
                style={{
                  ...leftCellBaseStyle,
                  ...stickyColumnStyle(0, 530, palette.leftHeader),
                  zIndex: 6,
                  color: '#94a3b8',
                  textTransform: 'none',
                  letterSpacing: '0.04em',
                }}
              >
                Familia activa: <span style={{ color: '#f8fafc' }}>{familyName}</span>
              </th>
              {dates.map((date) => {
                const meta = getDateCellMeta({ date, holidaySet, currentWeekLabel });
                return (
                  <th
                    key={`week_${date}`}
                    style={{
                      border: `1px solid ${meta.borderColor}`,
                      background: meta.background,
                      color: meta.color,
                      minWidth: '78px',
                      padding: '0.35rem 0.25rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      {meta.weekLabel}
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...leftCellBaseStyle, ...stickyColumnStyle(0, 190, palette.leftHeader), zIndex: 6, color: '#94a3b8' }}>
                Planta
              </th>
              <th style={{ ...leftCellBaseStyle, ...stickyColumnStyle(190, 190, palette.leftHeader), zIndex: 6, color: '#38bdf8', textAlign: 'center' }}>
                Exportadora
              </th>
              <th style={{ ...leftCellBaseStyle, ...stickyColumnStyle(380, 150, palette.leftHeader), zIndex: 6, color: '#a78bfa', textAlign: 'center' }}>
                Especie
              </th>

              {dates.map((date) => {
                const meta = getDateCellMeta({ date, holidaySet, currentWeekLabel });
                return (
                  <th
                    key={date}
                    style={{
                      border: `1px solid ${meta.borderColor}`,
                      padding: '0.45rem 0.2rem',
                      background: meta.background,
                      color: meta.color,
                      minWidth: '78px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ textTransform: 'capitalize', fontSize: '0.88rem' }}>
                      {formatDateLabel(date)}
                    </div>
                    <div style={{ fontSize: '0.67rem', marginTop: '0.1rem' }}>
                      {meta.today ? 'Hoy' : meta.holiday ? 'Feriado' : meta.sunday ? 'Dom' : ''}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {renderSectionRow('Cosecha', dates)}
            {renderRows(sections.cosecha, dates, holidaySet, currentWeekLabel, {
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}
            {renderTotalRow({
              label: 'Total Cosecha',
              dates,
              values: sections.cosecha.reduce((acc, row) => {
                dates.forEach((date) => {
                  acc[date] = Number(acc[date] || 0) + Number(row.values?.[date] || 0);
                });
                return acc;
              }, {}),
              holidaySet,
              currentWeekLabel,
              leftLabelColor: '#38bdf8',
              valueColor: '#0ea5e9',
            })}

            {renderSectionRow(usaCurado ? 'Liberación Curado' : 'Curado', dates)}
            {renderRows(sections.curado, dates, holidaySet, currentWeekLabel, {
              showAutoHint: usaCurado,
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}
            {renderTotalRow({
              label: 'Total Curado',
              dates,
              values: sections.curado.reduce((acc, row) => {
                dates.forEach((date) => {
                  acc[date] = Number(acc[date] || 0) + Number(row.values?.[date] || 0);
                });
                return acc;
              }, {}),
              holidaySet,
              currentWeekLabel,
              leftLabelColor: '#a78bfa',
              valueColor: '#8b5cf6',
            })}

            {renderSectionRow('Proceso', dates)}
            {renderRows(sections.proceso, dates, holidaySet, currentWeekLabel, {
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}
            {renderTotalRow({
              label: 'Total Proceso',
              dates,
              values: totals.totalProceso,
              holidaySet,
              currentWeekLabel,
              leftLabelColor: '#22c55e',
              valueColor: '#10b981',
            })}
            {renderTotalRow({
              label: 'Total Horas Proceso',
              dates,
              values: totals.totalHorasProceso,
              holidaySet,
              currentWeekLabel,
              digits: 1,
              leftLabelColor: '#f97316',
              valueColor: '#f97316',
            })}

            {renderSectionRow('Balance', dates)}
            {sections.balance.map((row, rowIndex) => (
              <tr key={`balance_${row.entityId}`}>
                {renderLeftInfoCells(row, rowIndex % 2 === 0 ? 'normal' : 'alt')}
                {dates.map((date) => {
                  const value = Number(row.values?.[date] || 0);
                  const meta = getDateCellMeta({ date, holidaySet, currentWeekLabel });
                  return (
                    <td
                      key={`balance_${row.entityId}_${date}`}
                      style={getBodyCellStyle(meta, { negative: value < 0 })}
                    >
                      {formatCellValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {renderTotalRow({
              label: 'Total Balance Acum.',
              dates,
              values: totals.totalBalance,
              holidaySet,
              currentWeekLabel,
              leftLabelColor: '#f59e0b',
              valueColor: '#f59e0b',
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
