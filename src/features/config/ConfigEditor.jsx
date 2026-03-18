import { useEffect, useMemo, useState } from 'react';
import { useConfigEditor } from './useConfigEditor';
import { useCatalogEditor } from './useCatalogEditor';

export const ConfigEditor = ({
  entities,
  setEntities,
  defaultParameters,
  setDefaultParameters,
  familias,
  setFamilias,
  especies,
  setEspecies,
}) => {
  const [form, setForm] = useState({
    bins_por_hora: defaultParameters?.bins_por_hora ?? 18,
    horas_por_dia: defaultParameters?.horas_por_dia ?? 16,
    kg_por_bin: defaultParameters?.kg_por_bin ?? 460,
  });

  const [newFamilia, setNewFamilia] = useState({
    nombre: '',
    usa_curado: false,
    orden: 0,
  });

  const [newEspecie, setNewEspecie] = useState({
    nombre: '',
    familia_id: '',
  });

  const [editingFamiliaId, setEditingFamiliaId] = useState(null);
  const [editingFamilia, setEditingFamilia] = useState({
    nombre: '',
    usa_curado: false,
    orden: 0,
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

  const {
    catalogSaving,
    catalogError,
    catalogSuccess,
    createFamilia,
    updateFamilia,
    createEspecie,
    deleteEspecie,
  } = useCatalogEditor({
    familias,
    setFamilias,
    especies,
    setEspecies,
  });

  const especiesConFamilia = useMemo(() => {
    return especies.map((species) => {
      const family = familias.find((item) => Number(item.id) === Number(species.familia_id));
      return {
        ...species,
        familia_nombre: family?.nombre || '—',
      };
    });
  }, [especies, familias]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h2>Visibilidad, familias y especies</h2>
        </div>
      </div>

      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}
      {catalogError ? <div className="status-banner status-banner--warn">{catalogError}</div> : null}
      {catalogSuccess ? <div className="status-banner status-banner--ok">{catalogSuccess}</div> : null}

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

      <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Familias</p>
            <h2>Crear y editar familias</h2>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr auto',
            gap: '0.75rem',
            alignItems: 'end',
            marginBottom: '1rem',
          }}
        >
          <label>
            <div className="stat-label">Nombre</div>
            <input
              value={newFamilia.nombre}
              onChange={(event) =>
                setNewFamilia((current) => ({ ...current, nombre: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Orden</div>
            <input
              type="number"
              value={newFamilia.orden}
              onChange={(event) =>
                setNewFamilia((current) => ({ ...current, orden: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="stat-label">Usa curado</div>
            <input
              type="checkbox"
              checked={newFamilia.usa_curado}
              onChange={(event) =>
                setNewFamilia((current) => ({ ...current, usa_curado: event.target.checked }))
              }
            />
          </label>

          <button
            disabled={catalogSaving}
            onClick={async () => {
              const ok = await createFamilia(newFamilia);
              if (ok) {
                setNewFamilia({ nombre: '', usa_curado: false, orden: 0 });
              }
            }}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: '#0f62fe',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Crear familia
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Orden</th>
                <th>Usa curado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {familias.map((familia) => {
                const isEditing = Number(editingFamiliaId) === Number(familia.id);

                return (
                  <tr key={familia.id}>
                    <td>
                      {isEditing ? (
                        <input
                          value={editingFamilia.nombre}
                          onChange={(event) =>
                            setEditingFamilia((current) => ({ ...current, nombre: event.target.value }))
                          }
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                        />
                      ) : (
                        familia.nombre
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editingFamilia.orden}
                          onChange={(event) =>
                            setEditingFamilia((current) => ({ ...current, orden: event.target.value }))
                          }
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                        />
                      ) : (
                        familia.orden
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={Boolean(editingFamilia.usa_curado)}
                          onChange={(event) =>
                            setEditingFamilia((current) => ({ ...current, usa_curado: event.target.checked }))
                          }
                        />
                      ) : familia.usa_curado ? 'Sí' : 'No'}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            disabled={catalogSaving}
                            onClick={async () => {
                              const ok = await updateFamilia({
                                ...familia,
                                ...editingFamilia,
                              });
                              if (ok) {
                                setEditingFamiliaId(null);
                              }
                            }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => {
                              setEditingFamiliaId(null);
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingFamiliaId(familia.id);
                            setEditingFamilia({
                              nombre: familia.nombre,
                              usa_curado: Boolean(familia.usa_curado),
                              orden: familia.orden,
                            });
                          }}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Especies</p>
            <h2>Crear y eliminar especies</h2>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr auto',
            gap: '0.75rem',
            alignItems: 'end',
            marginBottom: '1rem',
          }}
        >
          <label>
            <div className="stat-label">Nombre</div>
            <input
              value={newEspecie.nombre}
              onChange={(event) =>
                setNewEspecie((current) => ({ ...current, nombre: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label>
            <div className="stat-label">Familia</div>
            <select
              value={newEspecie.familia_id}
              onChange={(event) =>
                setNewEspecie((current) => ({ ...current, familia_id: event.target.value }))
              }
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Selecciona una familia</option>
              {familias.map((familia) => (
                <option key={familia.id} value={familia.id}>
                  {familia.nombre}
                </option>
              ))}
            </select>
          </label>

          <button
            disabled={catalogSaving}
            onClick={async () => {
              const ok = await createEspecie(newEspecie);
              if (ok) {
                setNewEspecie({ nombre: '', familia_id: '' });
              }
            }}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: '#0f62fe',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Crear especie
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Familia</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {especiesConFamilia.map((species) => (
                <tr key={species.id}>
                  <td>{species.nombre}</td>
                  <td>{species.familia_nombre}</td>
                  <td>
                    <button
                      disabled={catalogSaving}
                      onClick={() => deleteEspecie(species.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
