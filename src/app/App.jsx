import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StatusBanner } from '../components/ui/StatusBanner';
import { appConfig } from './config';
import { DashboardOverview } from '../features/dashboard/DashboardOverview';
import { ConfigSummary } from '../features/config/ConfigSummary';
import { ConfigEditor } from '../features/config/ConfigEditor';
import { ProjectionPanel } from '../features/projection/ProjectionPanel';
import { createProjectionMetrics } from '../features/projection/projectionModel';
import { SchedulingSummary } from '../features/scheduling/SchedulingSummary';
import { OperationsEditor } from '../features/operations/OperationsEditor';
import { usePlannerData } from '../hooks/usePlannerData';

export const App = () => {
  const planner = usePlannerData();
  const {
    status,
    source,
    error,
    entities: initialEntities,
    familias: initialFamilias,
    especies: initialEspecies,
    parametrosEspecie: initialParametrosEspecie,
    holidays: initialHolidays,
    data: initialData,
    dates,
    temporadaId,
  } = planner;

  const [entities, setEntities] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [parametrosEspecie, setParametrosEspecie] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [curadoHoursConfig, setCuradoHoursConfig] = useState({});
  const [data, setData] = useState({});
  const [defaultParameters, setDefaultParameters] = useState({
    especie_id: null,
    bins_por_hora: 18,
    horas_por_dia: 16,
    kg_por_bin: 460,
  });

  useEffect(() => {
    setEntities(initialEntities);
  }, [initialEntities]);

  useEffect(() => {
    setFamilias(initialFamilias);
  }, [initialFamilias]);

  useEffect(() => {
    setEspecies(initialEspecies);
  }, [initialEspecies]);

  useEffect(() => {
    setParametrosEspecie(initialParametrosEspecie);
  }, [initialParametrosEspecie]);

  useEffect(() => {
    setHolidays(initialHolidays || []);
  }, [initialHolidays]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const fallback =
      parametrosEspecie.find((item) => item.especie_id == null) || {
        especie_id: null,
        bins_por_hora: 18,
        horas_por_dia: 16,
        kg_por_bin: 460,
      };

    setDefaultParameters({
      especie_id: null,
      bins_por_hora: Number(fallback.bins_por_hora ?? 18),
      horas_por_dia: Number(fallback.horas_por_dia ?? 16),
      kg_por_bin: Number(fallback.kg_por_bin ?? 460),
    });
  }, [parametrosEspecie]);

  useEffect(() => {
    const loadCuradoHours = async () => {
      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/curado-horas-config`);
        if (!response.ok) throw new Error('No fue posible cargar horas de curado');
        const rows = await response.json();
        const map = {};
        rows.forEach((row) => {
          map[Number(row.exportadora_id)] = Number(row.horas_curado);
        });
        setCuradoHoursConfig(map);
      } catch (_error) {
        setCuradoHoursConfig({});
      }
    };

    loadCuradoHours();
  }, []);

  const familyBySpeciesId = useMemo(() => {
    const familyMap = new Map(familias.map((family) => [Number(family.id), family]));
    return new Map(
      especies.map((species) => [Number(species.id), familyMap.get(Number(species.familia_id))]),
    );
  }, [familias, especies]);

  const parametersBySpeciesId = useMemo(() => {
    const specific = parametrosEspecie.filter((item) => item.especie_id != null);

    return new Map([
      [
        null,
        {
          bins_por_hora: Number(defaultParameters.bins_por_hora ?? 18),
          horas_por_dia: Number(defaultParameters.horas_por_dia ?? 16),
          kg_por_bin: Number(defaultParameters.kg_por_bin ?? 460),
        },
      ],
      ...specific.map((item) => [
        Number(item.especie_id),
        {
          bins_por_hora: Number(item.bins_por_hora ?? 18),
          horas_por_dia: Number(item.horas_por_dia ?? 16),
          kg_por_bin: Number(item.kg_por_bin ?? 460),
        },
      ]),
    ]);
  }, [parametrosEspecie, defaultParameters]);

  const metrics = useMemo(
    () =>
      createProjectionMetrics({
        dates,
        entities,
        data,
        familyBySpeciesId,
        parametersBySpeciesId,
      }),
    [dates, entities, data, familyBySpeciesId, parametersBySpeciesId],
  );

  return (
    <AppShell
      title="Balance operacional moderno"
      subtitle="Refactor base con Vite, módulos por dominio, configuración por entorno y fallback desacoplado."
    >
      <StatusBanner source={source} error={error} />

      {status === 'loading' ? <div className="panel">Cargando información inicial…</div> : null}

      {status === 'ready' ? (
        <>
          <DashboardOverview entities={entities} metrics={metrics} />

          <ConfigEditor
            entities={entities}
            setEntities={setEntities}
            defaultParameters={defaultParameters}
            setDefaultParameters={setDefaultParameters}
            familias={familias}
            setFamilias={setFamilias}
            especies={especies}
            setEspecies={setEspecies}
            parametrosEspecie={parametrosEspecie}
            setParametrosEspecie={setParametrosEspecie}
            holidays={holidays}
            setHolidays={setHolidays}
            curadoHoursConfig={curadoHoursConfig}
            setCuradoHoursConfig={setCuradoHoursConfig}
          />

          <OperationsEditor
            entities={entities}
            familias={familias}
            especies={especies}
            dates={dates}
            data={data}
            setData={setData}
            temporadaId={temporadaId}
          />

          <div className="layout-grid">
            <ProjectionPanel entities={entities} metrics={metrics} />
            <div className="sidebar-stack">
              <ConfigSummary
                apiBaseUrl={appConfig.apiBaseUrl}
                planningStart={appConfig.planningStart}
                planningDays={appConfig.planningDays}
              />
              <SchedulingSummary families={familias} />
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
};
