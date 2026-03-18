export const mockSnapshot = {
  exportadoras: [
    { id: 1, nombre: 'Triofrut', especie: 'Cereza', variedad: 'Santina', color_idx: 0, visible_linea: 1 },
    { id: 2, nombre: 'Agua Santa', especie: 'Cereza', variedad: 'Lapins', color_idx: 1, visible_linea: 1 },
    { id: 3, nombre: 'Reina Sur', especie: 'Arándano', variedad: 'Legacy', color_idx: 2, visible_linea: 1 }
  ],
  familias: [
    { id: 1, nombre: 'Carozo', orden: 1, usa_curado: true, activa: 1 },
    { id: 2, nombre: 'Berries', orden: 2, usa_curado: false, activa: 1 }
  ],
  especies: [
    { id: 1, nombre: 'Cereza', familia_id: 1 },
    { id: 2, nombre: 'Arándano', familia_id: 2 }
  ],
  parametrosEspecie: [
    { especie_id: null, bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460 },
    { especie_id: 1, bins_por_hora: 20, horas_por_dia: 16, kg_por_bin: 460 },
    { especie_id: 2, bins_por_hora: 14, horas_por_dia: 14, kg_por_bin: 320 }
  ],
  holidays: ['2026-03-29', '2026-04-10'],
  rows: {
    1: {
      '2026-03-18': { cosecha: 0, curado: 120, proceso: 90 },
      '2026-03-19': { cosecha: 0, curado: 160, proceso: 120 },
      '2026-03-20': { cosecha: 0, curado: 180, proceso: 110 }
    },
    2: {
      '2026-03-18': { cosecha: 0, curado: 80, proceso: 40 },
      '2026-03-19': { cosecha: 0, curado: 95, proceso: 60 }
    },
    3: {
      '2026-03-18': { cosecha: 130, curado: 0, proceso: 70 },
      '2026-03-19': { cosecha: 150, curado: 0, proceso: 65 },
      '2026-03-20': { cosecha: 140, curado: 0, proceso: 80 }
    }
  }
};
