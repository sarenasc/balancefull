export const StatusBanner = ({ source, error }) => {
  if (!error && source !== 'mock') {
    return (
      <div className="status-banner status-banner--ok">
        Conectado
      </div>
    );
  }

  return (
    <div className="status-banner status-banner--danger">
      No conectado
    </div>
  );
};
