import { formatNumber } from '../../utils/format';

export const SchedulingSummary = ({ families }) => (
  <section className="panel panel--compact">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Migración</p>
        <h2>Base para programa de turnos</h2>
      </div>
    </div>
    <p className="body-copy">
      Balancefull separa el dominio de planificación en módulos independientes para seguir migrando turnos,
      restricciones y calendarios sin volver a concentrar todo dentro de un solo archivo.
    </p>
    <ul className="bullet-list">
      <li>Familias activas migradas: {formatNumber(families.length)}</li>
      <li>Persistencia preparada para API + fallback desacoplado.</li>
      <li>Estructura lista para incorporar stores o React Query.</li>
    </ul>
  </section>
);
