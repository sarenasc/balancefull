import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StatusBanner } from '../components/ui/StatusBanner';
import { appConfig } from './config';
import { ConfigEditor } from '../features/config/ConfigEditor';
import { ProjectionPanel } from '../features/projection/ProjectionPanel';
import { createProjectionMetrics } from '../features/projection/projectionModel';
import { BalanceBoard } from '../features/balance/BalanceBoard';
import { WeeklyScheduleEditor } from '../features/scheduling/WeeklyScheduleEditor';
import { usePlannerData } from '../hooks/usePlannerData';
import { createApiClient, readList } from '../services/api';

const api = createApiClient(appConfig.apiBaseUrl);

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
  const [flashMsg, setFlashMsg] = useState(null);
  const flashTimer = useRef(null);

  const handleAutoSaved = useCallback(() => {
    setFlashMsg('Cambios guardados automáticamente.');
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashMsg(null), 3000);
  }, []);
  const [entities, setEntities] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [parametrosEspecie, setParametrosEspecie] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [curadoHoursConfig, setCuradoHoursConfig] = useState({});
  const [turnosDefinicion, setTurnosDefinicion] = useState([]);
  const [tiposRestriccion, setTiposRestriccion] = useState([]);
  const [parametrosDia, setParametrosDia] = useState([]);
  const [horasExtraDia, setHorasExtraDia] = useState([]);
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
        const rows = await readList(api, '/curado-horas-config');
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
        const rows = await readList(api, '/turnos-definicion');
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
        const rows = await readList(api, '/tipos-restriccion');
        setTiposRestriccion(rows);
      } catch (_error) {
        setTiposRestriccion([]);
      }
    };

    loadTiposRestriccion();
  }, []);

  const reloadParametrosDia = useCallback(async () => {
    try {
      const rows = await readList(api, '/parametros-dia');
      setParametrosDia(rows);
    } catch (_error) {
      setParametrosDia([]);
    }
  }, []);

  useEffect(() => {
    reloadParametrosDia();
  }, [reloadParametrosDia]);

  useEffect(() => {
    const loadHorasExtraDia = async () => {
      try {
        const rows = await readList(api, '/horas-extra-dia');
        setHorasExtraDia(rows);
      } catch (_error) {
        setHorasExtraDia([]);
      }
    };

    loadHorasExtraDia();
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
        parametrosDia,
      }),
    [dates, entities, data, familyBySpeciesId, parametersBySpeciesId, parametrosDia],
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
      <ProjectionPanel entities={entities} metrics={metrics} />
    </>
  );

  const renderBalance = () => (
    <BalanceBoard
      dates={dates}
      familias={familias}
      especies={especies}
      entities={entities}
      data={data}
      setData={setData}
      holidays={holidays}
      temporadaId={temporadaId}
      curadoHoursConfig={curadoHoursConfig}
      parametersBySpeciesId={parametersBySpeciesId}
      parametrosDia={parametrosDia}
      horasExtraDia={horasExtraDia}
    />
  );

  const renderCalendario = () => (
    <WeeklyScheduleEditor
      turnosDefinicion={turnosDefinicion}
      entities={entities}
      tiposRestriccion={tiposRestriccion}
      holidays={holidays}
      onAutoSaved={handleAutoSaved}
    />
  );

  const renderConfiguracion = () => (
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
      turnosDefinicion={turnosDefinicion}
      setTurnosDefinicion={setTurnosDefinicion}
      tiposRestriccion={tiposRestriccion}
      setTiposRestriccion={setTiposRestriccion}
      onParametrosDiaChanged={reloadParametrosDia}
    />
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
      <StatusBanner source={source} error={error} flashMsg={flashMsg} />

      {status === 'loading' ? <div className="panel">Cargando información inicial…</div> : null}

      {status === 'ready' ? renderActiveView() : null}
    </AppShell>
  );
};

export default App;
