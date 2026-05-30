import React from 'react';

const tabs = [
  { key: 'parametros', label: 'Parámetros' },
  { key: 'catalogos', label: 'Catálogos' },
  { key: 'exportadoras', label: 'Exportadoras' },
  { key: 'temporadas', label: 'Temporadas' },
  { key: 'calendario', label: 'Feriados' },
  { key: 'curado', label: 'Curado' },
  { key: 'parametros-dia', label: 'Parámetros día' },
  { key: 'turnos', label: 'Turnos' },
  { key: 'restricciones', label: 'Restricciones' },
];

const buttonStyle = (active) => ({
  padding: '0.7rem 1rem',
  borderRadius: '12px',
  border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
  background: active ? '#eff6ff' : '#fff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
});

export default function ConfigSubMenu({ active, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          style={buttonStyle(active === tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
