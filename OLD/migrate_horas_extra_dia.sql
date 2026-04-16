-- Migración: Tabla horas extra por exportadora/día
-- Ejecutar una sola vez en la base de datos almahue_balance

CREATE TABLE horas_extra_dia (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    exportadora_id  INT  NOT NULL,
    fecha           DATE NOT NULL,
    horas_extra     DECIMAL(4,1) NOT NULL DEFAULT 0,
    actualizado_en  DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_horas_extra_dia UNIQUE (exportadora_id, fecha)
);
