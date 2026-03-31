-- Migración: Horas extras por turno
-- Ejecutar una sola vez en la base de datos de balancefull

-- Horas extra configurables en la definición del turno
ALTER TABLE turnos_definicion
  ADD horas_extra        DECIMAL(4,1) NULL,
      horas_extra_inicio DECIMAL(4,1) NULL;

-- Marca de hora extra en cada asignación de calendario
ALTER TABLE turnos
  ADD es_hora_extra BIT NOT NULL DEFAULT 0;
