import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StatusBanner } from '../components/ui/StatusBanner';
import { appConfig } from './config';
import { DashboardOverview } from '../features/dashboard/DashboardOverview';
import { ConfigSummary } from '../features/config/ConfigSummary';
import { ConfigEditor } from '../features/config/ConfigEditor';
import { ProjectionPanel } from '../features/projection/ProjectionPanel';
import { createProjectionMetrics } from '../features/projection/projectionModel';
import { BalanceBoard } from '../features/balance/BalanceBoard';
import { SchedulingSummary } from '../features/scheduling/SchedulingSummary';
import { TurnoDefinitionEditor } from '../features/scheduling/TurnoDefinitionEditor';
import { WeeklyScheduleEditor } from '../features/scheduling/WeeklyScheduleEditor';
import { RestrictionTypeEditor } from '../features/scheduling/RestrictionTypeEditor';
import { usePlannerData } from '../hooks/usePlannerData';

const panelHintStyle = {
  marginBottom: '1rem',
  padding: '1rem 1.1rem',
  border: '1px solid #dbe4f0',
  borderRadius: '12px',
  background: '#fff',
  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
};

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

  const [activeView, setActiveView] = useState('balance');
  const [entities, setEntities] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [parametrosEspecie, setParametrosEspecie] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [curadoHoursConfig, setCuradoHoursConfig] = useState({});
  const [turnosDefinicion, setTurnosDefinicion] = useState([]);
  const [tiposRestriccion, setTiposRestriccion] = useState([]);
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

  useEffect(() => {
    const loadTurnosDefinicion = async () => {
      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/turnos-definicion`);
        if (!response.ok) throw new Error('No fue posible cargar turnos');
        const rows = await response.json();
        setTurnosDefinicion(rows);
      } catch (_error) {
        setTurnosDefinicion([]);
      }
    };

    loadTurnosDefinicion();
  }, []);

  useEffect(() => {
    const loadTiposRestriccion = async () => {
      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/tipos-restriccion`);
        if (!response.ok) throw new Error('No fue posible cargar restricciones');
        const rows = await response.json();
        setTiposRestriccion(rows);
      } catch (_error) {
        setTiposRestriccion([]);
      }
    };

    loadTiposRestriccion();
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

  const navSections = [
    {
      label: 'Principal',
      items: [
        {
          key: 'balance',
          label: 'Balance',
          icon: '📘',
          description:
            'Vista principal: edición operativa y balance por familia con cosecha, curado, proceso y horas.',
        },
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: '📊',
          description:
            'Vista general y resumida. Ideal para revisar el estado global sin editar datos.',
        },
      ],
    },
    {
      label: 'Planificación',
      items: [
        {
          key: 'calendario',
          label: 'Calendario',
          icon: '🗓️',
          description:
            'Planificación semanal de turnos y restricciones. Se alimenta desde Operación.',
        },
      ],
    },
    {
      label: 'Parámetros',
      items: [
        {
          key: 'configuracion',
          label: 'Configuración',
          icon: '⚙️',
          description:
            'Familias, especies, parámetros, visibilidad, feriados y horas de curado.',
        },
      ],
    },
  ];

  const renderDashboard = () => (
    <>
      <div style={panelHintStyle}>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase' }}>
          Dashboard
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.95rem', color: '#334155' }}>
          Vista general del sistema. Aquí irán luego los KPI reales una vez que Operación y Balance estén consolidados.
        </div>
      </div>

      <DashboardOverview entities={entities} metrics={metrics} />

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
  );

  const renderBalance = () => (
    <>
      <div style={panelHintStyle}>
        <div
          style={{
            fontSize: '0.78rem',
            letterSpacing: '0.18em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          Balance
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.95rem', color: '#334155' }}>
          Balance operacional por familia. Aquí consolidamos cosecha, curado, proceso,
          horas requeridas y existencia futura.
        </div>
      </div>

      <BalanceBoard
        dates={dates}
        familias={familias}
        especies={especies}
        entities={entities}
        data={data}
        setData={setData}
        temporadaId={temporadaId}
        curadoHoursConfig={curadoHoursConfig}
        parametersBySpeciesId={parametersBySpeciesId}
      />
    </>
  );

  const renderCalendario = () => (
    <>
      <div style={panelHintStyle}>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase' }}>
          Calendario
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.95rem', color: '#334155' }}>
          Capa de planificación semanal. Aquí bajamos la operación ya definida a turnos y bloques de trabajo.
        </div>
      </div>

      <TurnoDefinitionEditor
        turnosDefinicion={turnosDefinicion}
        setTurnosDefinicion={setTurnosDefinicion}
      />

      <RestrictionTypeEditor
        tiposRestriccion={tiposRestriccion}
        setTiposRestriccion={setTiposRestriccion}
      />

      <WeeklyScheduleEditor
        turnosDefinicion={turnosDefinicion}
        entities={entities}
        tiposRestriccion={tiposRestriccion}
      />
    </>
  );

  const renderConfiguracion = () => (
    <>
      <div style={panelHintStyle}>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase' }}>
          Configuración
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.95rem', color: '#334155' }}>
          Ajustes base del sistema: especies, familias, feriados, parámetros generales y horas de curado.
        </div>
      </div>

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
    </>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return renderDashboard();
      case 'balance':
        return renderBalance();
      case 'calendario':
        return renderCalendario();
      case 'configuracion':
        return renderConfiguracion();
      default:
        return renderBalance();
    }
  };

  return (
    <AppShell
      title="Balance operacional"
      subtitle="Edición y lectura operativa unificadas en una sola vista."
      navSections={navSections}
      activeView={activeView}
      onChangeView={setActiveView}
    >
      <StatusBanner source={source} error={error} />

      {status === 'loading' ? <div className="panel">Cargando información inicial…</div> : null}

      {status === 'ready' ? renderActiveView() : null}
    </AppShell>
  );
};
