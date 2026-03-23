export const AppShell = ({
  title,
  subtitle,
  navSections = [],
  activeView,
  onChangeView,
  children,
}) => {
  const activeItem =
    navSections.flatMap((section) => section.items).find((item) => item.key === activeView) || null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        background: '#eef3f8',
      }}
    >
      <aside
        style={{
          background: '#1f3b5b',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ padding: '1.35rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>
            🍑 Balance de
            <br />
            Operación
          </div>
          <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', color: '#f59e0b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Planificación y balance
          </div>
        </div>

        <div style={{ padding: '0.75rem 0.75rem 1rem', display: 'grid', gap: '1rem' }}>
          {navSections.map((section) => (
            <div key={section.label}>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  padding: '0.35rem 0.45rem',
                }}
              >
                {section.label}
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {section.items.map((item) => {
                  const active = item.key === activeView;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onChangeView?.(item.key)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem',
                        padding: '0.82rem 0.85rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: '#fff',
                        fontWeight: active ? 700 : 500,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '1rem', width: '1.2rem', textAlign: 'center' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '1rem 0.75rem 1.1rem' }}>
          <div
            style={{
              padding: '0.8rem 0.9rem',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.08)',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.45,
            }}
          >
            La data operativa se edita en <strong>Balance</strong> y desde ahí alimenta calendario, dashboard y KPI.
          </div>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header
          style={{
            height: '72px',
            background: '#ffffff',
            borderBottom: '1px solid #dbe4f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0 1.4rem',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              {activeItem?.label || title}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              {activeItem?.description || subtitle}
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {new Date().toLocaleDateString('es-CL')} · {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        <main style={{ padding: '1.35rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
};