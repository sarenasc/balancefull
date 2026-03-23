import { useEffect, useMemo, useState } from 'react';
import { useOperationsEditor } from '../operations/useOperationsEditor';
import { buildBalanceModel } from './balanceModel';
import { BalanceFamilyTable } from './BalanceFamilyTable';

const tabStyle = (active) => ({
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: active ? '1px solid #2563eb' : '1px solid #dbe4f0',
  background: active ? '#eff6ff' : '#fff',
  color: active ? '#2563eb' : '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
});

const summaryCardStyle = {
  border: '1px solid #dbe4f0',
  borderRadius: '12px',
  background: '#fff',
  padding: '1rem',
  minWidth: '200px',
};

const formatNumber = (value, digits = 0) =>
  Number(value || 0).toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const BalanceBoard = ({
  dates,
  familias,
  especies,
  entities,
  data,
  setData,
  temporadaId,
  curadoHoursConfig,
  parametersBySpeciesId,
}) => {

  const { savingCell, error, updateCell, setDraftCell } = useOperationsEditor({
    entities,
    data,
    setData,
    temporadaId,
    curadoHoursConfig,
  });

  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [Number(entity.id), entity])),
    [entities],
  );

  const model = useMemo(
    () =>
      buildBalanceModel({
        dates,
        familias,
        especies,
        entities,
        data,
        curadoHoursConfig,
        parametersBySpeciesId,
      }),
    [dates, familias, especies, entities, data, curadoHoursConfig, parametersBySpeciesId],
  );

  const familyTabs = model.families || [];
  const [activeFamilyId, setActiveFamilyId] = useState(familyTabs[0]?.familyId ?? null);

  useEffect(() => {
    if (!familyTabs.length) {
      setActiveFamilyId(null);
      return;
    }

    const stillExists = familyTabs.some(
      (item) => Number(item.familyId) === Number(activeFamilyId),
    );

    if (!stillExists) {
      setActiveFamilyId(familyTabs[0].familyId);
    }
  }, [familyTabs, activeFamilyId]);

  const activeFamily =
    familyTabs.find((item) => Number(item.familyId) === Number(activeFamilyId)) ||
    familyTabs[0] ||
    null;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Balance</p>
          <h2>Balance operacional por familia</h2>
          <div style={{ marginTop: '0.35rem', color: '#64748b' }}>
            Cosecha y proceso son manuales. Curado puede autogenerarse por horas configuradas y seguir editable.
          </div>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}

      {!familyTabs.length ? (
        <div className="status-banner status-banner--warn">
          No hay familias activas disponibles para construir balance.
        </div>
      ) : (
        <>
          <div
            className="panel panel--compact"
            style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
          >
            {familyTabs.map((family) => (
              <button
                key={family.familyId}
                type="button"
                onClick={() => setActiveFamilyId(family.familyId)}
                style={tabStyle(Number(activeFamilyId) === Number(family.familyId))}
              >
                {family.familyName}
              </button>
            ))}
          </div>

          {activeFamily ? (
            <>
              <div
                className="panel panel--compact"
                style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
              >
                <div style={summaryCardStyle}>
                  <div className="stat-label">Familia</div>
                  <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '1.1rem' }}>
                    {activeFamily.familyName}
                  </div>
                </div>

                <div style={summaryCardStyle}>
                  <div className="stat-label">Proceso total</div>
                  <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '1.1rem' }}>
                    {formatNumber(
                      Object.values(activeFamily.totals?.totalProceso || {}).reduce(
                        (sum, value) => sum + Number(value || 0),
                        0,
                      ),
                    )}
                  </div>
                </div>

                <div style={summaryCardStyle}>
                  <div className="stat-label">Horas proceso</div>
                  <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '1.1rem' }}>
                    {formatNumber(
                      Object.values(activeFamily.totals?.totalHorasProceso || {}).reduce(
                        (sum, value) => sum + Number(value || 0),
                        0,
                      ),
                      1,
                    )}
                  </div>
                </div>

                <div style={summaryCardStyle}>
                  <div className="stat-label">Usa curado</div>
                  <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '1.1rem' }}>
                    {activeFamily.usaCurado ? 'Sí' : 'No'}
                  </div>
                </div>
              </div>

              <BalanceFamilyTable
                family={activeFamily}
                entityMap={entityMap}
                setDraftCell={setDraftCell}
                updateCell={updateCell}
                savingCell={savingCell}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  );
};
