import { useEffect, useState } from 'react';
import { useConfigEditor } from './useConfigEditor';

export const ConfigEditor = ({
  entities,
  setEntities,
  defaultParameters,
  setDefaultParameters,
}) => {
  const [form, setForm] = useState({
    bins_por_hora: defaultParameters?.bins_por_hora ?? 18,
    horas_por_dia: defaultParameters?.horas_por_dia ?? 16,
    kg_por_bin: defaultParameters?.kg_por_bin ?? 460,
  });

  useEffect(() => {
    setForm({
      bins_por_hora: defaultParameters?.bins_por_hora ?? 18,
      horas_por_dia: defaultParameters?.horas_por_dia ?? 16,
      kg_por_bin: defaultParameters?.kg_por_bin ?? 460,
    });
  }, [defaultParameters]);

  const {
    saving,
    error,
    success,
    toggleVisibility,
    saveDefaultConfig,
  } = useConfigEditor({
    entities,
    setEntities,
    defaultParameters,
    setDefaultParameters,
  });

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h2>Visibilidad y parámetros estándar</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}

      <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Parámetros base</p>
            <h2>Configuración por defecto</h2>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          <label>
            <div className="stat-label">Bins por hora</div>
            <input
              type="number"
              min="1"
              value={form.bins_por_hora}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bins_por_hora: event.target.value,
                }))
              }
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
            <div className="stat-label">Horas por día</div>
            <input
              type="number"
              min="1"
              value={form.horas_por_dia}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  horas_por_dia: event.target.value,
                }))
              }
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
            <div className="stat-label">Kg por bin</div>
            <input
              type="number"
              min="1"
              value={form.kg_por_bin}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  kg_por_bin: event.target.value,
                }))
              }
              style={{
                width: '100%',
                marginTop: '0.4rem',
                padding: '0.6rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
              }}
            />
          </label>
        </div>

        <button
          onClick={() => saveDefaultConfig(form)}
          disabled={saving}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: '#0f62fe',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar configuración base'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Exportadora</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th>Visible en línea</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr key={entity.id}>
                <td>{entity.exportadora}</td>
                <td>{entity.especie}</td>
                <td>{entity.variedad || '—'}</td>
                <td>{Number(entity.visibleLinea ?? 1) === 1 ? 'Sí' : 'No'}</td>
                <td>
                  <button
                    onClick={() => toggleVisibility(entity)}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Alternar visibilidad
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
