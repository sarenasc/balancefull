import { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../app/config';
import { buildDateRange } from '../utils/date';
import { buildMockSnapshot, fetchPlannerSnapshot } from '../services/plannerSnapshot';

export const usePlannerData = () => {
  const dates = useMemo(
    () => buildDateRange(appConfig.planningStart, appConfig.planningDays),
    [],
  );

  const [state, setState] = useState({
    status: 'loading',
    source: 'loading',
    entities: [],
    familias: [],
    especies: [],
    parametrosEspecie: [],
    holidays: [],
    data: {},
    error: null,
  });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const snapshot = await fetchPlannerSnapshot(dates);
        if (alive) {
          setState({
            status: 'ready',
            error: null,
            ...snapshot,
          });
        }
      } catch (error) {
        if (alive) {
          const fallback = buildMockSnapshot(dates);
          setState({
            status: 'ready',
            error: error instanceof Error ? error.message : 'No fue posible cargar la API.',
            ...fallback,
          });
        }
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [dates]);

  return {
    ...state,
    dates,
  };
};
