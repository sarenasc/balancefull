import { useMemo } from 'react';
import { formatDate } from '../../utils/date';
import { useOperationsEditor } from './useOperationsEditor';

const getFamilyByEntity = ({ entity, familias, especies }) => {
  const species = especies.find((item) => Number(item.id) === Number(entity.especieId));
  if (!species) return null;
  return familias.find((family) => Number(family.id) === Number(species.familia_id)) || null;
};

export const OperationsEditor = ({
  entities,
  familias,
  especies,
  dates,
  data,
  setData,
  temporadaId,
  curadoHoursConfig,
}) => {
  const { visibleEntities, savingCell, error, updateCell } = useOperationsEditor({
    entities,
    data,
    setData,
    temporadaId,
    curadoHoursConfig,
  });

  const previewDates = useMemo(() => dates.slice(0, 7), [dates]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Operación</p>
          <h2>Edición rápida de cosecha, curado y proceso</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Exportadora</th>
              <th>Campo</th>
              {previewDates.map((date) => (
                <th key={date}>{formatDate(date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleEntities.map((entity) => {
              const family = getFamilyByEntity({ entity, familias, especies });
              const useCurado = Boolean(family?.usa_curado);

              const fields = useCurado
                ? ['cosecha', 'curado', 'proceso']
                : ['cosecha', 'proceso'];

              return fields.map((field) => (
                <tr key={`${entity.id}_${field}`}>
                  <td>{entity.label}</td>
                  <td>{field.toUpperCase()}</td>
                  {previewDates.map((date) => {
                    const value = data[entity.id]?.[date]?.[field] ?? 0;
                    const key = `${entity.id}_${date}_${field}`;

                    return (
                      <td key={key}>
                        <input
                          type="number"
                          min="0"
                          value={value}
                          onChange={(event) => {
                            const rawValue = event.target.value;
                            setData((current) => ({
                              ...current,
                              [entity.id]: {
                                ...current[entity.id],
                                [date]: {
                                  ...(current[entity.id]?.[date] || {
                                    cosecha: 0,
                                    curado: 0,
                                    proceso: 0,
                                  }),
                                  [field]: rawValue === '' ? 0 : Number(rawValue),
                                },
                              },
                            }));
                          }}
                          onBlur={(event) =>
                            updateCell({
                              entity,
                              date,
                              field,
                              value: event.target.value,
                              useCurado,
                            })
                          }
                          style={{
                            width: '100%',
                            minWidth: '88px',
                            padding: '0.45rem 0.55rem',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: savingCell === key ? '#eff6ff' : '#fff',
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <p className="body-copy" style={{ marginTop: '1rem' }}>
        Si la familia usa curado, guardar una cosecha puede generar automáticamente el valor de curado
        según las horas configuradas por exportadora.
      </p>
    </section>
  );
};
