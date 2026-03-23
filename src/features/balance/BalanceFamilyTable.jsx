const formatNumber = (value, digits = 0) => {
  const safe = Number(value || 0);
  return safe.toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatDateLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const sectionTitleStyle = {
  background: '#0f62fe',
  color: '#fff',
  fontWeight: 800,
  letterSpacing: '0.04em',
};

const subHeaderStyle = {
  background: '#f8fafc',
  color: '#334155',
  fontWeight: 700,
};

const balanceValueStyle = (value) => {
  if (value < 0) {
    return {
      color: '#dc2626',
      fontWeight: 800,
      background: '#fef2f2',
    };
  }

  return {
    color: '#0f172a',
    fontWeight: 700,
    background: '#f8fafc',
  };
};

const editableInputStyle = (isSaving) => ({
  width: '100%',
  minWidth: '82px',
  padding: '0.4rem 0.5rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: isSaving ? '#eff6ff' : '#fff',
  textAlign: 'right',
});

const renderRows = (rows, dates, options = {}) => {
  const {
    showAutoHint = false,
    editable = false,
    family = null,
    entityMap = new Map(),
    setDraftCell,
    updateCell,
    savingCell,
  } = options;

  return rows.map((row) => (
    <tr key={`${row.field}_${row.entityId}`}>
      <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
        {row.planta}
      </td>
      <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
        {row.exportadora}
      </td>
      <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
        {row.especie}
      </td>
      <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
        {row.variedad}
      </td>

      {dates.map((date) => {
        const value = Number(row.values?.[date] || 0);
        const autoValue = Number(row.autoValues?.[date] || 0);

        const key = `${row.field}_${row.entityId}_${date}`;
        const entity = entityMap.get(Number(row.entityId));

        return (
          <td
            key={`${row.field}_${row.entityId}_${date}`}
            style={{
              border: '1px solid #dbe4f0',
              padding: '0.45rem',
              textAlign: 'right',
              background: '#fff',
            }}
          >
            {editable && entity ? (
              <>
                <input
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
                  style={editableInputStyle(savingCell === key)}
                />
                {showAutoHint && autoValue > 0 ? (
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                    auto: {formatNumber(autoValue)}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div>{formatNumber(value)}</div>
                {showAutoHint && autoValue > 0 ? (
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    auto: {formatNumber(autoValue)}
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

const renderTotalRow = ({ label, dates, values, digits = 0, highlight = false }) => (
  <tr>
    <td
      colSpan={4}
      style={{
        border: '1px solid #dbe4f0',
        padding: '0.5rem',
        fontWeight: 800,
        background: highlight ? '#fef9c3' : '#eff6ff',
      }}
    >
      {label}
    </td>

    {dates.map((date) => {
      const value = Number(values?.[date] || 0);
      return (
        <td
          key={`${label}_${date}`}
          style={{
            border: '1px solid #dbe4f0',
            padding: '0.5rem',
            textAlign: 'right',
            fontWeight: 800,
            background: highlight ? '#fef9c3' : '#eff6ff',
          }}
        >
          {formatNumber(value, digits)}
        </td>
      );
    })}
  </tr>
);

export const BalanceFamilyTable = ({
  family,
  entityMap = new Map(),
  setDraftCell,
  updateCell,
  savingCell,
}) => {
  if (!family) return null;

  const { familyName, usaCurado, seasonStart, seasonEnd, dates, sections, totals } = family;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Balance</p>
          <h2>{familyName}</h2>
          <div style={{ color: '#64748b', marginTop: '0.35rem', fontSize: '0.9rem' }}>
            Temporada: {seasonStart || '—'} → {seasonEnd || '—'} ·{' '}
            {usaCurado ? 'usa curado' : 'sin curado'}
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '1400px', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #dbe4f0', padding: '0.55rem', ...subHeaderStyle }}>
                Planta
              </th>
              <th style={{ border: '1px solid #dbe4f0', padding: '0.55rem', ...subHeaderStyle }}>
                Exportadora
              </th>
              <th style={{ border: '1px solid #dbe4f0', padding: '0.55rem', ...subHeaderStyle }}>
                Especie
              </th>
              <th style={{ border: '1px solid #dbe4f0', padding: '0.55rem', ...subHeaderStyle }}>
                Variedad
              </th>

              {dates.map((date) => (
                <th
                  key={date}
                  style={{
                    border: '1px solid #dbe4f0',
                    padding: '0.55rem',
                    minWidth: '105px',
                    ...subHeaderStyle,
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
            <tr>
              <td
                colSpan={4 + dates.length}
                style={{ border: '1px solid #dbe4f0', padding: '0.65rem', ...sectionTitleStyle }}
              >
                Cosechas
              </td>
            </tr>
            {renderRows(sections.cosecha, dates, {
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}

            <tr>
              <td
                colSpan={4 + dates.length}
                style={{ border: '1px solid #dbe4f0', padding: '0.65rem', ...sectionTitleStyle }}
              >
                {usaCurado ? 'Curado / Liberación' : 'Curado (no aplica, editable si se requiere)'}
              </td>
            </tr>
            {renderRows(sections.curado, dates, {
              showAutoHint: usaCurado,
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}

            <tr>
              <td
                colSpan={4 + dates.length}
                style={{ border: '1px solid #dbe4f0', padding: '0.65rem', ...sectionTitleStyle }}
              >
                Procesos
              </td>
            </tr>
            {renderRows(sections.proceso, dates, {
              editable: true,
              family,
              entityMap,
              setDraftCell,
              updateCell,
              savingCell,
            })}

            {renderTotalRow({
              label: 'TOTAL PROCESOS',
              dates,
              values: totals.totalProceso,
            })}

            {renderTotalRow({
              label: 'TOTAL HORAS PROCESO',
              dates,
              values: totals.totalHorasProceso,
              digits: 1,
              highlight: true,
            })}

            <tr>
              <td
                colSpan={4 + dates.length}
                style={{ border: '1px solid #dbe4f0', padding: '0.65rem', ...sectionTitleStyle }}
              >
                Balance
              </td>
            </tr>

            {sections.balance.map((row) => (
              <tr key={`balance_${row.entityId}`}>
                <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
                  {row.planta}
                </td>
                <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
                  {row.exportadora}
                </td>
                <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
                  {row.especie}
                </td>
                <td style={{ border: '1px solid #dbe4f0', padding: '0.45rem', background: '#fff' }}>
                  {row.variedad}
                </td>

                {dates.map((date) => {
                  const value = Number(row.values?.[date] || 0);
                  return (
                    <td
                      key={`balance_${row.entityId}_${date}`}
                      style={{
                        border: '1px solid #dbe4f0',
                        padding: '0.45rem',
                        textAlign: 'right',
                        ...balanceValueStyle(value),
                      }}
                    >
                      {formatNumber(value)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {renderTotalRow({
              label: 'TOTAL BALANCE FAMILIA',
              dates,
              values: totals.totalBalance,
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
