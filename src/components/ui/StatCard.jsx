export const StatCard = ({ label, value, hint }) => (
  <article className="stat-card">
    <p className="stat-label">{label}</p>
    <strong className="stat-value">{value}</strong>
    {hint ? <p className="stat-hint">{hint}</p> : null}
  </article>
);
