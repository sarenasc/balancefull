import { useEffect, useMemo, useState } from 'react';
import { useConfigEditor } from './useConfigEditor';
import { useCatalogEditor } from './useCatalogEditor';
import { useHolidayEditor } from './useHolidayEditor';
import { useCuradoHoursEditor } from './useCuradoHoursEditor';
import ConfigSubMenu from './ConfigSubMenu';
import ParametrosDiaEditor from './ParametrosDiaEditor';
import TemporadasEditor from './TemporadasEditor';

const inputStyle = {
  width: '100%',
  marginTop: '0.4rem',
  padding: '0.6rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
};

const primaryButtonStyle = {
  marginTop: '1rem',
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: 'none',
  background: '#0f62fe',
  color: '#fff',
  cursor: 'pointer',
};

export const ConfigEditor = ({
  entities,
  setEntities,
  defaultParameters,
  setDefaultParameters,
  familias,
  setFamilias,
  especies,
  setEspecies,
  parametrosEspecie,
  setParametrosEspecie,
  holidays,
  setHolidays,
  curadoHoursConfig,
  setCuradoHoursConfig,
}) => {
  const [activeTab, setActiveTab] = useState('parametros');
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

  const [newHoliday, setNewHoliday] = useState({
    fecha: '',
    nombre: '',
  });

  const [editingFamiliaId, setEditingFamiliaId] = useState(null);
  const [editingFamilia, setEditingFamilia] = useState({
    nombre: '',
    usa_curado: false,
    orden: 0,
  });

  const [speciesForms, setSpeciesForms] = useState({});
  const [curadoForms, setCuradoForms] = useState({});

  useEffect(() => {
    setForm({
      bins_por_hora: defaultParameters?.bins_por_hora ?? 18,
      horas_por_dia: defaultParameters?.horas_por_dia ?? 16,
      kg_por_bin: defaultParameters?.kg_por_bin ?? 460,
    });
  }, [defaultParameters]);

  useEffect(() => {
    const map = {};
    especies.forEach((species) => {
      const params = parametrosEspecie.find(
        (item) => Number(item.especie_id) === Number(species.id),
      );

      map[species.id] = {
        bins_por_hora: params?.bins_por_hora ?? defaultParameters?.bins_por_hora ?? 18,
        horas_por_dia: params?.horas_por_dia ?? defaultParameters?.horas_por_dia ?? 16,
        kg_por_bin: params?.kg_por_bin ?? defaultParameters?.kg_por_bin ?? 460,
      };
    });
    setSpeciesForms(map);
  }, [especies, parametrosEspecie, defaultParameters]);

  useEffect(() => {
    const map = {};
    entities.forEach((entity) => {
      map[entity.id] = curadoHoursConfig?.[entity.id] ?? entity.horas_curado ?? 48;
    });
    setCuradoForms(map);
  }, [entities, curadoHoursConfig]);

  const {
    saving,
    error,
    success,
    toggleVisibility,
    saveDefaultConfig,
    saveSpeciesParams,
  } = useConfigEditor({
    entities,
    setEntities,
    defaultParameters,
    setDefaultParameters,
    parametrosEspecie,
    setParametrosEspecie,
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

  const {
    holidaySaving,
    holidayError,
    holidaySuccess,
    addHoliday,
    deleteHoliday,
  } = useHolidayEditor({
    holidays,
    setHolidays,
  });

  const {
    curadoSaving,
    curadoError,
    curadoSuccess,
    saveCuradoHours,
  } = useCuradoHoursEditor({
    curadoHoursConfig,
    setCuradoHoursConfig,
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

  const entidadesCurado = useMemo(() => {
    return entities.filter((entity) => String(entity?.especie || '').trim().toUpperCase() === 'KIWI');
  }, [entities]);

  const renderParametros = () => (
    <>
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
              style={inputStyle}
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
              style={inputStyle}
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
              style={inputStyle}
            />
          </label>
        </div>

        <button onClick={() => saveDefaultConfig(form)} disabled={saving} style={primaryButtonStyle}>
          {saving ? 'Guardando...' : 'Guardar configuración base'}
        </button>
      </div>

      <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Parámetros por especie</p>
            <h2>Productividad específica</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Especie</th>
                <th>Familia</th>
                <th>Bins/hora</th>
                <th>Horas/día</th>
                <th>Kg/bin</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {especiesConFamilia.map((species) => {
                const row = speciesForms[species.id] || {
                  bins_por_hora: defaultParameters?.bins_por_hora ?? 18,
                  horas_por_dia: defaultParameters?.horas_por_dia ?? 16,
                  kg_por_bin: defaultParameters?.kg_por_bin ?? 460,
                };

                return (
                  <tr key={species.id}>
                    <td>{species.nombre}</td>
                    <td>{species.familia_nombre}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={row.bins_por_hora}
                        onChange={(event) =>
                          setSpeciesForms((current) => ({
                            ...current,
                            [species.id]: {
                              ...current[species.id],
                              bins_por_hora: event.target.value,
                            },
                          }))
                        }
                        style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={row.horas_por_dia}
                        onChange={(event) =>
                          setSpeciesForms((current) => ({
                            ...current,
                            [species.id]: {
                              ...current[species.id],
                              horas_por_dia: event.target.value,
                            },
                          }))
                        }
                        style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={row.kg_por_bin}
                        onChange={(event) =>
                          setSpeciesForms((current) => ({
                            ...current,
                            [species.id]: {
                              ...current[species.id],
                              kg_por_bin: event.target.value,
                            },
                          }))
                        }
                        style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
                      />
                    </td>
                    <td>
                      <button
                        disabled={saving}
                        onClick={() =>
                          saveSpeciesParams({
                            especie: species,
                            values: speciesForms[species.id],
                          })
                        }
                      >
                        Guardar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!especiesConFamilia.length ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>
                    No hay especies cargadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderCalendario = () => (
    <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Feriados</p>
          <h2>Calendario operativo</h2>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '0.75rem',
          alignItems: 'end',
          marginBottom: '1rem',
        }}
      >
        <label>
          <div className="stat-label">Fecha</div>
          <input
            type="date"
            value={newHoliday.fecha}
            onChange={(event) =>
              setNewHoliday((current) => ({ ...current, fecha: event.target.value }))
            }
            style={inputStyle}
          />
        </label>

        <label>
          <div className="stat-label">Nombre (opcional)</div>
          <input
            value={newHoliday.nombre}
            onChange={(event) =>
              setNewHoliday((current) => ({ ...current, nombre: event.target.value }))
            }
            style={inputStyle}
          />
        </label>

        <button
          disabled={holidaySaving}
          onClick={async () => {
            const ok = await addHoliday(newHoliday);
            if (ok) {
              setNewHoliday({ fecha: '', nombre: '' });
            }
          }}
          style={primaryButtonStyle}
        >
          Agregar feriado
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((holiday) => (
              <tr key={holiday}>
                <td>{holiday}</td>
                <td>
                  <button disabled={holidaySaving} onClick={() => deleteHoliday(holiday)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!holidays.length ? (
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', color: '#64748b' }}>
                  No hay feriados cargados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCurado = () => (
    <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Horas de curado</p>
          <h2>Configuración por exportadora</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Exportadora</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th>Horas curado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {entidadesCurado.map((entity) => (
              <tr key={entity.id}>
                <td>{entity.exportadora}</td>
                <td>{entity.especie}</td>
                <td>{entity.variedad || '—'}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={curadoForms[entity.id] ?? 48}
                    onChange={(event) =>
                      setCuradoForms((current) => ({
                        ...current,
                        [entity.id]: event.target.value,
                      }))
                    }
                    style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
                  />
                </td>
                <td>
                  <button
                    disabled={curadoSaving}
                    onClick={() =>
                      saveCuradoHours({
                        exportadoraId: entity.id,
                        horasCurado: curadoForms[entity.id],
                      })
                    }
                  >
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
            {!entidadesCurado.length ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                  No hay exportadoras de kiwi para configurar curado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCatalogos = () => (
    <>
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
              style={inputStyle}
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
              style={inputStyle}
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
            style={primaryButtonStyle}
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
                          style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
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
                          style={{ ...inputStyle, marginTop: 0, padding: '0.5rem' }}
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
                              if (ok) setEditingFamiliaId(null);
                            }}
                          >
                            Guardar
                          </button>
                          <button type="button" onClick={() => setEditingFamiliaId(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
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
              {!familias.length ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b' }}>
                    No hay familias cargadas.
                  </td>
                </tr>
              ) : null}
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
              style={inputStyle}
            />
          </label>

          <label>
            <div className="stat-label">Familia</div>
            <select
              value={newEspecie.familia_id}
              onChange={(event) =>
                setNewEspecie((current) => ({ ...current, familia_id: event.target.value }))
              }
              style={inputStyle}
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
            style={primaryButtonStyle}
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
                    <button disabled={catalogSaving} onClick={() => deleteEspecie(species.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!especiesConFamilia.length ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: '#64748b' }}>
                    No hay especies cargadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderExportadoras = () => (
    <div className="panel panel--compact" style={{ marginBottom: '1rem' }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Exportadoras</p>
          <h2>Visibilidad en línea</h2>
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
            {!entities.length ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                  No hay exportadoras cargadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'parametros':
        return renderParametros();
      case 'catalogos':
        return renderCatalogos();
      case 'exportadoras':
        return renderExportadoras();
      case 'temporadas':
        return <TemporadasEditor familias={familias} setFamilias={setFamilias} />;
      case 'calendario':
        return renderCalendario();
      case 'curado':
        return renderCurado();
      case 'parametros-dia':
        return <ParametrosDiaEditor entities={entities} />;
      default:
        return renderParametros();
    }
  };

  return (
    <section className="panel">
      {error ? <div className="status-banner status-banner--warn">{error}</div> : null}
      {success ? <div className="status-banner status-banner--ok">{success}</div> : null}
      {catalogError ? <div className="status-banner status-banner--warn">{catalogError}</div> : null}
      {catalogSuccess ? <div className="status-banner status-banner--ok">{catalogSuccess}</div> : null}
      {holidayError ? <div className="status-banner status-banner--warn">{holidayError}</div> : null}
      {holidaySuccess ? <div className="status-banner status-banner--ok">{holidaySuccess}</div> : null}
      {curadoError ? <div className="status-banner status-banner--warn">{curadoError}</div> : null}
      {curadoSuccess ? <div className="status-banner status-banner--ok">{curadoSuccess}</div> : null}

      <div style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Submódulos de administración</h3>
      </div>

      <ConfigSubMenu active={activeTab} onChange={setActiveTab} />
      {renderActiveTab()}
    </section>
  );
};

export default ConfigEditor;
