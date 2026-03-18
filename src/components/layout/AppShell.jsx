export const AppShell = ({ title, subtitle, children }) => (
  <div className="app-shell">
    <header className="app-header">
      <div>
        <p className="eyebrow">Balancefull</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
    </header>
    <main className="app-main">{children}</main>
  </div>
);
