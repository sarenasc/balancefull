const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export const createEmptyRows = (entityIds, dates) =>
  Object.fromEntries(
    entityIds.map((entityId) => [
      entityId,
      Object.fromEntries(
        dates.map((date) => [date, { cosecha: 0, curado: 0, proceso: 0 }]),
      ),
    ]),
  );

export const normalizeFamilies = (familias = []) =>
  familias.map((family) => ({
    ...family,
    id: Number(family.id),
    orden: Number(family.orden || 0),
    usa_curado: Boolean(family.usa_curado),
    activa: Number(family.activa ?? 1),
  }));

export const normalizeSpecies = (especies = []) =>
  especies.map((species) => ({
    ...species,
    id: Number(species.id),
    familia_id: species.familia_id == null ? null : Number(species.familia_id),
  }));

export const normalizeEntities = ({ exportadoras = [], especies = [] }) => {
  const speciesByName = new Map(
    especies.map((species) => [normalizeText(species.nombre), species]),
  );

  return exportadoras.map((item) => ({
    id: Number(item.id),
    dbId: Number(item.id),
    exportadora: item.nombre,
    especie: item.especie,
    variedad: item.variedad || '',
    colorIdx: Number(item.color_idx || 0),
    especieId: item.especie_id
      ? Number(item.especie_id)
      : Number(speciesByName.get(normalizeText(item.especie))?.id || 0),
    visibleLinea: Number(item.visible_linea ?? 1),
    label: [item.nombre, item.variedad].filter(Boolean).join(' '),
  }));
};

export const hydrateRows = ({ entities = [], rowsByType = {}, dates = [] }) => {
  const rows = createEmptyRows(
    entities.map((entity) => entity.id),
    dates,
  );

  (rowsByType.cosechas || []).forEach((row) => {
    if (rows[row.exportadora_id]?.[row.fecha]) {
      rows[row.exportadora_id][row.fecha].cosecha = Number(row.bins || 0);
    }
  });

  (rowsByType.curado || []).forEach((row) => {
    if (rows[row.exportadora_id]?.[row.fecha]) {
      rows[row.exportadora_id][row.fecha].curado = Number(row.bins || 0);
    }
  });

  (rowsByType.procesos || []).forEach((row) => {
    if (rows[row.exportadora_id]?.[row.fecha]) {
      rows[row.exportadora_id][row.fecha].proceso = Number(row.bins || 0);
    }
  });

  return rows;
};

export const normalizeDefaultParameters = (configuracion = {}) => ({
  especie_id: null,
  bins_por_hora: Number(configuracion.bph ?? configuracion.bins_por_hora ?? 18),
  horas_por_dia: Number(configuracion.hpd ?? configuracion.horas_por_dia ?? 16),
  kg_por_bin: Number(configuracion.kpb ?? configuracion.kg_por_bin ?? 460),
});
