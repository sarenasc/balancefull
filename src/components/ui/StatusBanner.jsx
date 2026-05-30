export const StatusBanner = ({ source, error, flashMsg }) => {
  if (!error && source !== 'mock') {
    return (
      <div className="status-banner status-banner--ok">
        {flashMsg || 'Conectado'}
      </div>
    );
  }

  return (
    <div className="status-banner status-banner--danger">
      No conectado
    </div>
  );
};
