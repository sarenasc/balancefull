import { useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StatusBanner } from '../components/ui/StatusBanner';
import { appConfig } from './config';
import { DashboardOverview } from '../features/dashboard/DashboardOverview';
import { ConfigSummary } from '../features/config/ConfigSummary';
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
    entities,
    familias,
    especies,
    parametrosEspecie,
    data: initialData,
    dates,
  } = planner;

  const [data, setData] = useState({});

  const effectiveData =
    Object.keys(data).length > 0 ? data : initialData;

  const familyBySpeciesId = useMemo(() => {
    const families = new Map(familias.map((family) => [Number(family.id), family]));
    return new Map(
      especies.map((species) => [Number(species.id), families.get(Number(species.familia_id))]),
    );
  }, [familias, especies]);

  const parametersBySpeciesId = useMemo(
    () =>
      new Map(
        parametrosEspecie.map((item) => [
          item.especie_id == null ? null : Number(item.especie_id),
          {
            bins_por_hora: Number(item.bins_por_hora ?? 18),
            horas_por_dia: Number(item.horas_por_dia ?? 16),
            kg_por_bin: Number(item.kg_por_bin ?? 460),
          },
        ]),
      ),
    [parametrosEspecie],
  );

  const metrics = useMemo(
    () =>
      createProjectionMetrics({
        dates,
        entities,
        data: effectiveData,
        familyBySpeciesId,
        parametersBySpeciesId,
      }),
    [dates, entities, effectiveData, familyBySpeciesId, parametersBySpeciesId],
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
          <OperationsEditor
            entities={entities}
            familias={familias}
            especies={especies}
            dates={dates}
            data={effectiveData}
            setData={setData}
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
