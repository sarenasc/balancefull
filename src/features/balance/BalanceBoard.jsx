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

export const BalanceBoard = ({
  dates,
  familias,
  especies,
  entities,
  data,
  setData,
  holidays,
  temporadaId,
  curadoHoursConfig,
  parametersBySpeciesId,
  parametrosDia = [],
  horasExtraDia = [],
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
        parametrosDia,
        horasExtraDia,
      }),
    [dates, familias, especies, entities, data, curadoHoursConfig, parametersBySpeciesId, parametrosDia, horasExtraDia],
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <section className="panel">
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
              <BalanceFamilyTable
                family={activeFamily}
                holidays={holidays}
                entityMap={entityMap}
                setDraftCell={setDraftCell}
                updateCell={updateCell}
                savingCell={savingCell}
                onOpenFullscreen={() => setIsFullscreen(true)}
              />

              {isFullscreen ? (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    background: 'rgba(15, 23, 42, 0.78)',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: '100%',
                      borderRadius: '22px',
                      background: '#f8fafc',
                      padding: '1rem',
                      boxShadow: '0 30px 80px rgba(15, 23, 42, 0.35)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(false)}
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        width: '40px',
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        fontSize: '1.4rem',
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                    >
                      ×
                    </button>

                    <div style={{ height: '100%', overflow: 'hidden', paddingTop: '2.5rem' }}>
                      <BalanceFamilyTable
                        family={activeFamily}
                        holidays={holidays}
                        entityMap={entityMap}
                        setDraftCell={setDraftCell}
                        updateCell={updateCell}
                        savingCell={savingCell}
                        isFullscreen
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
};
