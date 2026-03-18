export const ConfigSummary = ({ apiBaseUrl, planningStart, planningDays }) => (
  <section className="panel panel--compact">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Configuración</p>
        <h2>Variables de entorno</h2>
      </div>
    </div>
    <dl className="definition-grid">
      <div>
        <dt>API base</dt>
        <dd>{apiBaseUrl}</dd>
      </div>
      <div>
        <dt>Inicio planificación</dt>
        <dd>{planningStart}</dd>
      </div>
      <div>
        <dt>Días proyectados</dt>
        <dd>{planningDays}</dd>
      </div>
    </dl>
  </section>
);
