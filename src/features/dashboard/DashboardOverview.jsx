import { StatCard } from '../../components/ui/StatCard';
import { formatNumber } from '../../utils/format';

export const DashboardOverview = ({ entities, metrics }) => {
  const totalCurado = metrics.rows.reduce((total, row) => total + row.curado, 0);
  const totalProceso = metrics.rows.reduce((total, row) => total + row.proceso, 0);
  const totalBalance = metrics.rows.at(-1)?.balance || 0;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Resumen</p>
          <h2>Vista operacional</h2>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Exportadoras activas" value={formatNumber(entities.length)} hint="Cargadas desde API o fallback" />
        <StatCard label="Curado acumulado" value={formatNumber(totalCurado)} hint="Bins en el rango" />
        <StatCard label="Proceso acumulado" value={formatNumber(totalProceso)} hint="Bins procesados" />
        <StatCard label="Balance proyectado" value={formatNumber(totalBalance)} hint="Último día del horizonte" />
      </div>
    </section>
  );
};
