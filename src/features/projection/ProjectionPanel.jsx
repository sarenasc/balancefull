import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '../../components/ui/StatCard';
import { formatDate } from '../../utils/date';
import { formatDecimal, formatNumber } from '../../utils/format';

const COLORS = ['#0f62fe', '#7c3aed', '#059669', '#ea580c'];

export const ProjectionPanel = ({ entities, metrics }) => (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Proyección</p>
        <h2>Balance y capacidad futura</h2>
      </div>
    </div>

    <div className="stat-grid">
      {metrics.sundayCards.map((card) => (
        <StatCard
          key={card.fecha}
          label={`Dom ${formatDate(card.fecha)}`}
          value={formatNumber(card.balance)}
          hint={`${formatDecimal(card.turnosRestantes)} turnos estimados`}
        />
      ))}
    </div>

    <div className="chart-card">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={metrics.rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#dbe4f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Legend />
          {entities.map((entity, index) => (
            <Area
              key={entity.id}
              type="monotone"
              dataKey={entity.label}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Día</th>
            <th>Fecha</th>
            <th>Cosecha</th>
            <th>Curado</th>
            <th>Proceso</th>
            <th>Balance</th>
            <th>Horas</th>
            <th>Kg procesados</th>
          </tr>
        </thead>
        <tbody>
          {metrics.rows.map((row) => (
            <tr key={row.fecha}>
              <td>{row.dia}</td>
              <td>{formatDate(row.fecha)}</td>
              <td>{formatNumber(row.cosecha)}</td>
              <td>{formatNumber(row.curado)}</td>
              <td>{formatNumber(row.proceso)}</td>
              <td>{formatNumber(row.balance)}</td>
              <td>{formatDecimal(row.horas)}</td>
              <td>{formatNumber(row.kgProcesados)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
