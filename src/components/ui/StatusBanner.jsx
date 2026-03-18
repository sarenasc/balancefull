export const StatusBanner = ({ source, error }) => {
  if (!error && source !== 'mock') {
    return (
      <div className="status-banner status-banner--ok">
        Datos conectados desde la API configurada.
      </div>
    );
  }

  return (
    <div className="status-banner status-banner--warn">
      {error ? `Modo degradado: ${error}` : 'Usando datos de ejemplo.'}
    </div>
  );
};
